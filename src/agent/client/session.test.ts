import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession } from './session';
import type { BrowserCall, PreparedCall, Session, SessionState } from './session';

const KEY = 'test:ask-ai';

const sse = (events: [string, unknown][]): Response =>
  new Response(events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
const call = { type: 'tool_use', id: 'toolu_r', name: 'read_my_layout', input: {} };
const pending = (): Response =>
  sse([
    ['start', { traceId: '00000000-0000-4000-8000-000000000001' }],
    ['message', { content: [call] }],
    ['step', { id: 'toolu_r', kind: 'yours', state: 'waiting', label: 'Reading your layout' }],
    [
      'pending',
      { calls: [{ id: 'toolu_r', name: 'read_my_layout', input: {} }], pending: { n: 1 } },
    ],
  ]);
const answer = (results?: unknown, text = 'Your Desk layout.'): Response =>
  sse([
    ['start', { traceId: '00000000-0000-4000-8000-000000000002' }],
    ['message', { content: [{ type: 'text', text }] }],
    [
      'done',
      {
        turn: { question: 'Q?', page: '/', locale: 'en', results, signature: 'a'.repeat(64) },
      },
    ],
  ]);

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

const fetchMock = vi.fn<typeof fetch>();
const bodyOf = (n: number): Record<string, unknown> =>
  JSON.parse(fetchMock.mock.calls[n]?.[1]?.body as string) as Record<string, unknown>;

let storage: Storage;
let state: SessionState;
let changes: number;
let session: Session;
let prepareCalls: (calls: readonly BrowserCall[]) => Promise<PreparedCall[]>;

function start(): Session {
  return createSession({
    state,
    changed: () => void changes++,
    endpoint: '/api/docs-ask',
    storageKey: KEY,
    storage: () => storage,
    settings: () => ({ analytics: false, locale: 'en' }),
    prepareCalls: (calls) => prepareCalls(calls),
    declinedLabel: 'Not shared',
    newId: () => 'session-0001',
  });
}

async function asking(): Promise<void> {
  await vi.waitFor(() => expect(state.exchanges.at(-1)?.request?.state).toBe('asking'));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  storage = memory();
  state = { resting: false, full: false, exchanges: [] };
  changes = 0;
  prepareCalls = (calls) =>
    Promise.resolve(
      calls.map((c) => ({
        id: c.id,
        title: 'Your layout “Desk”',
        preview: 'Layout "Desk".',
        data: { layout: null },
        unavailable: false,
      }))
    );
  session = start();
});

describe('createSession', () => {
  it('streams an answer into a plain state, tells the host of each change, and keeps the turn', async () => {
    fetchMock.mockResolvedValueOnce(answer());
    await session.ask('  Q?  ', '/layouts/placing-bins');
    expect(bodyOf(0)).toMatchObject({
      op: 'ask',
      sessionId: 'session-0001',
      question: 'Q?',
      page: '/layouts/placing-bins',
      locale: 'en',
      turns: [],
      analytics: false,
    });
    expect(state.exchanges[0]).toMatchObject({
      status: 'done',
      text: 'Your Desk layout.',
      traceId: '00000000-0000-4000-8000-000000000002',
      stored: true,
    });
    expect(changes).toBeGreaterThan(3);
    const stored = JSON.parse(storage.getItem(KEY) ?? '{}') as { turns: unknown[] };
    expect(stored.turns).toHaveLength(1);
    expect(session.busy()).toBe(false);
  });

  it('asks, sends what the reader allowed with the envelope, and keeps the whole turn', async () => {
    fetchMock.mockResolvedValueOnce(pending());
    await session.ask('Q?', '/');
    await asking();
    const current = state.exchanges[0];
    expect(current?.status).toBe('asking');
    fetchMock.mockImplementationOnce((_url, init) =>
      Promise.resolve(answer((JSON.parse(init?.body as string) as { results: unknown }).results))
    );
    if (current) await session.answerRequest(current, true);
    expect(bodyOf(1)).toMatchObject({
      op: 'resume',
      pending: { n: 1 },
      results: [{ callId: 'toolu_r', status: 'shared', data: { layout: null } }],
    });
    expect(state.exchanges[0]).toMatchObject({ status: 'done', personal: true, request: null });
    const stored = JSON.parse(storage.getItem(KEY) ?? '{}') as {
      turns: { messages: unknown[]; results: unknown[] }[];
    };
    expect(stored.turns[0]?.messages).toHaveLength(2);
    expect(stored.turns[0]?.results).toEqual([
      { callId: 'toolu_r', status: 'shared', data: { layout: null } },
    ]);
  });

  it('sends only a decline, with the host label on the step', async () => {
    fetchMock.mockResolvedValueOnce(pending());
    await session.ask('Q?', '/');
    await asking();
    fetchMock.mockResolvedValueOnce(answer([{ callId: 'toolu_r', status: 'declined' }]));
    const current = state.exchanges[0];
    if (current) await session.answerRequest(current, false);
    expect(bodyOf(1).results).toEqual([{ callId: 'toolu_r', status: 'declined' }]);
    expect(state.exchanges[0]?.personal).toBe(false);
    expect(state.exchanges[0]?.steps[0]).toMatchObject({ state: 'done', label: 'Not shared' });
  });

  it('marks every call unavailable when the host cannot prepare them', async () => {
    prepareCalls = () => Promise.reject(new Error('no storage'));
    fetchMock.mockResolvedValueOnce(pending());
    await session.ask('Q?', '/');
    await asking();
    expect(state.exchanges[0]?.request?.calls).toEqual([
      { id: 'toolu_r', title: '', preview: null, data: null, unavailable: true },
    ]);
  });

  it('leaves a waiting request behind when the reader asks something else', async () => {
    fetchMock.mockResolvedValueOnce(pending());
    await session.ask('Q?', '/');
    await asking();
    fetchMock.mockResolvedValueOnce(answer());
    await session.ask('Other?', '/');
    expect(state.exchanges[0]).toMatchObject({ status: 'stopped', request: null });
    expect(state.exchanges[0]?.steps[0]?.state).toBe('error');
  });

  it('gives a code for each failure, for the panel to word', async () => {
    fetchMock.mockResolvedValueOnce(pending());
    await session.ask('Q?', '/');
    await asking();
    fetchMock.mockResolvedValueOnce(new Response('{"code":"EXPIRED"}', { status: 410 }));
    const current = state.exchanges[0];
    if (current) await session.answerRequest(current, true);
    expect(state.exchanges[0]).toMatchObject({ status: 'error', request: null, notice: 'expired' });

    fetchMock.mockResolvedValueOnce(new Response('{"code":"RESTING"}', { status: 429 }));
    await session.ask('Again?', '/');
    expect(state.exchanges[1]?.notice).toBe('resting');
    expect(state.resting).toBe(true);

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    await session.ask('Third?', '/');
    expect(state.exchanges[2]?.notice).toBe('rateLimited');

    fetchMock.mockResolvedValueOnce(sse([['error', { code: 'busy' }]]));
    await session.ask('Fourth?', '/');
    expect(state.exchanges[3]).toMatchObject({ status: 'error', notice: 'busy' });
  });

  it('restores the kept chat once, with links to this site only after a turn that shared data', () => {
    storage.setItem(
      KEY,
      JSON.stringify({
        sessionId: 'kept-0001',
        turns: [
          {
            question: 'Mine?',
            page: '/',
            locale: 'en',
            signature: 'b'.repeat(64),
            messages: [[{ type: 'text', text: 'Yours.' }]],
            results: [{ callId: 'c', status: 'shared', data: {} }],
          },
          {
            question: 'Then?',
            page: '/',
            locale: 'en',
            signature: 'c'.repeat(64),
            messages: [[{ type: 'text', text: 'Next.' }]],
          },
        ],
      })
    );
    session.restore();
    expect(state.exchanges.map((e) => [e.question, e.text, e.personal, e.status])).toEqual([
      ['Mine?', 'Yours.', true, 'done'],
      ['Then?', 'Next.', true, 'done'],
    ]);
    session.restore();
    expect(state.exchanges).toHaveLength(2);
  });

  it('retries the last question without its stored turn, and starts a new chat', async () => {
    fetchMock.mockResolvedValueOnce(answer(undefined, 'First.'));
    await session.ask('Q?', '/');
    fetchMock.mockResolvedValueOnce(answer(undefined, 'Second.'));
    await session.retry('/');
    expect(bodyOf(1).turns).toEqual([]);
    expect(state.exchanges.map((e) => e.text)).toEqual(['Second.']);
    session.newChat();
    expect(state.exchanges).toEqual([]);
    expect(JSON.parse(storage.getItem(KEY) ?? '{}')).toEqual({
      sessionId: 'session-0001',
      turns: [],
    });
  });

  it('sends a thumb once for each value', async () => {
    fetchMock.mockResolvedValueOnce(answer());
    await session.ask('Q?', '/');
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const current = state.exchanges[0];
    if (!current) throw new Error('no exchange');
    session.sendFeedback(current, 1);
    session.sendFeedback(current, 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOf(1)).toMatchObject({
      op: 'feedback',
      traceId: '00000000-0000-4000-8000-000000000002',
      value: 1,
    });
    expect(current.feedback).toBe(1);
  });
});
