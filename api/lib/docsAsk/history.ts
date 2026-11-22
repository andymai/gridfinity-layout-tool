import { createHmac, timingSafeEqual } from 'crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { AskCorpus } from './corpus.js';
import { contextMessage } from './prompt.js';
import { TOOL_NAMES } from './tools.js';
import type { ToolRun } from './tools.js';

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;

export const MAX_TURNS = 8;
export const MAX_QUESTION_CHARS = 1000;
const MAX_MESSAGES_PER_TURN = 8;
const MAX_BLOCK_CHARS = 200_000;

// Control bytes have no meaning in a question; a newline or a tab can.
// eslint-disable-next-line no-control-regex -- stripping control bytes is the point
const CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const clean = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (typeof value === 'string' ? value.replace(CONTROL, '') : value), schema);

const storedBlock = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().max(MAX_BLOCK_CHARS) }),
  z.object({
    type: z.literal('thinking'),
    thinking: z.string().max(MAX_BLOCK_CHARS),
    signature: z.string().max(MAX_BLOCK_CHARS),
  }),
  z.object({ type: z.literal('redacted_thinking'), data: z.string().max(MAX_BLOCK_CHARS) }),
  z.object({
    type: z.literal('tool_use'),
    id: z.string().max(200),
    name: z.enum(TOOL_NAMES as [string, ...string[]]),
    input: z.record(z.string(), z.unknown()),
  }),
]);
type StoredBlock = z.infer<typeof storedBlock>;

const turnSchema = z.object({
  question: clean(z.string().min(1).max(MAX_QUESTION_CHARS)),
  page: clean(z.string().max(200)),
  locale: clean(z.string().max(10)),
  /** Each assistant message of the turn, in order, as the API returned its content. */
  messages: z.array(z.array(z.unknown()).max(64)).max(MAX_MESSAGES_PER_TURN),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
});
export type StoredTurn = z.infer<typeof turnSchema>;

export const askRequestSchema = z.object({
  op: z.literal('ask'),
  sessionId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  question: clean(z.string().trim().min(1).max(MAX_QUESTION_CHARS)),
  page: clean(z.string().max(200)),
  locale: clean(z.string().max(10)),
  turns: z.array(turnSchema).max(MAX_TURNS),
  /** The reader's analytics switch, as the app keeps it. Absent means no trace. */
  analytics: z.boolean().default(false),
});
export type AskRequest = z.infer<typeof askRequestSchema>;

export const feedbackRequestSchema = z.object({
  op: z.literal('feedback'),
  sessionId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  traceId: z.uuid(),
  value: z.union([z.literal(1), z.literal(-1)]),
  analytics: z.boolean().default(false),
});

type Runner = (name: string, input: unknown, locale: string) => ToolRun;

export interface TurnFields {
  readonly question: string;
  readonly page: string;
  readonly locale: string;
  readonly messages: readonly unknown[];
}

/**
 * The server signs each finished turn, so a client can send back only the
 * turns it was given: an edited answer could talk the model out of its scope
 * at this site's cost. JSON keeps its key order through a round trip, so the
 * client's copy hashes the same.
 */
export function turnSignature(key: string, turn: TurnFields): string {
  return createHmac('sha256', key)
    .update(JSON.stringify([turn.question, turn.page, turn.locale, turn.messages]))
    .digest('hex');
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
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
  }
}

/**
 * A turn as its assistant messages, or as the text of its answer alone when it
 * holds a block that the API must not get back as is: a fallback boundary, a
 * block type this code does not know, or a tool call that never got an answer.
 * Dropping its thinking can cost later blocks their check, which drop_block
 * absorbs.
 */
function turnMessages(turn: StoredTurn): StoredBlock[][] {
  const parsed = turn.messages.map((content) =>
    content.map((block) => storedBlock.safeParse(block))
  );
  const clean = parsed.every((message) => message.every((result) => result.success));
  const messages = parsed.map((message) =>
    message.flatMap((result) => (result.success ? [result.data] : []))
  );
  const last = messages.at(-1);
  // A refusal can end on thinking alone or on nothing, and an empty assistant
  // message would fail every later request of the chat.
  const answered =
    last !== undefined &&
    !last.some((block) => block.type === 'tool_use') &&
    last.some((block) => block.type === 'text' && block.text.trim() !== '');
  if (clean && answered) return messages;
  const text = (turn.messages.at(-1) ?? [])
    .flatMap((block) => {
      const result = storedBlock.safeParse(block);
      return result.success && result.data.type === 'text' ? [result.data.text] : [];
    })
    .join('')
    .trim();
  return text ? [[{ type: 'text', text }]] : [];
}

export function userTurn(
  corpus: AskCorpus,
  question: string,
  page: string,
  locale: string
): MessageParam[] {
  return [
    { role: 'user', content: question },
    { role: 'system', content: contextMessage(corpus, page, locale) },
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
  run: Runner,
  localeOf: (locale: string) => string,
  signed: (turn: StoredTurn) => boolean
): MessageParam[] {
  const messages: MessageParam[] = [];
  for (const turn of turns) {
    if (!signed(turn)) continue;
    const answer = turnMessages(turn);
    if (answer.length === 0) continue;
    const locale = localeOf(turn.locale);
    messages.push(...userTurn(corpus, turn.question, turn.page, locale));
    for (const content of answer) {
      messages.push({ role: 'assistant', content: content.map(toParam) });
      const calls = content.filter((block) => block.type === 'tool_use');
      if (calls.length === 0) continue;
      messages.push({
        role: 'user',
        content: calls.map((call) => {
          const result = run(call.name, call.input, locale);
          return {
            type: 'tool_result',
            tool_use_id: call.id,
            content: result.content,
            ...(result.isError ? { is_error: true } : {}),
          };
        }),
      });
    }
  }
  return messages;
}
