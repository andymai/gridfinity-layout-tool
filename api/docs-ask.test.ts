/**
 * The gates in front of Ask AI: the kill switch, the origin check, the body
 * checks, the per-IP limit and the daily spend cap, each before any model call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  sendAskFeedback: vi.fn(),
}));

vi.mock('./lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
}));

vi.mock('./lib/docsAsk/traces.js', () => ({
  sendAskFeedback: mocks.sendAskFeedback,
  sendAskTrace: vi.fn(),
}));

function createResponse() {
  const res = {
    _status: 0,
    _body: null as unknown,
    headersSent: false,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
    setHeader() {
      return res;
    },
    end() {
      return res;
    },
  };
  return res as unknown as VercelResponse & { _status: number; _body: unknown };
}

async function handle(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
  query: Record<string, string> = {}
) {
  const res = createResponse();
  const mod = await import('./docs-ask.js');
  const sent = method === 'POST' ? { 'content-type': 'application/json', ...headers } : headers;
  await mod.default(
    { method, headers: sent, body, query, on: vi.fn() } as unknown as VercelRequest,
    res
  );
  return res;
}

const question = {
  op: 'ask',
  sessionId: 'abc12345-tab',
  question: 'How do layers work?',
  page: '/layouts/layers',
  locale: 'en',
  turns: [],
};

describe('docs-ask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DOCS_ASSISTANT_ENABLED', 'true');
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('VERCEL_ENV', 'preview');
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.getRedis.mockReturnValue({ get: vi.fn().mockResolvedValue('0') });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('reports itself off without the switch or a key, and asks nothing', async () => {
    vi.stubEnv('DOCS_ASSISTANT_ENABLED', 'false');
    expect((await handle('GET'))._body).toEqual({ enabled: false, resting: false });
    expect((await handle('POST', question))._status).toBe(503);
    vi.stubEnv('DOCS_ASSISTANT_ENABLED', 'true');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect((await handle('POST', question))._status).toBe(503);
  });

  it('reports resting once the day reaches the cap', async () => {
    vi.stubEnv('DOCS_ASSISTANT_DAILY_CAP_USD', '5');
    mocks.getRedis.mockReturnValue({ get: vi.fn().mockResolvedValue('5.01') });
    expect((await handle('GET'))._body).toEqual({ enabled: true, resting: true });
    const res = await handle('POST', question);
    expect(res._status).toBe(429);
    expect(res._body).toMatchObject({ code: 'RESTING' });
  });

  it('refuses another site', async () => {
    const res = await handle('POST', question, {
      origin: 'https://example.com',
      host: 'gridfinitylayouttool.com',
    });
    expect(res._status).toBe(403);
    expect((await handle('POST', question, { origin: 'not a url' }))._status).toBe(403);
  });

  it('takes a request from the host that served the page, a branch alias too', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    vi.stubEnv('VERCEL_ENV', 'preview');
    const alias = 'gridfinity-layout-tool-git-feat-docs-764d1f-collective-context.vercel.app';
    const res = await handle('POST', question, { origin: `https://${alias}`, host: alias });
    expect(res._status).toBe(429);
  });

  it('refuses a body that is too large or malformed', async () => {
    expect((await handle('POST', question, { 'content-length': String(600 * 1024) }))._status).toBe(
      413
    );
    expect((await handle('POST', { ...question, padding: 'x'.repeat(600 * 1024) }))._status).toBe(
      413
    );
    expect((await handle('POST', { ...question, question: '' }))._status).toBe(400);
    expect((await handle('POST', { ...question, turns: 'nope' }))._status).toBe(400);
  });

  it('limits each IP, a malformed question too', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const res = await handle('POST', question);
    expect(res._status).toBe(429);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('203.0.113.1', 'docs.ask');
    expect((await handle('POST', { ...question, question: '' }))._status).toBe(429);
  });

  it('takes JSON only', async () => {
    expect((await handle('POST', question, { 'content-type': 'text/plain' }))._status).toBe(415);
  });

  it('lets a local docs site call it outside production only', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    expect((await handle('POST', question, { origin: 'http://localhost:5173' }))._status).toBe(429);
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await handle('POST', question, { origin: 'http://localhost:5173' }))._status).toBe(403);
  });

  it('sends a thumb on the trace only when the reader allows analytics', async () => {
    const thumb = {
      op: 'feedback',
      sessionId: 'abc12345-tab',
      traceId: '3f2b8c1e-5d4a-4c3b-9a2e-1f0e9d8c7b6a',
      value: -1,
    };
    expect((await handle('POST', thumb))._status).toBe(204);
    expect((await handle('POST', { ...thumb, analytics: false }))._status).toBe(204);
    expect(mocks.sendAskFeedback).not.toHaveBeenCalled();
    expect((await handle('POST', { ...thumb, analytics: true }))._status).toBe(204);
    expect(mocks.sendAskFeedback).toHaveBeenCalledWith(
      'abc12345-tab',
      '3f2b8c1e-5d4a-4c3b-9a2e-1f0e9d8c7b6a',
      -1
    );
  });

  it('gives the app door its own switch, cap and limit', async () => {
    const app = { ...question, door: 'app', page: 'app/layout' };
    expect((await handle('GET', undefined, {}, { door: 'app' }))._body).toEqual({
      enabled: false,
      resting: false,
    });
    expect((await handle('POST', app))._status).toBe(503);
    vi.stubEnv('APP_ASSISTANT_ENABLED', 'true');
    vi.stubEnv('APP_ASSISTANT_DAILY_CAP_USD', '2');
    const get = vi.fn((key: string) => Promise.resolve(key.startsWith('appAsk:') ? '2.5' : '0'));
    mocks.getRedis.mockReturnValue({ get });
    expect((await handle('GET', undefined, {}, { door: 'app' }))._body).toEqual({
      enabled: true,
      resting: true,
    });
    expect((await handle('GET'))._body).toEqual({ enabled: true, resting: false });
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    expect((await handle('POST', app))._status).toBe(429);
    expect(mocks.checkRateLimit).toHaveBeenLastCalledWith('203.0.113.1', 'app.ask');
  });

  it('answers other methods with 405', async () => {
    expect((await handle('DELETE'))._status).toBe(405);
  });
});
