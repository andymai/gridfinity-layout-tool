import type { PlanView } from '@/agent/contract';
/** A finished turn as the server signed it, sent back so that a follow-up keeps its context. */
export interface StoredTurn {
  readonly question: string;
  readonly page: string;
  readonly locale: string;
  readonly signature: string;
  readonly messages: readonly unknown[];
  /** What the reader's browser sent for the turn's reads, as the server signed it. */
  readonly results?: readonly unknown[];
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

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function isPlanBin(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.label === 'string' &&
    typeof value.color === 'string' &&
    [value.x, value.y, value.width, value.depth, value.layer].every(isNumber)
  );
}

function isStashedBin(value: unknown): boolean {
  return isRecord(value) && typeof value.label === 'string' && typeof value.reason === 'string';
}

// The map puts the link in an href, so only a web link passes.
export function isPlanView(value: unknown): value is PlanView {
  return (
    isRecord(value) &&
    typeof value.handle === 'string' &&
    typeof value.title === 'string' &&
    typeof value.link === 'string' &&
    /^https?:\/\//.test(value.link) &&
    isRecord(value.grid) &&
    isNumber(value.grid.width) &&
    isNumber(value.grid.depth) &&
    Array.isArray(value.bins) &&
    value.bins.every(isPlanBin) &&
    Array.isArray(value.stashed) &&
    value.stashed.every(isStashedBin)
  );
}

// A plan stored by an older deploy may have another shape. Only the plan is
// dropped, so a follow-up keeps the turn's context.
function withValidPlans(turn: StoredTurn): StoredTurn {
  if (turn.plans === undefined) return turn;
  return {
    ...turn,
    plans: Object.fromEntries(Object.entries(turn.plans).filter(([, plan]) => isPlanView(plan))),
  };
}

function isTurn(value: unknown): value is StoredTurn {
  return (
    isRecord(value) &&
    typeof value.question === 'string' &&
    typeof value.page === 'string' &&
    typeof value.locale === 'string' &&
    typeof value.signature === 'string' &&
    Array.isArray(value.messages) &&
    (value.results === undefined || Array.isArray(value.results)) &&
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
    return { sessionId: stored.sessionId, turns: stored.turns.filter(isTurn).map(withValidPlans) };
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

/** The turn holds the reader's own data, so its answer may link only to this site. */
export function sharedData(turn: Pick<StoredTurn, 'results'>): boolean {
  return (turn.results ?? []).some((result) => isRecord(result) && result.status === 'shared');
}
