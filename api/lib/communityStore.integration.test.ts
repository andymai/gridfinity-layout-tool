/**
 * Like toggle against a real Redis.
 *
 * The unit suite emulates the Lua body in JS, which can only prove the
 * intended semantics, not that the script itself implements them or that
 * EVALSHA executes it atomically. These run the actual script.
 *
 * Requires REDIS_TEST_URL (CI supplies a redis:7-alpine service container).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Redis } from 'ioredis';
import { toggleCommunityLike } from './communityStore.js';
import {
  communityDesignKey,
  communityIndexKey,
  communityLikedKey,
  communityLikesKey,
} from './redisKeys.js';

const REDIS_TEST_URL = process.env.REDIS_TEST_URL;

// A bare `describe` that never runs reads as a pass; fail loudly in CI instead.
if (!REDIS_TEST_URL && process.env.CI) {
  throw new Error('REDIS_TEST_URL must be set in CI: the integration project cannot be skipped');
}

describe.skipIf(!REDIS_TEST_URL)('community like toggle (real Redis)', () => {
  let redis: Redis;

  const ID = 'abc123def456';
  const USER = 'user-1';

  beforeAll(() => {
    redis = new Redis(REDIS_TEST_URL as string);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushdb();
    await redis.hset(communityDesignKey(ID), { status: 'live', likes: '0' });
    await redis.zadd(communityIndexKey('likes'), 0, ID);
  });

  it('like/unlike round trip keeps counter, sets, and sort index agreeing', async () => {
    expect(await toggleCommunityLike(redis, USER, ID, true)).toEqual({
      likes: 1,
      likedByMe: true,
    });
    expect(await redis.sismember(communityLikesKey(ID), USER)).toBe(1);
    expect(await redis.sismember(communityLikedKey(USER), ID)).toBe(1);
    expect(await redis.zscore(communityIndexKey('likes'), ID)).toBe('1');

    expect(await toggleCommunityLike(redis, USER, ID, false)).toEqual({
      likes: 0,
      likedByMe: false,
    });
    expect(await redis.sismember(communityLikesKey(ID), USER)).toBe(0);
    expect(await redis.sismember(communityLikedKey(USER), ID)).toBe(0);
    expect(await redis.hget(communityDesignKey(ID), 'likes')).toBe('0');
    expect(await redis.zscore(communityIndexKey('likes'), ID)).toBe('0');
  });

  it('is idempotent for repeated likes and repeated unlikes', async () => {
    await toggleCommunityLike(redis, USER, ID, true);
    expect(await toggleCommunityLike(redis, USER, ID, true)).toEqual({
      likes: 1,
      likedByMe: true,
    });
    expect(await redis.hget(communityDesignKey(ID), 'likes')).toBe('1');

    await toggleCommunityLike(redis, USER, ID, false);
    expect(await toggleCommunityLike(redis, USER, ID, false)).toEqual({
      likes: 0,
      likedByMe: false,
    });
    expect(await redis.hget(communityDesignKey(ID), 'likes')).toBe('0');
  });

  it('clamps an unlike on drifted state at zero instead of going negative', async () => {
    // Set says liked, counter says 0: drift the script must absorb.
    await redis.sadd(communityLikesKey(ID), USER);
    expect(await toggleCommunityLike(redis, USER, ID, false)).toEqual({
      likes: 0,
      likedByMe: false,
    });
    expect(await redis.hget(communityDesignKey(ID), 'likes')).toBe('0');
  });

  it('never resurrects an unindexed (hidden) design via ZADD XX', async () => {
    await redis.zrem(communityIndexKey('likes'), ID);
    await toggleCommunityLike(redis, USER, ID, true);
    expect(await redis.zscore(communityIndexKey('likes'), ID)).toBeNull();
    expect(await redis.hget(communityDesignKey(ID), 'likes')).toBe('1');
  });

  it('converges under concurrent toggles from racing tabs', async () => {
    const doubleTap = await Promise.all([
      toggleCommunityLike(redis, USER, ID, true),
      toggleCommunityLike(redis, USER, ID, true),
    ]);
    expect(doubleTap.map((r) => r.likes)).toEqual([1, 1]);

    const users = Array.from({ length: 10 }, (_, i) => `racer-${i}`);
    await Promise.all(users.map((user) => toggleCommunityLike(redis, user, ID, true)));
    await Promise.all(users.slice(0, 4).map((user) => toggleCommunityLike(redis, user, ID, false)));

    const members = await redis.scard(communityLikesKey(ID));
    expect(Number(await redis.hget(communityDesignKey(ID), 'likes'))).toBe(members);
    expect(Number(await redis.zscore(communityIndexKey('likes'), ID))).toBe(members);
  });
});
