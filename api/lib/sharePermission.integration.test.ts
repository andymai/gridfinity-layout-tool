/**
 * Share permission records against a real Redis. The unit suite fakes the
 * script; these run it, including the step that refuses a late record.
 *
 * Requires REDIS_TEST_URL (CI supplies a redis:7-alpine service container).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Redis } from 'ioredis';
import {
  SHARE_PERMISSION_TTL_SECONDS,
  recordSharePermission,
  recordedPermissionOf,
} from './sharePermission.js';
import { sharePermissionKey, sharePermissionVersionKey } from './redisKeys.js';

const REDIS_TEST_URL = process.env.REDIS_TEST_URL;

if (!REDIS_TEST_URL && process.env.CI) {
  throw new Error('REDIS_TEST_URL must be set in CI: the integration project cannot be skipped');
}

describe.skipIf(!REDIS_TEST_URL)('share permission records (real Redis)', () => {
  let redis: Redis;
  const STAMP = Date.parse('2026-03-01T10:00:00.000Z');

  beforeAll(() => {
    redis = new Redis(REDIS_TEST_URL as string);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('records the permission for readers and for the blob version that holds it', async () => {
    await recordSharePermission(redis, 's1', {
      stampMs: STAMP,
      etag: '"etag-1"',
      permission: 'edit',
    });

    expect(await redis.get(sharePermissionKey('s1'))).toBe('edit');
    expect(await recordedPermissionOf(redis, 's1', '"etag-1"')).toBe('edit');
    expect(await recordedPermissionOf(redis, 's1', '"etag-0"')).toBeNull();
    for (const key of [sharePermissionKey('s1'), sharePermissionVersionKey('s1')]) {
      const ttl = await redis.ttl(key);
      expect(ttl).toBeGreaterThan(SHARE_PERMISSION_TTL_SECONDS - 5);
      expect(ttl).toBeLessThanOrEqual(SHARE_PERMISSION_TTL_SECONDS);
    }
  });

  it('replaces the record of an earlier write', async () => {
    await recordSharePermission(redis, 's1', {
      stampMs: STAMP,
      etag: '"etag-1"',
      permission: 'edit',
    });
    await recordSharePermission(redis, 's1', {
      stampMs: STAMP + 1,
      etag: '"etag-2"',
      permission: 'view',
    });

    expect(await redis.get(sharePermissionKey('s1'))).toBe('view');
    expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBe('view');
    expect(await recordedPermissionOf(redis, 's1', '"etag-1"')).toBeNull();
  });

  it('keeps the record of a later write when an earlier record comes late', async () => {
    await recordSharePermission(redis, 's1', {
      stampMs: STAMP + 1,
      etag: '"etag-2"',
      permission: 'view',
    });
    await recordSharePermission(redis, 's1', {
      stampMs: STAMP,
      etag: '"etag-1"',
      permission: 'edit',
    });

    expect(await redis.get(sharePermissionKey('s1'))).toBe('view');
    expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBe('view');
  });

  it('keeps each share apart', async () => {
    await recordSharePermission(redis, 's1', {
      stampMs: STAMP + 1,
      etag: '"etag-2"',
      permission: 'view',
    });
    await recordSharePermission(redis, 's2', {
      stampMs: STAMP,
      etag: '"etag-1"',
      permission: 'edit',
    });

    expect(await redis.get(sharePermissionKey('s2'))).toBe('edit');
    expect(await recordedPermissionOf(redis, 's2', '"etag-1"')).toBe('edit');
  });
});
