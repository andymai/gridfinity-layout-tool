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
export type Effort = NonNullable<Anthropic.Beta.BetaOutputConfig['effort']>;

export const MODEL = 'claude-opus-5-5';
export const EFFORT: Effort = 'medium';
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
  | { type: 'notice'; code: 'refusal' | 'truncated' | 'resting' };

export interface AgentOptions {
  readonly client: Anthropic;
  readonly corpus: AskCorpus;
  readonly tools: ToolUnion[];
  readonly messages: MessageParam[];
  readonly locale: string;
  readonly run: (name: string, input: unknown, locale: string) => ToolRun;
  readonly send: (event: AgentEvent) => void;
  readonly budget: RoundBudget;
  /** Filled as rounds finish, so a failed answer still reports what it spent. */
  readonly progress: AgentProgress;
  readonly signal: AbortSignal;
  /** The eval compares models and effort levels; production uses MODEL and EFFORT. */
  readonly model?: string;
  readonly effort?: Effort;
}

/**
 * The daily cap, held round by round. reserve() sets money aside before a
 * round and answers false at the cap, so concurrent questions cannot all
 * start paid rounds on one reading of the spend. charge() takes each model
 * call's cost, and release() returns the reservation when the round ends.
 */
export interface RoundBudget {
  reserve(): Promise<boolean>;
  charge(usd: number): Promise<void>;
  release(): Promise<void>;
}

export interface AgentProgress {
  readonly generations: Generation[];
  readonly steps: string[];
  readonly links: string[];
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
  lastRound: boolean,
  model: string = MODEL,
  effort: Effort = EFFORT
): Anthropic.Beta.MessageCreateParamsStreaming {
  return {
    model,
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
    output_config: { effort },
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

type PartialUsage = Anthropic.Beta.BetaUsage & { model: string };

// A delta's counts are running totals, input and cache included.
function withDelta(
  partial: PartialUsage | null,
  delta: Anthropic.Beta.BetaMessageDeltaUsage
): PartialUsage | null {
  if (!partial) return null;
  return {
    ...partial,
    input_tokens: delta.input_tokens ?? partial.input_tokens,
    cache_read_input_tokens: delta.cache_read_input_tokens ?? partial.cache_read_input_tokens,
    cache_creation_input_tokens:
      delta.cache_creation_input_tokens ?? partial.cache_creation_input_tokens,
  };
}

async function streamRound(
  options: AgentOptions,
  messages: MessageParam[],
  lastRound: boolean,
  shown: { visible: boolean }
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
  let partial: PartialUsage | null = null;
  let outputTokens = 0;
  let charged = false;
  const send = (event: AgentEvent): void => {
    shown.visible = true;
    options.send(event);
  };
  const stream = options.client.beta.messages.stream(
    requestParams(
      options.corpus,
      options.tools,
      messages,
      lastRound,
      options.model,
      options.effort
    ),
    { signal: options.signal }
  );
  try {
    for await (const event of stream) {
      if (event.type === 'message_start') {
        partial = { ...event.message.usage, model: event.message.model };
      } else if (event.type === 'message_delta') {
        outputTokens = event.usage.output_tokens;
        partial = withDelta(partial, event.usage);
      } else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        const kind = kindOf(event.content_block.name);
        send({
          type: 'step',
          id: event.content_block.id,
          kind,
          state: 'running',
          label: PLACEHOLDER_LABELS[kind],
        });
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'thinking_delta') {
          send({ type: 'thinking', text: event.delta.thinking });
        } else if (event.delta.type === 'text_delta') {
          firstToken ??= performance.now();
          send({ type: 'text', text: event.delta.text });
        }
      }
    }
    const message = await stream.finalMessage();
    const cost = costUsd(message.model, message.usage);
    charged = true;
    await options.budget.charge(cost);
    return {
      message,
      costUsd: cost,
      firstTokenSeconds: firstToken === null ? null : (firstToken - started) / 1000,
      latencySeconds: (performance.now() - started) / 1000,
    };
  } finally {
    if (!charged && partial) {
      const usage = { ...partial, output_tokens: Math.max(outputTokens, partial.output_tokens) };
      await options.budget.charge(costUsd(partial.model, usage)).catch(() => undefined);
    }
  }
}

async function roundWithRetries(
  options: AgentOptions,
  messages: MessageParam[],
  lastRound: boolean
): Promise<Awaited<ReturnType<typeof streamRound>>> {
  const shown = { visible: false };
  for (let attempt = 0; ; attempt++) {
    try {
      return await streamRound(options, messages, lastRound, shown);
    } catch (error) {
      // A failed stream is worth another try only while the reader has seen
      // nothing of the round, or the retry would repeat what they saw. An API
      // error or the reader's own abort is not worth one.
      if (
        error instanceof Anthropic.APIError ||
        options.signal.aborted ||
        shown.visible ||
        attempt >= MAX_RETRIES
      )
        throw error;
    }
  }
}

// After a mid-output fallback, the API takes back no thinking or tool call
// from before the last fallback block, so neither goes back, and a call that
// does not go back gets no result.
function echoContent(content: readonly ContentBlock[]): ContentBlock[] {
  const boundary = content.map((block) => block.type).lastIndexOf('fallback');
  if (boundary < 0) return [...content];
  return content.filter(
    (block, i) =>
      i >= boundary ||
      !(
        block.type === 'thinking' ||
        block.type === 'redacted_thinking' ||
        block.type === 'tool_use' ||
        block.type === 'server_tool_use'
      )
  );
}

export async function runAgent(options: AgentOptions): Promise<AgentResult> {
  const messages = [...options.messages];
  const { generations, steps, links } = options.progress;
  let answer = '';
  let stopReason: string | null = null;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (!(await options.budget.reserve())) {
      options.send({ type: 'notice', code: 'resting' });
      break;
    }
    const lastRound = round === MAX_ROUNDS - 1;
    let result: Awaited<ReturnType<typeof streamRound>>;
    try {
      result = await roundWithRetries(options, messages, lastRound);
    } finally {
      await options.budget.release();
    }
    const { message, costUsd: cost } = result;
    const content = echoContent(message.content);
    const calls = content.filter(
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

    messages.push({ role: 'assistant', content });
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
  }
  return { answer, steps, links, generations, stopReason };
}
