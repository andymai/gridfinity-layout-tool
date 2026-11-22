/**
 * The streamed answer: the agent is a stand-in, so these tests cover what the
 * handler does with its result, the turn signature, the trace and a failed
 * spend reservation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import type { AgentOptions, AgentResult } from './lib/docsAsk/agent.js';
import { turnSigned } from './lib/docsAsk/history.js';
import type { StoredTurn } from './lib/docsAsk/history.js';
import type * as Spend from './lib/docsAsk/spend.js';

const mocks = vi.hoisted(() => ({
  runAgent: vi.fn(),
  reserveSpend: vi.fn(),
  sendAskTrace: vi.fn(),
}));

vi.mock('./lib/rateLimit.js', () => ({
  checkRateLimit: () => Promise.resolve({ allowed: true }),
  getRedis: () => ({}),
  getClientIP: () => '203.0.113.1',
}));

vi.mock('./lib/docsAsk/traces.js', () => ({
  sendAskFeedback: vi.fn(),
  sendAskTrace: mocks.sendAskTrace,
}));

vi.mock('./lib/docsAsk/agent.js', () => ({ runAgent: mocks.runAgent }));

vi.mock('./lib/docsAsk/spend.js', async (importOriginal) => ({
  ...(await importOriginal<typeof Spend>()),
  readSpend: () => Promise.resolve(0),
  reserveSpend: mocks.reserveSpend,
  releaseSpend: () => Promise.resolve(),
  addSpend: () => Promise.resolve(),
}));

vi.mock('./lib/docsAsk/source.js', () => ({
  docsSource: () =>
    Promise.resolve({
      corpus: { version: 'test', map: '', pages: {} },
      english: {},
      labels: () => Promise.resolve({}),
      locale: (requested: string) => requested,
    }),
}));

function streamResponse() {
  const events: { event: string; data: Record<string, unknown> }[] = [];
  const res = {
    headersSent: false,
    writableEnded: false,
    status() {
      return res;
    },
    json() {
      return res;
    },
    setHeader() {
      return res;
    },
    writeHead() {
      res.headersSent = true;
      return res;
    },
    write(chunk: string) {
      const [, event, data] = /^event: (\w+)\ndata: (.*)\n\n$/s.exec(chunk) ?? [];
      if (event && data) events.push({ event, data: JSON.parse(data) as Record<string, unknown> });
      return true;
    },
    on() {
      return res;
    },
    end() {
      res.writableEnded = true;
      return res;
    },
  };
  return { res: res as unknown as VercelResponse, events };
}

async function ask(analytics = false) {
  const { res, events } = streamResponse();
  const mod = await import('./docs-ask.js');
  const body = {
    op: 'ask',
    sessionId: 'abc12345-tab',
    question: 'How do layers work?',
    page: '/layouts/layers',
    locale: 'en',
    turns: [],
    analytics,
  };
  await mod.default(
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      on: vi.fn(),
    } as unknown as VercelRequest,
    res
  );
  return events;
}

const result = (answer: string): AgentResult => ({
  answer,
  steps: ['Reading Layouts › Work in layers'],
  links: ['/layouts/layers'],
  generations: [],
  stopReason: 'end_turn',
});

describe('docs-ask streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DOCS_ASSISTANT_ENABLED', 'true');
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('TOKEN_SALT', 'salt');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('signs a turn over the messages that it streamed, and not a turn without an answer', async () => {
    const content = [{ type: 'text', text: 'Layers stack bins.' }];
    mocks.runAgent.mockImplementationOnce((options: AgentOptions) => {
      options.send({ type: 'message', content } as never);
      return Promise.resolve(result('Layers stack bins.'));
    });
    const events = await ask();
    expect(events.find((e) => e.event === 'message')?.data).toMatchObject({ content });
    const turn = events.find((e) => e.event === 'done')?.data.turn as StoredTurn;
    const key = createHmac('sha256', 'salt').update('docs-ask turn signature').digest('hex');
    expect(turnSigned(key, { ...turn, messages: [content] })).toBe(true);
    expect(turnSigned(key, { ...turn, messages: [[{ type: 'text', text: 'Changed.' }]] })).toBe(
      false
    );

    mocks.runAgent.mockResolvedValueOnce(result(''));
    const empty = (await ask()).find((e) => e.event === 'done');
    expect(empty?.data.turn).toMatchObject({ signature: null });
  });

  it('answers a failed spend reservation with an error, not the resting notice', async () => {
    mocks.reserveSpend.mockRejectedValue(new Error('redis down'));
    mocks.runAgent.mockImplementation(async (options: AgentOptions) => {
      await options.budget.reserve();
      return result('never');
    });
    const events = await ask();
    expect(events.map((e) => e.event)).toEqual(['start', 'error']);
    expect(events[1]?.data).toEqual({ code: 'failed' });
  });

  it('sends a trace with the pages read only when the reader allows analytics', async () => {
    mocks.runAgent.mockImplementation((options: AgentOptions) => {
      options.progress.links.push('/layouts/layers');
      return Promise.resolve(result('Layers stack bins.'));
    });
    await ask(false);
    expect(mocks.sendAskTrace).not.toHaveBeenCalled();
    await ask(true);
    expect(mocks.sendAskTrace).toHaveBeenCalledWith(
      expect.objectContaining({ links: ['/layouts/layers'], answer: 'Layers stack bins.' })
    );
  });
});
