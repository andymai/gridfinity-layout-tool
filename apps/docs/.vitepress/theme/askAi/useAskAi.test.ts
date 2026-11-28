// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { answerRequest, ask, askAi, newChat, noticeText } from './useAskAi';

vi.mock('./reads', () => ({
  prepareRead: (call: { id: string }) =>
    Promise.resolve({
      id: call.id,
      title: 'Your layout “Desk”',
      preview: 'Layout "Desk".',
      data: { layout: null },
      unavailable: false,
    }),
}));

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
const answer = (results: unknown): Response =>
  sse([
    ['message', { content: [{ type: 'text', text: 'Your Desk layout.' }] }],
    [
      'done',
      {
        turn: { question: 'Q?', page: '/', locale: 'en', results, signature: 'a'.repeat(64) },
      },
    ],
  ]);

const fetchMock = vi.fn<typeof fetch>();
const bodyOf = (n: number): Record<string, unknown> =>
  JSON.parse(String(fetchMock.mock.calls[n]?.[1]?.body)) as Record<string, unknown>;

async function settled(): Promise<void> {
  await vi.waitFor(() => expect(askAi.exchanges.at(-1)?.request?.state).toBe('asking'));
}

describe('reads of the reader data', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    newChat();
  });

  it('asks, sends what the reader allowed with the envelope, and keeps the whole turn', async () => {
    fetchMock.mockResolvedValueOnce(pending());
    await ask('Q?', '/');
    await settled();
    const current = askAi.exchanges[0];
    expect(current?.status).toBe('asking');
    fetchMock.mockImplementationOnce((_url, init) =>
      Promise.resolve(answer((JSON.parse(String(init?.body)) as { results: unknown }).results))
    );
    if (current) await answerRequest(current, true);
    expect(bodyOf(1)).toMatchObject({
      op: 'resume',
      pending: { n: 1 },
      results: [{ callId: 'toolu_r', status: 'shared', data: { layout: null } }],
    });
    expect(askAi.exchanges[0]).toMatchObject({ status: 'done', personal: true, request: null });
    const stored = JSON.parse(sessionStorage.getItem('gridfinity-docs:ask-ai') ?? '{}') as {
      turns: { messages: unknown[]; results: unknown[] }[];
    };
    expect(stored.turns[0]?.messages).toHaveLength(2);
    expect(stored.turns[0]?.results).toEqual([
      { callId: 'toolu_r', status: 'shared', data: { layout: null } },
    ]);
  });

  it('keeps links to this site only for the rest of a chat that shared data', async () => {
    fetchMock.mockResolvedValueOnce(pending());
    await ask('Q?', '/');
    await settled();
    fetchMock.mockResolvedValueOnce(answer([{ callId: 'toolu_r', status: 'shared', data: {} }]));
    const current = askAi.exchanges[0];
    if (current) await answerRequest(current, true);
    fetchMock.mockResolvedValueOnce(answer(undefined));
    await ask('And then?', '/');
    expect(askAi.exchanges[1]?.personal).toBe(true);
  });

  it('sends only a decline when the reader does not allow it', async () => {
    fetchMock.mockResolvedValueOnce(pending());
    await ask('Q?', '/');
    await settled();
    fetchMock.mockResolvedValueOnce(answer([{ callId: 'toolu_r', status: 'declined' }]));
    const current = askAi.exchanges[0];
    if (current) await answerRequest(current, false);
    expect(bodyOf(1).results).toEqual([{ callId: 'toolu_r', status: 'declined' }]);
    expect(askAi.exchanges[0]?.personal).toBe(false);
  });

  it('leaves a waiting request behind when the reader asks something else', async () => {
    fetchMock.mockResolvedValueOnce(pending());
    await ask('Q?', '/');
    await settled();
    fetchMock.mockResolvedValueOnce(answer(undefined));
    await ask('Other?', '/');
    expect(askAi.exchanges[0]).toMatchObject({ status: 'stopped', request: null });
    expect(askAi.exchanges[0]?.steps[0]?.state).toBe('error');
  });

  it('says that a request waited too long', async () => {
    fetchMock.mockResolvedValueOnce(pending());
    await ask('Q?', '/');
    await settled();
    fetchMock.mockResolvedValueOnce(new Response('{"code":"EXPIRED"}', { status: 410 }));
    const current = askAi.exchanges[0];
    if (current) await answerRequest(current, true);
    expect(askAi.exchanges[0]).toMatchObject({ status: 'error', request: null });
    expect(noticeText(askAi.exchanges[0]?.notice ?? null)).toContain('waited too long');
  });
});
