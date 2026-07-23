/**
 * Tests for the ML telemetry ingest endpoint's degradation contract:
 * telemetry must NEVER fail the client — without Redis it discards events
 * with a 200, and only genuine rate limiting produces a non-200. The
 * aggregation/validation internals are covered by the api/lib/mlTelemetry
 * tests; this file pins the handler's entry behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function createResponse() {
  const res = {
    _status: 0,
    _body: null as unknown,
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

async function handle(method: string, body: unknown = []) {
  const res = createResponse();
  const mod = await import('./ml-telemetry.js');
  await mod.default({ method, headers: {}, body } as unknown as VercelRequest, res);
  return res;
}

describe('ml-telemetry', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.REDIS_URL;
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
  });

  it('405s non-POST methods', async () => {
    const res = await handle('GET');
    expect(res._status).toBe(405);
  });

  it('degrades to 200 processed:0 when Redis is unconfigured (never fails the client)', async () => {
    const res = await handle('POST', [{ v: 1 }]);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ ok: true, processed: 0 });
  });

  it('degrades the same way in production (discard, not error)', async () => {
    process.env.VERCEL_ENV = 'production';
    const res = await handle('POST', [{ v: 1 }]);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ ok: true, processed: 0 });
  });
});
