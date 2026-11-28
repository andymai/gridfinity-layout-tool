import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession } from './session';
import type { BrowserCall, PreparedCall, Session, SessionHost, SessionState } from './session';

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

function start(extra: Partial<SessionHost> = {}): Session {
  return createSession({
    state,
    changed: () => void changes++,
    endpoint: '/api/docs-ask',
    storageKey: KEY,
    storage: () => storage,
    settings: () => ({ analytics: false, locale: 'en' }),
    prepareCalls: (calls) => prepareCalls(calls),
    declinedLabel: (call) => (call.kind === 'change' ? 'Not applied' : 'Not shared'),
    newId: () => 'session-0001',
    ...extra,
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
    if (current) await session.answerRequest(current, { reads: true });
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
    if (current) await session.answerRequest(current, { reads: false });
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
    if (current) await session.answerRequest(current, { reads: true });
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

describe('the app door', () => {
  const change = { type: 'tool_use', id: 'toolu_c', name: 'propose_changes', input: {} };
  const proposal = (): Response =>
    sse([
      ['message', { content: [change] }],
      ['step', { id: 'toolu_c', kind: 'change', state: 'waiting', label: 'Preparing', key: 'k' }],
      ['pending', { calls: [{ id: 'toolu_c', name: 'propose_changes', input: {} }], pending: {} }],
    ]);
  const preview = (extra: Partial<PreparedCall> = {}): PreparedCall[] => [
    {
      id: 'toolu_c',
      kind: 'change',
      title: 'Add a bin',
      preview: null,
      data: { set: 1 },
      unavailable: false,
      ...extra,
    },
  ];

  it('takes a separate yes for the reads of a request that also proposes changes', async () => {
    const read = { type: 'tool_use', id: 'toolu_r', name: 'read_my_layout', input: {} };
    const apply = vi.fn(() => Promise.resolve({ outcome: 'applied', added: {} }));
    prepareCalls = () =>
      Promise.resolve([
        {
          id: 'toolu_r',
          title: 'Your layout',
          preview: 'Layout',
          data: { layout: 'private' },
          unavailable: false,
        },
        ...preview(),
      ]);
    session = start({ door: 'app', apply });
    const mixed = (): Response =>
      sse([
        ['message', { content: [read, change] }],
        [
          'pending',
          {
            calls: [
              { id: 'toolu_r', name: 'read_my_layout', input: {} },
              { id: 'toolu_c', name: 'propose_changes', input: {} },
            ],
            pending: {},
          },
        ],
      ]);

    // Apply alone applies the change and shares nothing.
    fetchMock.mockResolvedValueOnce(mixed());
    await session.ask('Add a bin', 'app/layout');
    await asking();
    fetchMock.mockResolvedValueOnce(answer());
    const first = state.exchanges[0];
    if (first) await session.answerRequest(first, { changes: true });
    expect(apply).toHaveBeenCalledOnce();
    expect(bodyOf(1).results).toEqual([
      { callId: 'toolu_r', status: 'declined' },
      { callId: 'toolu_c', status: 'shared', data: { outcome: 'applied', added: {} } },
    ]);

    // Allow shares the read only when the reader says so for the reads.
    fetchMock.mockResolvedValueOnce(mixed());
    await session.ask('Add another', 'app/layout');
    await asking();
    fetchMock.mockResolvedValueOnce(answer());
    const second = state.exchanges[1];
    if (second) await session.answerRequest(second, { reads: true, changes: false });
    expect(bodyOf(3).results).toEqual([
      { callId: 'toolu_r', status: 'shared', data: { layout: 'private' } },
      { callId: 'toolu_c', status: 'declined' },
    ]);
    expect(apply).toHaveBeenCalledOnce();
  });

  it('names its door, keeps the step key, and sends what Apply returns', async () => {
    const apply = vi.fn((call: PreparedCall) =>
      Promise.resolve({ outcome: 'applied', added: {}, from: call.data })
    );
    prepareCalls = () => Promise.resolve(preview());
    session = start({ door: 'app', apply });
    fetchMock.mockResolvedValueOnce(proposal());
    await session.ask('Add a bin', 'app/layout');
    await asking();
    expect(bodyOf(0)).toMatchObject({ op: 'ask', door: 'app', page: 'app/layout' });
    expect(state.exchanges[0]?.steps[0]).toMatchObject({ kind: 'change', key: 'k' });
    fetchMock.mockResolvedValueOnce(answer());
    const current = state.exchanges[0];
    if (current) await session.answerRequest(current, { changes: true });
    expect(apply).toHaveBeenCalledOnce();
    expect(bodyOf(1)).toMatchObject({
      op: 'resume',
      door: 'app',
      results: [
        { callId: 'toolu_c', status: 'shared', data: { outcome: 'applied', from: { set: 1 } } },
      ],
    });
  });

  describe('a change that applied before its answer failed', () => {
    const applied = { outcome: 'applied', added: {} };

    async function applyThenFail(status: number): Promise<ReturnType<typeof vi.fn>> {
      const apply = vi.fn(() => Promise.resolve(applied));
      prepareCalls = () => Promise.resolve(preview());
      session = start({ door: 'app', apply });
      fetchMock.mockResolvedValueOnce(proposal());
      await session.ask('Add a bin', 'app/layout');
      await asking();
      fetchMock.mockResolvedValueOnce(new Response('{}', { status }));
      const current = state.exchanges[0];
      if (current) await session.answerRequest(current, { changes: true });
      return apply;
    }

    it('says that the changes applied, and Retry gets only the answer', async () => {
      const apply = await applyThenFail(503);
      expect(state.exchanges[0]).toMatchObject({
        status: 'error',
        applied: true,
        notice: 'appliedRetry',
      });
      fetchMock.mockResolvedValueOnce(answer());
      await session.retry('app/layout');
      // The same envelope and results go again: the question is not asked again.
      expect(bodyOf(2)).toMatchObject({
        op: 'resume',
        pending: {},
        results: [{ callId: 'toolu_c', status: 'shared', data: applied }],
      });
      expect(apply).toHaveBeenCalledOnce();
      expect(state.exchanges).toHaveLength(1);
      expect(state.exchanges[0]).toMatchObject({ status: 'done', notice: null });
    });

    it('never asks the question again once the answer cannot come back', async () => {
      const apply = await applyThenFail(410);
      expect(state.exchanges[0]).toMatchObject({ applied: true, notice: 'appliedNoAnswer' });
      await session.retry('app/layout');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(apply).toHaveBeenCalledOnce();
    });
  });

  it('sends a decline without applying, with the host label for a change', async () => {
    const apply = vi.fn(() => Promise.resolve({}));
    prepareCalls = () => Promise.resolve(preview());
    session = start({ door: 'app', apply });
    fetchMock.mockResolvedValueOnce(proposal());
    await session.ask('Add a bin', 'app/layout');
    await asking();
    fetchMock.mockResolvedValueOnce(answer());
    const current = state.exchanges[0];
    if (current) await session.answerRequest(current, { changes: false });
    expect(apply).not.toHaveBeenCalled();
    expect(bodyOf(1).results).toEqual([{ callId: 'toolu_c', status: 'declined' }]);
    expect(state.exchanges[0]?.steps[0]).toMatchObject({ state: 'done', label: 'Not applied' });
    // The step's translation key would still read as "Preparing changes".
    expect(state.exchanges[0]?.steps[0]).not.toHaveProperty('key');
    expect(state.exchanges[0]?.steps[0]).not.toHaveProperty('vars');
  });

  it('sends its door with a thumb too, so the app door switch covers feedback', async () => {
    session = start({ door: 'app' });
    fetchMock.mockResolvedValueOnce(answer());
    await session.ask('Q?', 'app/layout');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const current = state.exchanges[0];
    if (current) session.sendFeedback(current, 1);
    expect(bodyOf(1)).toMatchObject({ op: 'feedback', door: 'app', value: 1 });
  });

  it('does not resume on its own after Stop', async () => {
    prepareCalls = () => Promise.resolve(preview({ settled: { outcome: 'refused', change: 1 } }));
    session = start({ door: 'app' });
    const encoder = new TextEncoder();
    // The stream stays open after pending, as a slow server's would, until the abort.
    fetchMock.mockImplementationOnce((_url, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(stream) {
          stream.enqueue(
            encoder.encode(
              `event: message\ndata: ${JSON.stringify({ content: [change] })}\n\n` +
                `event: pending\ndata: ${JSON.stringify({ calls: [{ id: 'toolu_c', name: 'propose_changes', input: {} }], pending: {} })}\n\n`
            )
          );
          init?.signal?.addEventListener('abort', () =>
            stream.error(new DOMException('Stopped', 'AbortError'))
          );
        },
      });
      return Promise.resolve(new Response(body));
    });
    const asked = session.ask('Add a bin', 'app/layout');
    await vi.waitFor(() => expect(state.exchanges[0]?.request?.state).toBe('asking'));
    session.stop();
    await asked;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops a preparation that ends after New chat, and resumes nothing', async () => {
    let finish: (calls: PreparedCall[]) => void = () => undefined;
    prepareCalls = () => new Promise((resolve) => (finish = resolve));
    session = start({ door: 'app' });
    fetchMock.mockResolvedValueOnce(proposal());
    await session.ask('Add a bin', 'app/layout');
    session.newChat();
    finish(preview({ settled: { outcome: 'refused', change: 1 } }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.exchanges).toEqual([]);
  });

  it('sends a change that the app refused at once, without a question to the reader', async () => {
    prepareCalls = () => Promise.resolve(preview({ settled: { outcome: 'refused', change: 1 } }));
    session = start({ door: 'app' });
    fetchMock.mockResolvedValueOnce(proposal());
    fetchMock.mockResolvedValueOnce(answer());
    await session.ask('Add a bin', 'app/layout');
    await vi.waitFor(() => expect(state.exchanges[0]?.status).toBe('done'));
    expect(bodyOf(1)).toMatchObject({
      op: 'resume',
      results: [{ callId: 'toolu_c', status: 'shared', data: { outcome: 'refused' } }],
    });
  });

  it('leaves the door out of a docs request', async () => {
    fetchMock.mockResolvedValueOnce(answer());
    await session.ask('Q?', '/');
    expect(bodyOf(0)).not.toHaveProperty('door');
  });
});
