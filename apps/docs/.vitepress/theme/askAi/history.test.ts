import { describe, expect, it } from 'vitest';
import {
  MAX_TURNS,
  answerText,
  loadConversation,
  messageText,
  saveConversation,
  withTurn,
  withoutLastTurn,
} from './history';
import type { StoredTurn } from './history';

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  };
}

const turn = (question: string): StoredTurn => ({
  question,
  page: '/layouts/layers',
  locale: 'en',
  signature: 'a'.repeat(64),
  messages: [
    [{ type: 'thinking', thinking: '', signature: 's' }],
    [
      { type: 'text', text: 'Yes.' },
      { type: 'text', text: ' Two.' },
    ],
  ],
});

describe('the conversation store', () => {
  it('starts a new chat when nothing is stored, or the entry is broken', () => {
    const storage = memory();
    expect(loadConversation(storage, () => 'id-1')).toEqual({ sessionId: 'id-1', turns: [] });
    storage.setItem('gridfinity-docs:ask-ai', '{not json');
    expect(loadConversation(storage, () => 'id-2').sessionId).toBe('id-2');
  });

  it('keeps the chat through a reload, and drops a turn that lost its fields', () => {
    const storage = memory();
    saveConversation(storage, {
      sessionId: 'id-1',
      turns: [turn('A?'), { question: 'B?' } as never],
    });
    expect(loadConversation(storage, () => 'new').turns.map((t) => t.question)).toEqual(['A?']);
  });

  it('keeps the last turns the server takes, and drops the last one for a retry', () => {
    let chat = { sessionId: 'id', turns: [] as readonly StoredTurn[] };
    for (let i = 0; i < MAX_TURNS + 2; i++) chat = withTurn(chat, turn(`Q${i}?`));
    expect(chat.turns).toHaveLength(MAX_TURNS);
    expect(chat.turns[0]?.question).toBe('Q2?');
    expect(withoutLastTurn(chat).turns.at(-1)?.question).toBe(`Q${MAX_TURNS}?`);
  });

  it('reads the answer text from the last message', () => {
    expect(answerText(turn('A?'))).toBe('Yes. Two.');
  });

  it('reads the text blocks of one message, and nothing from other shapes', () => {
    expect(
      messageText([{ type: 'text', text: 'A' }, { type: 'tool_use' }, { type: 'text', text: 'B' }])
    ).toBe('AB');
    expect(messageText('nope')).toBe('');
  });
});
