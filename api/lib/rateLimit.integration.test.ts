/**
 * Rate limiter against a real Redis.
 *
 * The unit suites mock ioredis, which can only assert that a command was
 * issued — it cannot execute the Lua body, so every claim about enforcement,
 * window expiry and atomicity is unverifiable there. These run the script.
 *
 * Requires REDIS_TEST_URL (CI supplies a redis:7-alpine service container).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Redis } from 'ioredis';

const REDIS_TEST_URL = process.env.REDIS_TEST_URL;

// A bare `describe` that never runs reads as a pass; fail loudly in CI instead.
if (!REDIS_TEST_URL && process.env.CI) {
  throw new Error('REDIS_TEST_URL must be set in CI — the integration project cannot be skipped');
}

describe.skipIf(!REDIS_TEST_URL)('rate limiter (real Redis)', () => {
  let probe: Redis;

  beforeAll(() => {
    process.env.REDIS_URL = REDIS_TEST_URL;
    probe = new Redis(REDIS_TEST_URL as string);
  });

  afterAll(async () => {
    await probe.quit();
  });

  beforeEach(async () => {
    await probe.flushdb();
    vi.resetModules();
  });

  // Fresh module per test: getRedis() memoizes its client and the script.
  async function limiter() {
    return await import('./rateLimit.js');
  }

  it('admits up to the limit and denies past it', async () => {
    const { checkRateLimit } = await limiter();
    // 'auth.start' is 30/min — small enough to exhaust quickly.
    const results = [];
    for (let i = 0; i < 31; i++) results.push(await checkRateLimit('1.2.3.4', 'auth.start'));

    expect(results.slice(0, 30).every((r) => r.allowed)).toBe(true);
    expect(results[30].allowed).toBe(false);
    expect(results[30].remaining).toBe(0);
  });

  it('counts down remaining accurately', async () => {
    const { checkRateLimit } = await limiter();
    expect((await checkRateLimit('ip-a', 'auth.start')).remaining).toBe(29);
    expect((await checkRateLimit('ip-a', 'auth.start')).remaining).toBe(28);
    expect((await checkRateLimit('ip-a', 'auth.start')).remaining).toBe(27);
  });

  it('scopes budgets independently', async () => {
    const { checkRateLimit } = await limiter();
    for (let i = 0; i < 30; i++) await checkRateLimit('noisy', 'auth.start');

    expect((await checkRateLimit('noisy', 'auth.start')).allowed).toBe(false);
    expect((await checkRateLimit('quiet', 'auth.start')).allowed).toBe(true);
  });

  it('separates budgets per action', async () => {
    const { checkRateLimit } = await limiter();
    for (let i = 0; i < 30; i++) await checkRateLimit('same-ip', 'auth.start');

    expect((await checkRateLimit('same-ip', 'auth.start')).allowed).toBe(false);
    expect((await checkRateLimit('same-ip', 'auth.callback')).allowed).toBe(true);
  });

  // The reason this rewrite exists: the old read-then-write pair let concurrent
  // callers each observe a below-limit count and all be admitted.
  it('admits exactly the limit under concurrent callers', async () => {
    const { checkRateLimit } = await limiter();
    const results = await Promise.all(
      Array.from({ length: 60 }, () => checkRateLimit('thundering-herd', 'auth.start'))
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(30);
    expect(results.filter((r) => !r.allowed)).toHaveLength(30);
  });

  it('drops entries that age out of the window', async () => {
    const { checkRateLimit } = await limiter();
    const { rateLimitKey } = await import('./redisKeys.js');
    const { createHash } = await import('crypto');

    for (let i = 0; i < 30; i++) await checkRateLimit('ages-out', 'auth.start');
    expect((await checkRateLimit('ages-out', 'auth.start')).allowed).toBe(false);

    // Backdate every entry past the 60s window rather than waiting on wall time.
    const scope = createHash('sha256').update('ages-out').digest('hex').slice(0, 16);
    const key = rateLimitKey('auth.start', scope);
    const entries = await probe.zrange(key, 0, -1);
    const stale = Math.floor(Date.now() / 1000) - 120;
    for (const entry of entries) await probe.zadd(key, stale, entry);

    expect((await checkRateLimit('ages-out', 'auth.start')).allowed).toBe(true);
    // The consume pass also prunes what it just aged past.
    expect(await probe.zcard(key)).toBe(1);
  });

  it('reports a retry-after that is never in the past', async () => {
    const { checkRateLimit } = await limiter();
    for (let i = 0; i < 30; i++) await checkRateLimit('retry-after', 'auth.start');

    const denied = await checkRateLimit('retry-after', 'auth.start');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(denied.resetAt).toBeGreaterThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it('expires the key so idle scopes cost nothing', async () => {
    const { checkRateLimit } = await limiter();
    const { rateLimitKey } = await import('./redisKeys.js');
    const { createHash } = await import('crypto');

    await checkRateLimit('ttl-check', 'auth.start');
    const scope = createHash('sha256').update('ttl-check').digest('hex').slice(0, 16);
    const ttl = await probe.ttl(rateLimitKey('auth.start', scope));

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(120); // windowSeconds + 60
  });

  // ioredis issues EVALSHA and re-sends the body on NOSCRIPT. Without that,
  // every limiter call after a Redis restart or SCRIPT FLUSH would fail closed
  // and lock users out of auth and share.
  it('recovers from SCRIPT FLUSH without failing closed', async () => {
    const { checkRateLimit } = await limiter();
    expect((await checkRateLimit('flushed', 'auth.start')).allowed).toBe(true);

    await probe.script('FLUSH');

    expect((await checkRateLimit('flushed', 'auth.start')).allowed).toBe(true);
  });

  it('consumes exactly one slot per call', async () => {
    const { checkRateLimit } = await limiter();
    const { rateLimitKey } = await import('./redisKeys.js');
    const { createHash } = await import('crypto');

    for (let i = 0; i < 5; i++) await checkRateLimit('one-each', 'auth.start');

    const scope = createHash('sha256').update('one-each').digest('hex').slice(0, 16);
    expect(await probe.zcard(rateLimitKey('auth.start', scope))).toBe(5);
  });
});
