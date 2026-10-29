/**
 * A repeat Ko-fi payment against a real Redis.
 *
 * The webhook unit suite emulates the compare-and-set in JS, which proves the
 * intended semantics only. These run the script.
 *
 * Requires REDIS_TEST_URL (CI supplies a redis:7-alpine service container).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Redis } from 'ioredis';
import { recordDonor } from './supporters.js';
import { supportersDonorsKey } from './redisKeys.js';

const REDIS_TEST_URL = process.env.REDIS_TEST_URL;

// A bare `describe` that never runs reads as a pass; fail loudly in CI instead.
if (!REDIS_TEST_URL && process.env.CI) {
  throw new Error('REDIS_TEST_URL must be set in CI: the integration project cannot be skipped');
}

describe.skipIf(!REDIS_TEST_URL)('recordDonor (real Redis)', () => {
  let redis: Redis;
  const FIELD = 'donor-1';
  const stored = async (): Promise<unknown> =>
    JSON.parse((await redis.hget(supportersDonorsKey(), FIELD)) ?? 'null');

  /** Runs `edit` right after each read, as a self-service save racing the webhook would. */
  function racing(edit: (reads: number) => string): Redis {
    let reads = 0;
    return new Proxy(redis, {
      get(target, prop, receiver) {
        if (prop !== 'hget') return Reflect.get(target, prop, receiver) as unknown;
        return async (key: string, field: string) => {
          const seen = await target.hget(key, field);
          reads += 1;
          await target.hset(key, field, edit(reads));
          return seen;
        };
      },
    });
  }

  beforeAll(() => {
    redis = new Redis(REDIS_TEST_URL as string);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('creates the record on a first payment', async () => {
    await recordDonor(redis, FIELD, { name: 'Jo', joinedAt: '2026-07-01T00:00:00.000Z' });
    expect(await stored()).toEqual({ n: 'Jo', t: '2026-07-01T00:00:00.000Z' });
  });

  it('merges a repeat payment into the stored record', async () => {
    await recordDonor(redis, FIELD, {
      name: 'Jo',
      joinedAt: '2026-07-01T00:00:00.000Z',
      message: 'first words',
    });
    await recordDonor(redis, FIELD, { name: 'Jo', joinedAt: '2026-09-01T00:00:00.000Z' });
    expect(await stored()).toEqual({ n: 'Jo', t: '2026-07-01T00:00:00.000Z', m: 'first words' });
  });

  it('re-reads instead of overwriting an edit that lands mid-merge', async () => {
    await redis.hset(supportersDonorsKey(), FIELD, JSON.stringify({ n: 'Jo', t: '2026-07-01' }));
    const client = racing(() => JSON.stringify({ n: 'Jo E.', t: '2026-07-01' }));
    await recordDonor(client, FIELD, { name: 'Jo', joinedAt: '2026-09-01', message: 'more' });
    expect(await stored()).toEqual({ n: 'Jo E.', t: '2026-07-01', m: 'more' });
  });

  it('still records the payment when every attempt loses the race', async () => {
    await redis.hset(supportersDonorsKey(), FIELD, JSON.stringify({ n: 'Jo', t: '2026-07-01' }));
    const client = racing((reads) => JSON.stringify({ n: `Edit ${reads}`, t: '2026-07-01' }));
    await recordDonor(client, FIELD, { name: 'Jo', joinedAt: '2026-09-01', message: 'more' });
    expect(await stored()).toMatchObject({ m: 'more' });
  });
});
