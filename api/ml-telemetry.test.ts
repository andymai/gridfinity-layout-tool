/**
 * Tests for the ML telemetry ingest endpoint's degradation contract:
 * telemetry must NEVER fail the client — without Redis it discards events
 * with a 200, and only genuine rate limiting produces a non-200. The
 * aggregation/validation internals are covered by the api/lib/mlTelemetry
 * tests; this file pins the handler's entry behavior and its TTL policy.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ML_AGGREGATE_TTL_SECONDS, ML_LIFETIME_KEYS } from './lib/mlTelemetry/retention.js';
import { KNOWN_EVENT_TYPES } from './lib/mlTelemetry/validators.constants.js';

interface Recorded {
  cmd: string;
  args: unknown[];
}

const recorded: Recorded[] = [];

vi.mock('ioredis', () => {
  const makePipeline = (): Record<string, unknown> => {
    const pipeline: Record<string, unknown> = { exec: async () => [] };
    for (const cmd of ['hincrby', 'expire', 'incrby', 'set', 'zadd', 'zremrangebyscore']) {
      pipeline[cmd] = (...args: unknown[]) => {
        recorded.push({ cmd, args });
        return pipeline;
      };
    }
    return pipeline;
  };
  const client = {
    pipeline: makePipeline,
    // The shared limiter registers its Lua script via defineCommand. The script
    // body is covered by the integration project against real Redis; here it
    // only has to resolve as "allowed" so the handler proceeds.
    defineCommand: () => undefined,
    slidingWindowRateLimit: async (): Promise<[number, number, string]> => [1, 99, '0'],
  };
  // Must be `new`-able: the limiter constructs its own client.
  function Ctor(): typeof client {
    return client;
  }
  return { Redis: Ctor, default: Ctor };
});

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

const BIN_PLACED = {
  type: 'bin_placed',
  bin_size: '2x3x4',
  prev_bin_size: null,
  drawer_size: '6x8x6',
  position: '0,0',
  layer_index: 0,
  largest_gap: '4x5',
  fill_pct: 50,
  gap_fit: 'exact',
  label_hash: 'a1b2c3d4',
  label_normalized: null,
  label_domain: null,
  label_embedding_bucket: null,
  category_id: 'cat-01',
  adjacent_label_hashes: [],
  adjacent_sizes: [],
  adjacent_count: 0,
  recent_sizes: [],
  time_since_last_ms: null,
  is_first_of_label: false,
  method: 'draw',
  session_index: 0,
  vocab_version: 'v1',
};

const cmds = (name: string) => recorded.filter((r) => r.cmd === name);
const keysOf = (name: string) => new Set(cmds(name).map((r) => r.args[0] as string));

describe('ml-telemetry', () => {
  beforeEach(() => {
    vi.resetModules();
    recorded.length = 0;
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

  describe('retention', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379';
    });

    it('expires every aggregate it increments', async () => {
      const res = await handle('POST', [BIN_PLACED]);
      expect(res._body).toEqual({ ok: true, processed: 1, failed: 0 });

      const incremented = [...keysOf('hincrby')].filter((k) => !ML_LIFETIME_KEYS.has(k));
      const expired = keysOf('expire');

      expect(incremented.length).toBeGreaterThan(5);
      expect(incremented.filter((k) => !expired.has(k))).toEqual([]);
    });

    // The bug this replaces: an allowlist covered 4 of ~32 key shapes, so
    // ml:label_hash:* and friends accumulated with no expiry at all.
    it('expires the high-cardinality shapes that previously leaked', async () => {
      await handle('POST', [BIN_PLACED]);
      const expired = keysOf('expire');
      expect(expired).toContain('ml:label_hash:a1b2c3d4');
      expect(expired).toContain('ml:cat:cat-01');
      expect(expired).toContain('ml:drawer:6x8x6');
      expect(expired).toContain('ml:sizes');
    });

    // Sliding, not create-once: NX would delete a hot counter 90 days after
    // it first appeared regardless of how much signal it had accumulated.
    it('refreshes the TTL on every write rather than setting it once', async () => {
      await handle('POST', [BIN_PLACED]);
      const expires = cmds('expire').filter((r) => (r.args[0] as string).startsWith('ml:'));
      expect(expires.length).toBeGreaterThan(0);
      for (const { args } of expires) {
        expect(args[1]).toBe(ML_AGGREGATE_TTL_SECONDS);
        expect(args).toHaveLength(2);
      }
    });

    it('never expires the running totals', async () => {
      await handle('POST', [BIN_PLACED]);
      const expired = keysOf('expire');
      for (const key of ML_LIFETIME_KEYS) expect(expired).not.toContain(key);
    });
  });

  // failed_by_type is a lifetime key: nothing expires or prunes it, so an
  // attacker-controlled field name there is a permanent allocation primitive.
  describe('validation failure buckets', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379';
    });

    const failureFields = () =>
      cmds('hincrby')
        .filter((r) => r.args[0] === 'ml:meta:validation:failed_by_type')
        .map((r) => r.args[1] as string);

    it('collapses unknown event types into a single bucket', async () => {
      const events = Array.from({ length: 50 }, (_, i) => ({ type: `evil_${'a'.repeat(i)}` }));
      const res = await handle('POST', events);

      expect(res._body).toEqual({ ok: true, processed: 0, failed: 50 });
      expect(failureFields()).toEqual(['other']);
    });

    it('still buckets a known event type under its own name', async () => {
      await handle('POST', [{ type: 'bin_placed' }]);
      expect(failureFields()).toEqual(['bin_placed']);
    });

    it('never writes a field outside the known set plus "other"', async () => {
      await handle('POST', [
        { type: 'layout_snapshot' },
        { type: '../../injected' },
        { type: 42 },
        {},
      ]);
      for (const field of failureFields()) {
        expect(KNOWN_EVENT_TYPES.has(field) || field === 'other').toBe(true);
      }
    });
  });
});
