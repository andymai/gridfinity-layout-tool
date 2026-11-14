/**
 * Share permission records against a real Redis. The unit suite fakes the
 * scripts; these run them, including the steps that refuse a late record.
 *
 * Requires REDIS_TEST_URL (CI supplies a redis:7-alpine service container).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Redis } from 'ioredis';
import {
  SHARE_PERMISSION_TTL_SECONDS,
  recordSharePermission,
  recordedPermissionOf,
  type SharePermissionWrite,
} from './sharePermission.js';
import { shareHashKey, sharePermissionKey, sharePermissionVersionKey } from './redisKeys.js';

const REDIS_TEST_URL = process.env.REDIS_TEST_URL;

if (!REDIS_TEST_URL && process.env.CI) {
  throw new Error('REDIS_TEST_URL must be set in CI: the integration project cannot be skipped');
}

describe.skipIf(!REDIS_TEST_URL)('share permission records (real Redis)', () => {
  let redis: Redis;
  const STAMP = Date.parse('2026-03-01T10:00:00.000Z');

  /** A write to the share that the token hash `h1` holds. */
  function write(
    stampMs: number,
    etag: string,
    permission: 'view' | 'edit',
    over: Partial<SharePermissionWrite> = {}
  ): SharePermissionWrite {
    return { stampMs, etag, permission, tokenHash: 'h1', ...over };
  }

  /** The record command fails, as on a timeout, while the cleanup still runs. */
  function failingRecord(client: Redis): Redis {
    return new Proxy(client, {
      get(target, prop) {
        if (prop === 'recordSharePermission') return () => Promise.reject(new Error('timeout'));
        const value: unknown = Reflect.get(target, prop, target);
        return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
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
    await redis.set(shareHashKey('s1'), 'h1');
    await redis.set(shareHashKey('s2'), 'h1');
  });

  it('records the permission for readers and for the blob version that holds it', async () => {
    await recordSharePermission(redis, 's1', write(STAMP, '"etag-1"', 'edit'));

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
    await recordSharePermission(redis, 's1', write(STAMP, '"etag-1"', 'edit'));
    await recordSharePermission(redis, 's1', write(STAMP + 1, '"etag-2"', 'view'));

    expect(await redis.get(sharePermissionKey('s1'))).toBe('view');
    expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBe('view');
    expect(await recordedPermissionOf(redis, 's1', '"etag-1"')).toBeNull();
  });

  it('keeps the record of a later write when an earlier record comes late', async () => {
    await recordSharePermission(redis, 's1', write(STAMP + 1, '"etag-2"', 'view'));
    await recordSharePermission(redis, 's1', write(STAMP, '"etag-1"', 'edit'));

    expect(await redis.get(sharePermissionKey('s1'))).toBe('view');
    expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBe('view');
  });

  it('keeps the record of a later write when an earlier write fails to record', async () => {
    await recordSharePermission(redis, 's1', write(STAMP + 2, '"etag-2"', 'view'));
    await recordSharePermission(failingRecord(redis), 's1', write(STAMP + 1, '"etag-1"', 'edit'));
    await recordSharePermission(redis, 's1', write(STAMP, '"etag-0"', 'edit'));

    expect(await redis.get(sharePermissionKey('s1'))).toBe('view');
    expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBe('view');
  });

  it('refuses the late records of older writes after a write fails to record', async () => {
    await recordSharePermission(redis, 's1', write(STAMP, '"etag-0"', 'edit'));
    await recordSharePermission(failingRecord(redis), 's1', write(STAMP + 2, '"etag-2"', 'view'));
    await recordSharePermission(redis, 's1', write(STAMP + 1, '"etag-1"', 'edit'));

    expect(await redis.get(sharePermissionKey('s1'))).toBeNull();
    expect(await recordedPermissionOf(redis, 's1', '"etag-1"')).toBeNull();
    expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBeNull();

    await recordSharePermission(redis, 's1', write(STAMP + 3, '"etag-3"', 'view'));
    expect(await recordedPermissionOf(redis, 's1', '"etag-3"')).toBe('view');
  });

  it('keeps the stamp order against a record that names no share', async () => {
    await redis.hset(
      sharePermissionVersionKey('s1'),
      'stamp',
      STAMP + 2,
      'etag',
      '"etag-2"',
      'permission',
      'view'
    );
    await recordSharePermission(redis, 's1', write(STAMP + 1, '"etag-1"', 'edit'));
    await recordSharePermission(failingRecord(redis), 's1', write(STAMP + 1, '"etag-1"', 'edit'));

    expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBe('view');
  });

  describe('when the share is deleted and created again under its id', () => {
    /** DELETE, then a POST that holds the new token hash `h2`. */
    async function replaceShare() {
      await redis.del(
        shareHashKey('s1'),
        sharePermissionKey('s1'),
        sharePermissionVersionKey('s1')
      );
      await redis.set(shareHashKey('s1'), 'h2');
    }

    it('refuses the late record of a write to the deleted share', async () => {
      await redis.del(
        shareHashKey('s1'),
        sharePermissionKey('s1'),
        sharePermissionVersionKey('s1')
      );
      await recordSharePermission(redis, 's1', write(STAMP + 2, '"etag-old"', 'edit'));

      expect(await redis.get(sharePermissionKey('s1'))).toBeNull();
      expect(await recordedPermissionOf(redis, 's1', '"etag-old"')).toBeNull();
    });

    it('records the new share over a later stamp that the deleted share reserved', async () => {
      await recordSharePermission(redis, 's1', write(STAMP + 2, '"etag-old"', 'edit'));
      await replaceShare();
      await recordSharePermission(
        redis,
        's1',
        write(STAMP + 1, '"etag-new"', 'view', { tokenHash: 'h2' })
      );
      await recordSharePermission(redis, 's1', write(STAMP + 3, '"etag-old-2"', 'edit'));

      expect(await redis.get(sharePermissionKey('s1'))).toBe('view');
      expect(await recordedPermissionOf(redis, 's1', '"etag-new"')).toBe('view');
    });

    it('keeps a later record of the new share over its delayed creation record', async () => {
      await replaceShare();
      await recordSharePermission(
        redis,
        's1',
        write(STAMP + 2, '"etag-2"', 'view', { tokenHash: 'h2' })
      );
      await recordSharePermission(
        redis,
        's1',
        write(STAMP + 1, '"etag-1"', 'edit', { tokenHash: 'h2' })
      );
      await recordSharePermission(
        failingRecord(redis),
        's1',
        write(STAMP + 1, '"etag-1"', 'edit', { tokenHash: 'h2' })
      );

      expect(await redis.get(sharePermissionKey('s1'))).toBe('view');
      expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBe('view');
    });

    it('forgets only for the share that holds the token hash', async () => {
      await replaceShare();
      await recordSharePermission(
        redis,
        's1',
        write(STAMP + 1, '"etag-new"', 'view', { tokenHash: 'h2' })
      );
      await recordSharePermission(
        failingRecord(redis),
        's1',
        write(STAMP + 2, '"etag-old"', 'edit')
      );

      expect(await redis.get(sharePermissionKey('s1'))).toBe('view');
      expect(await recordedPermissionOf(redis, 's1', '"etag-new"')).toBe('view');
    });
  });

  describe('a share from before the token hash moved to Redis', () => {
    it('records while no Redis hash holds the id', async () => {
      await redis.del(shareHashKey('s1'));
      await recordSharePermission(
        redis,
        's1',
        write(STAMP, '"etag-1"', 'edit', { tokenHash: null })
      );
      expect(await recordedPermissionOf(redis, 's1', '"etag-1"')).toBe('edit');
    });

    it('does not record once a new share holds the id', async () => {
      await recordSharePermission(
        redis,
        's1',
        write(STAMP, '"etag-1"', 'edit', { tokenHash: null })
      );
      expect(await redis.get(sharePermissionKey('s1'))).toBeNull();
    });
  });

  it('keeps each share apart', async () => {
    await recordSharePermission(redis, 's1', write(STAMP + 1, '"etag-2"', 'view'));
    await recordSharePermission(redis, 's2', write(STAMP, '"etag-1"', 'edit'));

    expect(await redis.get(sharePermissionKey('s2'))).toBe('edit');
    expect(await recordedPermissionOf(redis, 's2', '"etag-1"')).toBe('edit');
  });
});
