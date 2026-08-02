/**
 * Unit coverage for the RATE_LIMITS config surface (the table is private, so
 * limits are observed through the no-Redis fail-open path, which reports the
 * configured limit as `remaining`). Enforcement against a real Redis lives in
 * rateLimit.integration.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as RateLimitModule from './rateLimit.js';

async function limiter(): Promise<typeof RateLimitModule> {
  return import('./rateLimit.js');
}

describe('community rate-limit actions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('REDIS_URL', '');
    vi.stubEnv('VERCEL_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('community.read allows 240 per minute', async () => {
    const { checkRateLimit } = await limiter();
    const result = await checkRateLimit('203.0.113.1', 'community.read');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(240);
    expect(result.resetAt - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(60);
  });

  it('community.publish allows 10 per day per user', async () => {
    const { checkRateLimit } = await limiter();
    const result = await checkRateLimit('user-1', 'community.publish');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
    expect(result.resetAt - Math.floor(Date.now() / 1000)).toBeGreaterThan(60 * 60);
    expect(result.resetAt - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(24 * 60 * 60);
  });

  it('community.manage allows 60 per day, separate from the publish budget', async () => {
    const { checkRateLimit } = await limiter();
    const result = await checkRateLimit('user-1', 'community.manage');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(60);
    expect(result.resetAt - Math.floor(Date.now() / 1000)).toBeGreaterThan(60 * 60);
    expect(result.resetAt - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(24 * 60 * 60);
  });

  it('fails closed for community actions in production without Redis', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const { checkRateLimit } = await limiter();
    expect((await checkRateLimit('user-1', 'community.publish')).allowed).toBe(false);
    expect((await checkRateLimit('203.0.113.1', 'community.read')).allowed).toBe(false);
  });
});
