/** A finished turn as the server signed it, sent back so that a follow-up keeps its context. */
export interface StoredTurn {
  readonly question: string;
  readonly page: string;
  readonly locale: string;
  readonly signature: string;
  readonly messages: readonly unknown[];
  /** Kept in this tab only, so the thumbs work after a reload; never sent back. */
  readonly traceId?: string;
}

export interface Conversation {
  readonly sessionId: string;
  readonly turns: readonly StoredTurn[];
}

const KEY = 'gridfinity-docs:ask-ai';
// The server's MAX_TURNS: it refuses a request with more.
export const MAX_TURNS = 8;

function isTurn(value: unknown): value is StoredTurn {
  if (typeof value !== 'object' || value === null) return false;
  const turn = value as Record<string, unknown>;
  return (
    typeof turn.question === 'string' &&
    typeof turn.page === 'string' &&
    typeof turn.locale === 'string' &&
    typeof turn.signature === 'string' &&
    Array.isArray(turn.messages) &&
    (turn.traceId === undefined || typeof turn.traceId === 'string')
  );
}

export function newConversation(newId: () => string): Conversation {
  return { sessionId: newId(), turns: [] };
}

export function loadConversation(
  storage: Pick<Storage, 'getItem'> | null,
  newId: () => string
): Conversation {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (typeof parsed === 'object' && parsed !== null) {
      const { sessionId, turns } = parsed as Record<string, unknown>;
      if (typeof sessionId === 'string' && Array.isArray(turns))
        return { sessionId, turns: turns.filter(isTurn) };
    }
    return newConversation(newId);
  } catch {
    return newConversation(newId);
  }
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

export function messageText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .flatMap((block: unknown) =>
      typeof block === 'object' &&
      block !== null &&
      (block as { type?: unknown }).type === 'text' &&
      typeof (block as { text?: unknown }).text === 'string'
        ? [(block as { text: string }).text]
        : []
    )
    .join('');
}

export function answerText(turn: StoredTurn): string {
  return messageText(turn.messages.at(-1));
}

export function hasToolCall(content: unknown): boolean {
  return (
    Array.isArray(content) &&
    content.some(
      (block: unknown) =>
        typeof block === 'object' &&
        block !== null &&
        (block as { type?: unknown }).type === 'tool_use'
    )
  );
}
