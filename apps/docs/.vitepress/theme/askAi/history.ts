import type { PlanView } from '@/agent/contract';
/** A finished turn as the server signed it, sent back so that a follow-up keeps its context. */
export interface StoredTurn {
  readonly question: string;
  readonly page: string;
  readonly locale: string;
  readonly signature: string;
  readonly messages: readonly unknown[];
  /** Kept in this tab only, so the thumbs work after a reload; never sent back. */
  readonly traceId?: string;
  /** The plans the answer draws, by handle. Kept in this tab only; never sent back. */
  readonly plans?: Readonly<Record<string, PlanView>>;
}

export interface Conversation {
  readonly sessionId: string;
  readonly turns: readonly StoredTurn[];
}

const KEY = 'gridfinity-docs:ask-ai';
// The server's MAX_TURNS: it refuses a request with more.
export const MAX_TURNS = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTurn(value: unknown): value is StoredTurn {
  return (
    isRecord(value) &&
    typeof value.question === 'string' &&
    typeof value.page === 'string' &&
    typeof value.locale === 'string' &&
    typeof value.signature === 'string' &&
    Array.isArray(value.messages) &&
    (value.traceId === undefined || typeof value.traceId === 'string') &&
    (value.plans === undefined || isRecord(value.plans))
  );
}

export function newConversation(newId: () => string): Conversation {
  return { sessionId: newId(), turns: [] };
}

function readStored(storage: Pick<Storage, 'getItem'> | null): unknown {
  try {
    return JSON.parse(storage?.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function loadConversation(
  storage: Pick<Storage, 'getItem'> | null,
  newId: () => string
): Conversation {
  const stored = readStored(storage);
  if (isRecord(stored) && typeof stored.sessionId === 'string' && Array.isArray(stored.turns))
    return { sessionId: stored.sessionId, turns: stored.turns.filter(isTurn) };
  return newConversation(newId);
}

export function saveConversation(
  storage: Pick<Storage, 'setItem'> | null,
  conversation: Conversation
): void {
  try {
    storage?.setItem(KEY, JSON.stringify(conversation));
  } catch {
    // A full or blocked store keeps the chat for this page only.
  }
}

export function withTurn(conversation: Conversation, turn: StoredTurn): Conversation {
  return { ...conversation, turns: [...conversation.turns, turn].slice(-MAX_TURNS) };
}

export function withoutLastTurn(conversation: Conversation): Conversation {
  return { ...conversation, turns: conversation.turns.slice(0, -1) };
}

function contentBlocks(content: unknown): Record<string, unknown>[] {
  return Array.isArray(content) ? content.filter(isRecord) : [];
}

export function messageText(content: unknown): string {
  return contentBlocks(content)
    .flatMap((block) =>
      block.type === 'text' && typeof block.text === 'string' ? [block.text] : []
    )
    .join('');
}

export function answerText(turn: StoredTurn): string {
  return messageText(turn.messages.at(-1));
}

export function hasToolCall(content: unknown): boolean {
  return contentBlocks(content).some((block) => block.type === 'tool_use');
}
