/**
 * Share revision stamps against a real Redis. The unit suite fakes the scripts;
 * these run them, including the atomic step that concurrent writes rely on.
 *
 * Requires REDIS_TEST_URL (CI supplies a redis:7-alpine service container).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Redis } from 'ioredis';
import {
  SHARE_REVISION_TTL_SECONDS,
  reserveShareRevision,
  seedShareRevision,
} from './shareRevision.js';
import { shareRevisionKey } from './redisKeys.js';

const REDIS_TEST_URL = process.env.REDIS_TEST_URL;

if (!REDIS_TEST_URL && process.env.CI) {
  throw new Error('REDIS_TEST_URL must be set in CI: the integration project cannot be skipped');
}

describe.skipIf(!REDIS_TEST_URL)('share revisions (real Redis)', () => {
  let redis: Redis;
  const FLOOR = Date.parse('2026-03-01T10:00:00.000Z');

  beforeAll(() => {
    redis = new Redis(REDIS_TEST_URL as string);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('reserves nothing, and creates no counter, for a share with no counter', async () => {
    expect(await reserveShareRevision(redis, 's1', FLOOR)).toBeNull();
    expect(await redis.exists(shareRevisionKey('s1'))).toBe(0);
  });

  it('hands out one past the last stamp while the floor is lower, else the floor', async () => {
    await seedShareRevision(redis, 's1', FLOOR);
    expect(await reserveShareRevision(redis, 's1', FLOOR - 5000)).toBe(FLOOR + 1);
    expect(await reserveShareRevision(redis, 's1', FLOOR + 10_000)).toBe(FLOOR + 10_000);
    expect(await redis.get(shareRevisionKey('s1'))).toBe(String(FLOOR + 10_000));
  });

  it('seeds only upward', async () => {
    await seedShareRevision(redis, 's1', FLOOR + 10_000);
    await seedShareRevision(redis, 's1', FLOOR);
    expect(await redis.get(shareRevisionKey('s1'))).toBe(String(FLOOR + 10_000));
  });

  it('keeps the counter for a day', async () => {
    await seedShareRevision(redis, 's1', FLOOR);
    await reserveShareRevision(redis, 's1', FLOOR);
    const ttl = await redis.ttl(shareRevisionKey('s1'));
    expect(ttl).toBeGreaterThan(SHARE_REVISION_TTL_SECONDS - 5);
    expect(ttl).toBeLessThanOrEqual(SHARE_REVISION_TTL_SECONDS);
  });

  it('gives writes at the same floor distinct stamps', async () => {
    await seedShareRevision(redis, 's1', FLOOR - 1);
    const stamps = await Promise.all(
      Array.from({ length: 20 }, () => reserveShareRevision(redis, 's1', FLOOR))
    );
    expect(new Set(stamps).size).toBe(20);
    expect(Math.max(...stamps.map(Number))).toBe(FLOOR + 19);
  });

  it('keeps each share apart', async () => {
    await seedShareRevision(redis, 's1', FLOOR + 10_000);
    expect(await reserveShareRevision(redis, 's2', FLOOR)).toBeNull();
  });
});
