import Anthropic from '@anthropic-ai/sdk';
import type { AskCorpus } from './corpus.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { costUsd } from './spend.js';
import { STEP_KINDS } from './tools.js';
import type { StepKind, ToolName, ToolRun } from './tools.js';
import type { Generation } from './traces.js';

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ToolUnion = Anthropic.Beta.BetaToolUnion;
type ContentBlock = Anthropic.Beta.BetaContentBlock;

export const MODEL = 'claude-opus-5-5';
export const EFFORT = 'medium';
const MAX_TOKENS = 16_000;
const MAX_ROUNDS = 6;
const MAX_RETRIES = 2;
const BETAS: Anthropic.Beta.AnthropicBeta[] = [
  'thinking-binding-controls-2026-08-01',
  'server-side-fallback-2026-07-01',
];

export type AgentEvent =
  | { type: 'step'; id: string; kind: StepKind; state: 'running' | 'done' | 'error'; label: string }
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  /** One assistant message as the API returned it, for the panel to send back next turn. */
  | { type: 'message'; content: ContentBlock[] }
  | { type: 'notice'; code: 'refusal' | 'truncated' | 'round_limit' | 'resting' };

export interface AgentOptions {
  readonly client: Anthropic;
  readonly corpus: AskCorpus;
  readonly tools: ToolUnion[];
  readonly messages: MessageParam[];
  readonly locale: string;
  readonly run: (name: string, input: unknown, locale: string) => ToolRun;
  readonly send: (event: AgentEvent) => void;
  readonly onCost: (usd: number) => Promise<void>;
  /** False once the day's spend reaches the cap; asked before each round. */
  readonly canContinue: () => Promise<boolean>;
  readonly signal: AbortSignal;
}

export interface AgentResult {
  readonly answer: string;
  readonly steps: readonly string[];
  readonly links: readonly string[];
  readonly generations: readonly Generation[];
  readonly stopReason: string | null;
}

const PLACEHOLDER_LABELS: Readonly<Record<StepKind, string>> = {
  read: 'Opening a page',
  search: 'Searching the docs',
  check: 'Checking a drawer',
};

function kindOf(name: string): StepKind {
  return Object.hasOwn(STEP_KINDS, name) ? STEP_KINDS[name as ToolName] : 'read';
}

function textOf(content: readonly ContentBlock[]): string {
  return content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
}

export function requestParams(
  corpus: AskCorpus,
  tools: ToolUnion[],
  messages: MessageParam[],
  lastRound: boolean
): Anthropic.Beta.MessageCreateParamsStreaming {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    stream: true,
    betas: BETAS,
    fallbacks: 'default',
    thinking: {
      type: 'adaptive',
      display: 'summarized',
      // A deploy changes the system prompt under an open chat; its old
      // thinking then drops instead of failing the request.
      block_binding: { prefix_mismatch_behavior: 'drop_block' },
    },
    output_config: { effort: EFFORT },
    cache_control: { type: 'ephemeral' },
    system: [
      { type: 'text', text: SYSTEM_PROMPT },
      { type: 'text', text: corpus.map, cache_control: { type: 'ephemeral' } },
    ],
    tools,
    ...(lastRound ? { tool_choice: { type: 'none' as const } } : {}),
    messages,
  };
}

async function streamRound(
  options: AgentOptions,
  messages: MessageParam[],
  lastRound: boolean
): Promise<{
  message: Anthropic.Beta.BetaMessage;
  costUsd: number;
  firstTokenSeconds: number | null;
  latencySeconds: number;
}> {
  const started = performance.now();
  let firstToken: number | null = null;
  // A round that fails or that the reader stops is billed too, so the spend
  // counter takes what the stream reported before it ended.
  let partial: (Anthropic.Beta.BetaUsage & { model: string }) | null = null;
  let outputTokens = 0;
  let charged = false;
  const stream = options.client.beta.messages.stream(
    requestParams(options.corpus, options.tools, messages, lastRound),
    { signal: options.signal }
  );
  try {
    for await (const event of stream) {
      if (event.type === 'message_start') {
        partial = { ...event.message.usage, model: event.message.model };
      } else if (event.type === 'message_delta') {
        outputTokens = event.usage.output_tokens;
      } else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        const kind = kindOf(event.content_block.name);
        options.send({
          type: 'step',
          id: event.content_block.id,
          kind,
          state: 'running',
          label: PLACEHOLDER_LABELS[kind],
        });
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'thinking_delta') {
          options.send({ type: 'thinking', text: event.delta.thinking });
        } else if (event.delta.type === 'text_delta') {
          firstToken ??= performance.now();
          options.send({ type: 'text', text: event.delta.text });
        }
      }
    }
    const message = await stream.finalMessage();
    const cost = costUsd(message.model, message.usage);
    charged = true;
    await options.onCost(cost);
    return {
      message,
      costUsd: cost,
      firstTokenSeconds: firstToken === null ? null : (firstToken - started) / 1000,
      latencySeconds: (performance.now() - started) / 1000,
    };
  } finally {
    if (!charged && partial) {
      const usage = { ...partial, output_tokens: Math.max(outputTokens, partial.output_tokens) };
      await options.onCost(costUsd(partial.model, usage)).catch(() => undefined);
    }
  }
}

export async function runAgent(options: AgentOptions): Promise<AgentResult> {
  const messages = [...options.messages];
  const generations: Generation[] = [];
  const steps: string[] = [];
  const links: string[] = [];
  let answer = '';
  let stopReason: string | null = null;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (!(await options.canContinue())) {
      options.send({ type: 'notice', code: 'resting' });
      break;
    }
    const lastRound = round === MAX_ROUNDS - 1;
    let result: Awaited<ReturnType<typeof streamRound>> | undefined;
    for (let attempt = 0; !result; attempt++) {
      try {
        result = await streamRound(options, messages, lastRound);
      } catch (error) {
        // A tool input that will not parse, or a dropped connection, is worth
        // another try. An API error or the reader's own abort is not.
        if (error instanceof Anthropic.APIError || options.signal.aborted || attempt >= MAX_RETRIES)
          throw error;
      }
    }
    const { message, costUsd: cost } = result;
    const calls = message.content.filter(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use'
    );
    generations.push({
      spanId: message.id,
      model: message.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      costUsd: cost,
      latencySeconds: result.latencySeconds,
      firstTokenSeconds: result.firstTokenSeconds,
      stopReason: message.stop_reason,
      text: textOf(message.content),
      toolCalls: calls.map((call) => call.name),
    });
    options.send({ type: 'message', content: message.content });
    stopReason = message.stop_reason;
    answer = textOf(message.content);

    if (message.stop_reason === 'refusal') {
      options.send({ type: 'notice', code: 'refusal' });
      break;
    }
    // A tool input cut off at max_tokens can still parse; never run it.
    if (message.stop_reason === 'max_tokens') {
      options.send({ type: 'notice', code: 'truncated' });
      break;
    }
    if (message.stop_reason !== 'tool_use' || calls.length === 0) break;

    messages.push({ role: 'assistant', content: message.content });
    messages.push({
      role: 'user',
      content: calls.map((call) => {
        const run = options.run(call.name, call.input, options.locale);
        steps.push(run.label);
        if (run.link) links.push(run.link);
        options.send({
          type: 'step',
          id: call.id,
          kind: kindOf(call.name),
          state: run.isError ? 'error' : 'done',
          label: run.label,
        });
        return {
          type: 'tool_result' as const,
          tool_use_id: call.id,
          content: run.content,
          ...(run.isError ? { is_error: true } : {}),
        };
      }),
    });
    if (lastRound) options.send({ type: 'notice', code: 'round_limit' });
  }
  return { answer, steps, links, generations, stopReason };
}
