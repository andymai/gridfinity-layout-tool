import { createHmac, timingSafeEqual } from 'crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  CLIENT_TOOLS,
  MAX_CLIENT_RESULTS,
  OVER_LIMIT_CONTENT,
  clientResultSchema,
  clientRun,
  overClientLimit,
} from './clientTools.js';
import type { ClientResult, ClientTools } from './clientTools.js';
import type { AskCorpus } from './corpus.js';
import { contextMessage } from './prompt.js';
import { TOOL_NAMES, toolResult } from './tools.js';
import type { Door, ToolRunner } from './tools.js';

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
type ToolResultParam = Anthropic.Beta.BetaToolResultBlockParam;

export const MAX_TURNS = 8;
const MAX_QUESTION_CHARS = 1000;
const MAX_MESSAGES_PER_TURN = 8;
const MAX_BLOCK_CHARS = 200_000;

// Control bytes have no meaning in a question; a newline or a tab can.
// eslint-disable-next-line no-control-regex -- stripping control bytes is the point
const CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const clean = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (typeof value === 'string' ? value.replace(CONTROL, '') : value), schema);

const sessionIdField = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);
/** The panel that asks. Each door signs with its own key, so a turn cannot cross doors. */
const doorField = z.enum(['docs', 'app']).default('docs');
const pageField = clean(z.string().max(200));
const localeField = clean(z.string().max(10));

const storedBlock = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().max(MAX_BLOCK_CHARS) }),
  z.object({
    type: z.literal('thinking'),
    thinking: z.string().max(MAX_BLOCK_CHARS),
    signature: z.string().max(MAX_BLOCK_CHARS),
  }),
  z.object({ type: z.literal('redacted_thinking'), data: z.string().max(MAX_BLOCK_CHARS) }),
  z.object({
    type: z.literal('fallback'),
    from: z.object({ model: z.string().max(200) }),
    to: z.object({ model: z.string().max(200) }),
    trigger: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('tool_use'),
    id: z.string().max(200),
    name: z.string().max(64),
    input: z.record(z.string(), z.unknown()),
  }),
]);
type StoredBlock = z.infer<typeof storedBlock>;

const turnSchema = z.object({
  question: clean(z.string().min(1).max(MAX_QUESTION_CHARS)),
  page: pageField,
  locale: localeField,
  /** Each assistant message of the turn, in order, as the API returned its content. */
  messages: z.array(z.array(z.unknown()).max(64)).max(MAX_MESSAGES_PER_TURN),
  /** What the reader's browser returned for the turn's browser tool calls. */
  results: z.array(clientResultSchema).max(MAX_CLIENT_RESULTS).optional(),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
});
export type StoredTurn = z.infer<typeof turnSchema>;

const pendingSchema = z.object({
  question: clean(z.string().min(1).max(MAX_QUESTION_CHARS)),
  page: pageField,
  locale: localeField,
  messages: z.array(z.array(z.unknown()).max(64)).min(1).max(MAX_MESSAGES_PER_TURN),
  results: z.array(clientResultSchema).max(MAX_CLIENT_RESULTS),
  rounds: z.number().int().min(1).max(64),
  issuedAt: z.number().int().nonnegative(),
  nonce: z.uuid(),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
});
export type PendingTurn = z.infer<typeof pendingSchema>;

export const askRequestSchema = z.object({
  op: z.literal('ask'),
  door: doorField,
  sessionId: sessionIdField,
  question: clean(z.string().trim().min(1).max(MAX_QUESTION_CHARS)),
  page: pageField,
  locale: localeField,
  turns: z.array(turnSchema).max(MAX_TURNS),
  /** The reader's analytics switch, as the app keeps it. Absent means no trace. */
  analytics: z.boolean().default(false),
});

export const resumeRequestSchema = z.object({
  op: z.literal('resume'),
  door: doorField,
  sessionId: sessionIdField,
  pending: pendingSchema,
  results: z.array(clientResultSchema).min(1).max(MAX_CLIENT_RESULTS),
  turns: z.array(turnSchema).max(MAX_TURNS),
  analytics: z.boolean().default(false),
});

export const feedbackRequestSchema = z.object({
  op: z.literal('feedback'),
  sessionId: sessionIdField,
  traceId: z.uuid(),
  value: z.union([z.literal(1), z.literal(-1)]),
  analytics: z.boolean().default(false),
});

export interface TurnFields {
  readonly question: string;
  readonly page: string;
  readonly locale: string;
  readonly messages: readonly unknown[];
  readonly results?: readonly ClientResult[];
}

/**
 * The server signs each finished turn, so a client can send back only the
 * turns it was given: an edited answer could talk the model out of its scope
 * at this site's cost. JSON keeps its key order through a round trip, so the
 * client's copy hashes the same.
 */
export function turnSignature(key: string, turn: TurnFields): string {
  const fields: unknown[] = [turn.question, turn.page, turn.locale, turn.messages];
  // A turn without browser results hashes as it did before they existed.
  if (turn.results !== undefined && turn.results.length > 0) fields.push(turn.results);
  return createHmac('sha256', key).update(JSON.stringify(fields)).digest('hex');
}

export function turnSigned(key: string, turn: StoredTurn): boolean {
  const expected = Buffer.from(turnSignature(key, turn), 'hex');
  const given = Buffer.from(turn.signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function toParam(block: StoredBlock): ContentBlockParam {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };
    case 'thinking':
      return { type: 'thinking', thinking: block.thinking, signature: block.signature };
    case 'redacted_thinking':
      return { type: 'redacted_thinking', data: block.data };
    case 'fallback':
      return {
        type: 'fallback',
        from: { model: block.from.model },
        to: { model: block.to.model },
        ...(block.trigger === undefined ? {} : { trigger: block.trigger }),
      };
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
  }
}

const knownTool = (name: string, clientTools: ClientTools): boolean =>
  (TOOL_NAMES as readonly string[]).includes(name) || clientTools.has(name);

// The live loop sends back no thinking or tool call from before a message's
// last fallback block (echoContent in agent.ts), so a rebuild drops them too.
function afterFallback(blocks: StoredBlock[]): StoredBlock[] {
  const boundary = blocks.map((block) => block.type).lastIndexOf('fallback');
  if (boundary < 0) return blocks;
  return blocks.filter(
    (block, i) =>
      i >= boundary ||
      !(
        block.type === 'thinking' ||
        block.type === 'redacted_thinking' ||
        block.type === 'tool_use'
      )
  );
}

// A finished turn with a fallback goes back as its answer text alone, as it
// always has. A pending turn is the same turn going on, so it keeps the
// fallback block, as the live loop does within one request.
function storedMessages(
  messages: readonly unknown[],
  clientTools: ClientTools,
  keepFallback: boolean
): StoredBlock[][] | null {
  const parsed: StoredBlock[][] = [];
  for (const content of messages) {
    if (!Array.isArray(content)) return null;
    const blocks: StoredBlock[] = [];
    for (const block of content) {
      const result = storedBlock.safeParse(block);
      if (!result.success) return null;
      if (result.data.type === 'tool_use' && !knownTool(result.data.name, clientTools)) return null;
      if (result.data.type === 'fallback' && !keepFallback) return null;
      blocks.push(result.data);
    }
    parsed.push(afterFallback(blocks));
  }
  return parsed;
}

function answerOnly(turn: StoredTurn): StoredBlock[][] {
  const last = turn.messages.at(-1);
  const text = (Array.isArray(last) ? last : [])
    .flatMap((block) => {
      const result = storedBlock.safeParse(block);
      return result.success && result.data.type === 'text' ? [result.data.text] : [];
    })
    .join('')
    .trim();
  return text ? [[{ type: 'text', text }]] : [];
}

/**
 * Each assistant message with the results of its tool calls: a server tool
 * runs again, and a browser tool takes its stored result. Null when a browser
 * call has no result that fits its tool.
 */
function answerMessages(
  messages: readonly StoredBlock[][],
  run: ToolRunner,
  locale: string,
  clientTools: ClientTools,
  results: readonly ClientResult[]
): MessageParam[] | null {
  const out: MessageParam[] = [];
  let answered = 0;
  for (const content of messages) {
    out.push({ role: 'assistant', content: content.map(toParam) });
    const calls = content.filter((block) => block.type === 'tool_use');
    if (calls.length === 0) continue;
    const browser = calls.filter((call) => clientTools.has(call.name)).length;
    const overLimit = browser > 0 && overClientLimit(answered, browser);
    if (!overLimit) answered += browser;
    const blocks: ToolResultParam[] = [];
    for (const call of calls) {
      const tool = clientTools.get(call.name);
      if (tool === undefined) {
        blocks.push(toolResult(call.id, run(call.name, call.input, locale)));
        continue;
      }
      if (overLimit) {
        const label = tool.label(call.input);
        blocks.push(toolResult(call.id, { isError: true, label, content: OVER_LIMIT_CONTENT }));
        continue;
      }
      const result = results.find((r) => r.callId === call.id);
      const ran = result === undefined ? null : clientRun(tool, call.input, result);
      if (ran === null) return null;
      blocks.push(toolResult(call.id, ran));
    }
    out.push({ role: 'user', content: blocks });
  }
  return out;
}

/**
 * A finished turn as its messages, or as the text of its answer alone when it
 * holds a block that the API must not get back as is: a fallback boundary, a
 * block type or tool this code does not know, a tool call that never got an
 * answer, or a browser result that no longer fits its tool. Dropping its
 * thinking can cost later blocks their check, which drop_block absorbs.
 */
function turnMessages(
  turn: StoredTurn,
  run: ToolRunner,
  locale: string,
  clientTools: ClientTools
): MessageParam[] {
  const messages = storedMessages(turn.messages, clientTools, false);
  const last = messages?.at(-1) ?? [];
  // A refusal can end on thinking alone or on nothing, and an empty assistant
  // message would fail every later request of the chat.
  const answered =
    !last.some((block) => block.type === 'tool_use') &&
    last.some((block) => block.type === 'text' && block.text.trim() !== '');
  const full =
    messages !== null && answered
      ? answerMessages(messages, run, locale, clientTools, turn.results ?? [])
      : null;
  if (full !== null) return full;
  return answerOnly(turn).map((content) => ({ role: 'assistant', content: content.map(toParam) }));
}

export function userTurn(
  corpus: AskCorpus,
  question: string,
  page: string,
  locale: string,
  door: Door = 'docs'
): MessageParam[] {
  return [
    { role: 'user', content: question },
    { role: 'system', content: contextMessage(corpus, page, locale, door) },
  ];
}

/**
 * The conversation so far, built the same way on every request so that its
 * bytes, and so the prompt cache and the thinking blocks, stay valid: the
 * context goes in a system message after each question, and each tool result
 * is run again here rather than taken from the client.
 */
export function rebuildMessages(
  corpus: AskCorpus,
  turns: readonly StoredTurn[],
  run: ToolRunner,
  localeOf: (locale: string) => string,
  signed: (turn: StoredTurn) => boolean,
  clientTools: ClientTools = CLIENT_TOOLS,
  door: Door = 'docs'
): MessageParam[] {
  const messages: MessageParam[] = [];
  for (const turn of turns) {
    if (!signed(turn)) continue;
    const locale = localeOf(turn.locale);
    const answer = turnMessages(turn, run, locale, clientTools);
    if (answer.length === 0) continue;
    messages.push(...userTurn(corpus, turn.question, turn.page, locale, door), ...answer);
  }
  return messages;
}

/**
 * The browser calls that a pending turn waits for: those in its last message.
 * Null when the turn cannot go on, because a block or tool is unknown.
 */
export function awaitedCalls(
  pending: PendingTurn,
  clientTools: ClientTools = CLIENT_TOOLS
): { readonly id: string; readonly name: string; readonly input: unknown }[] | null {
  const messages = storedMessages(pending.messages, clientTools, true);
  if (messages === null) return null;
  return (messages.at(-1) ?? []).flatMap((block) =>
    block.type === 'tool_use' && clientTools.has(block.name)
      ? [{ id: block.id, name: block.name, input: block.input }]
      : []
  );
}

/**
 * The pending turn as messages, its last tool calls answered with the new
 * browser results: the question, the context, and each round so far. Null
 * when a result is missing or does not fit its tool.
 */
export function pendingMessages(
  corpus: AskCorpus,
  pending: PendingTurn,
  results: readonly ClientResult[],
  run: ToolRunner,
  clientTools: ClientTools = CLIENT_TOOLS,
  door: Door = 'docs'
): MessageParam[] | null {
  const messages = storedMessages(pending.messages, clientTools, true);
  if (messages === null) return null;
  const answer = answerMessages(messages, run, pending.locale, clientTools, [
    ...pending.results,
    ...results,
  ]);
  if (answer === null) return null;
  return [...userTurn(corpus, pending.question, pending.page, pending.locale, door), ...answer];
}
