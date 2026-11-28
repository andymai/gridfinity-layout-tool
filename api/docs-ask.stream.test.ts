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
import type * as ClientToolsModule from './lib/docsAsk/clientTools.js';
import { pendingSignature } from './lib/docsAsk/pending.js';

const mocks = vi.hoisted(() => {
  const held = new Set<string>();
  return {
    runAgent: vi.fn(),
    reserveSpend: vi.fn(),
    sendAskTrace: vi.fn(),
    held,
    set: (key: string) => {
      if (held.has(key)) return Promise.resolve(null);
      held.add(key);
      return Promise.resolve('OK');
    },
  };
});

vi.mock('./lib/rateLimit.js', () => ({
  checkRateLimit: () => Promise.resolve({ allowed: true }),
  getRedis: () => ({ set: mocks.set }),
  getClientIP: () => '203.0.113.1',
}));

vi.mock('./lib/docsAsk/clientTools.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ClientToolsModule>();
  const { z } = await import('zod');
  const layoutTool: ClientToolsModule.ClientTool = {
    kind: 'read',
    label: () => 'Reading your layout',
    step: { key: 'readLayout' },
    output: z.object({ name: z.string() }).strict(),
    format: (data) => `The layout is ${(data as { name: string }).name}.`,
  };
  const docs = new Map([['read_my_layout', layoutTool]]);
  const app = new Map([...docs, ['propose_changes', { ...layoutTool, kind: 'change' as const }]]);
  return {
    ...actual,
    CLIENT_TOOLS: docs,
    clientToolsFor: (door: string) => (door === 'app' ? app : docs),
  };
});

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
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
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
  return { res: res as unknown as VercelResponse, events, sent: res };
}

async function post(body: Record<string, unknown>) {
  const { res, events, sent } = streamResponse();
  const mod = await import('./docs-ask.js');
  await mod.default(
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      on: vi.fn(),
    } as unknown as VercelRequest,
    res
  );
  return { events, status: sent.statusCode, body: sent.body };
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
  pending: null,
});

const key = (purpose: string): string => createHmac('sha256', 'salt').update(purpose).digest('hex');
const questionFor = (door: string) => ({
  door,
  sessionId: 'abc12345-tab',
  question: 'Add a bin for M3 screws.',
  page: door === 'app' ? 'app/layout' : '/layouts/layers',
  locale: 'en',
  turns: [],
});
const browserCall = { type: 'tool_use', id: 'toolu_b', name: 'read_my_layout', input: {} };

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

  it('ends a turn that calls a browser tool with a signed pending envelope and no done', async () => {
    mocks.runAgent.mockImplementationOnce((options: AgentOptions) => {
      options.send({ type: 'message', content: [browserCall] } as never);
      return Promise.resolve({
        ...result(''),
        pending: { calls: [{ id: 'toolu_b', name: 'read_my_layout', input: {} }], rounds: 1 },
      });
    });
    const { events } = await post({
      op: 'ask',
      sessionId: 'abc12345-tab',
      question: 'What is in my drawer?',
      page: '/layouts/layers',
      locale: 'en',
      turns: [],
    });
    expect(events.map((e) => e.event)).toEqual(['start', 'message', 'pending']);
    const { pending, calls } = events[2]?.data as {
      pending: Record<string, unknown> & { signature: string };
      calls: unknown[];
    };
    expect(calls).toEqual([{ id: 'toolu_b', name: 'read_my_layout', input: {} }]);
    expect(pending).toMatchObject({ messages: [[browserCall]], results: [], rounds: 1 });
    const { signature, ...fields } = pending;
    expect(signature).toBe(pendingSignature(key('docs-ask pending signature'), fields as never));
  });

  describe('resume', () => {
    const shared = { callId: 'toolu_b', status: 'shared', data: { name: 'Desk' } };
    function envelope(overrides: Record<string, unknown> = {}) {
      const fields = {
        question: 'What is in my drawer?',
        page: '/layouts/layers',
        locale: 'en',
        messages: [[browserCall]],
        results: [],
        rounds: 1,
        issuedAt: Date.now(),
        nonce: crypto.randomUUID(),
        ...overrides,
      };
      return { ...fields, signature: pendingSignature(key('docs-ask pending signature'), fields) };
    }
    const resume = (pending: unknown, results: unknown[] = [shared]) =>
      post({ op: 'resume', sessionId: 'abc12345-tab', pending, results, turns: [] });

    it('answers the browser call with its result, goes on, and signs the whole turn', async () => {
      const final = [{ type: 'text', text: 'Your Desk layout.' }];
      mocks.runAgent.mockImplementationOnce((options: AgentOptions) => {
        expect(options.firstRound).toBe(1);
        expect(options.messages.at(-1)).toEqual({
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu_b', content: 'The layout is Desk.' },
          ],
        });
        options.send({ type: 'message', content: final } as never);
        return Promise.resolve(result('Your Desk layout.'));
      });
      const { events } = await resume(envelope());
      const turn = events.find((e) => e.event === 'done')?.data.turn as StoredTurn;
      expect(turn.results).toEqual([shared]);
      expect(
        turnSigned(key('docs-ask turn signature'), { ...turn, messages: [[browserCall], final] })
      ).toBe(true);
    });

    it('runs one envelope once', async () => {
      mocks.runAgent.mockResolvedValue(result('Once.'));
      const pending = envelope();
      expect((await resume(pending)).status).toBe(200);
      const again = await resume(pending);
      expect(again.status).toBe(409);
      expect(mocks.runAgent).toHaveBeenCalledTimes(1);
    });

    it('refuses an edited, expired or unmatched envelope before it claims the nonce', async () => {
      const pending = envelope();
      expect((await resume({ ...pending, rounds: 0 })).status).toBe(400);
      expect((await resume({ ...pending, question: 'Other?' })).status).toBe(400);
      expect((await resume(envelope({ issuedAt: Date.now() - 16 * 60 * 1000 }))).status).toBe(410);
      expect((await resume(pending, [{ ...shared, callId: 'toolu_x' }])).status).toBe(400);
      expect((await resume(pending, [shared, shared])).status).toBe(400);
      expect(
        (await resume(pending, [shared, { callId: 'toolu_x', status: 'declined' }])).status
      ).toBe(400);
      expect(
        (await resume(pending, [{ callId: 'toolu_b', status: 'shared', data: { name: 7 } }])).status
      ).toBe(400);
      expect(mocks.runAgent).not.toHaveBeenCalled();
      mocks.runAgent.mockResolvedValueOnce(result('Now.'));
      expect((await resume(pending)).status).toBe(200);
    });
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

  describe('the app door', () => {
    it('stays off until its own switch is on, apart from the docs switch', async () => {
      const off = await post({ ...questionFor('app'), op: 'ask' });
      expect(off.status).toBe(503);
      vi.stubEnv('APP_ASSISTANT_ENABLED', 'true');
      vi.stubEnv('DOCS_ASSISTANT_ENABLED', 'false');
      mocks.runAgent.mockResolvedValueOnce(result('Done.'));
      expect((await post({ ...questionFor('app'), op: 'ask' })).status).toBe(200);
      expect((await post({ ...questionFor('docs'), op: 'ask' })).status).toBe(503);
    });

    it('lists propose_changes, runs the app client tools, and signs with its own keys', async () => {
      vi.stubEnv('APP_ASSISTANT_ENABLED', 'true');
      const content = [{ type: 'text', text: 'Added.' }];
      let seen: AgentOptions | null = null;
      mocks.runAgent.mockImplementationOnce((options: AgentOptions) => {
        seen = options;
        options.send({ type: 'message', content } as never);
        return Promise.resolve(result('Added.'));
      });
      const { events } = await post({ ...questionFor('app'), op: 'ask' });
      const options = seen as AgentOptions | null;
      expect(options?.tools.map((tool) => ('name' in tool ? tool.name : ''))).toContain(
        'propose_changes'
      );
      expect(options?.clientTools?.has('propose_changes')).toBe(true);
      expect(JSON.stringify(options?.messages.at(-1))).toContain('The reader is in the app');
      const turn = events.find((e) => e.event === 'done')?.data.turn as StoredTurn;
      const signed = { ...turn, messages: [content] };
      expect(turnSigned(key('app-ask turn signature'), signed)).toBe(true);
      expect(turnSigned(key('docs-ask turn signature'), signed)).toBe(false);
    });

    it('drops a docs turn from an app chat, so a turn cannot cross doors', async () => {
      vi.stubEnv('APP_ASSISTANT_ENABLED', 'true');
      const content = [{ type: 'text', text: 'Layers stack bins.' }];
      mocks.runAgent.mockImplementationOnce((options: AgentOptions) => {
        options.send({ type: 'message', content } as never);
        return Promise.resolve(result('Layers stack bins.'));
      });
      const docsTurn = (await ask()).find((e) => e.event === 'done')?.data.turn as StoredTurn;
      let length = -1;
      mocks.runAgent.mockImplementationOnce((options: AgentOptions) => {
        length = options.messages.length;
        return Promise.resolve(result('Fresh.'));
      });
      const replay = { ...docsTurn, messages: [content] };
      expect((await post({ ...questionFor('app'), op: 'ask', turns: [replay] })).status).toBe(200);
      expect(length).toBe(2);
    });
  });
});
