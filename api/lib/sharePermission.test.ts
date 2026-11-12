import { describe, it, expect, vi } from 'vitest';
import type { Redis } from 'ioredis';
import {
  SHARE_PERMISSION_TTL_SECONDS,
  recordSharePermission,
  recordedPermissionOf,
} from './sharePermission.js';

const STAMP = Date.parse('2026-03-01T10:00:00.000Z');
const WRITE = { stampMs: STAMP, etag: '"etag-2"', permission: 'view' } as const;

function scripted(record: unknown, forget: unknown = vi.fn().mockResolvedValue(1)) {
  const client = {
    hmget: vi.fn(),
    defineCommand: vi.fn((name: string) => {
      Object.assign(client, { [name]: name === 'recordSharePermission' ? record : forget });
    }),
  };
  return { client, redis: client as unknown as Redis };
}

describe('recordSharePermission', () => {
  it('registers the scripts once per client and passes both keys, the write and the TTL', async () => {
    const record = vi.fn().mockResolvedValue(1);
    const { client, redis } = scripted(record);

    await recordSharePermission(redis, 's1', WRITE);
    await recordSharePermission(redis, 's1', WRITE);

    expect(client.defineCommand).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenCalledWith(
      'share:permission:s1',
      'share:permissionVersion:s1',
      STAMP,
      '"etag-2"',
      'view',
      SHARE_PERMISSION_TTL_SECONDS
    );
  });

  it('forgets the older record under the stamp of the write when recording fails', async () => {
    const forget = vi.fn().mockResolvedValue(1);
    const { redis } = scripted(vi.fn().mockRejectedValue(new Error('redis down')), forget);
    await recordSharePermission(redis, 's1', WRITE);
    expect(forget).toHaveBeenCalledWith(
      'share:permission:s1',
      'share:permissionVersion:s1',
      STAMP,
      SHARE_PERMISSION_TTL_SECONDS
    );
  });

  it('does not throw when forgetting fails too', async () => {
    const { redis } = scripted(
      vi.fn().mockRejectedValue(new Error('redis down')),
      vi.fn().mockRejectedValue(new Error('redis down'))
    );
    await expect(recordSharePermission(redis, 's1', WRITE)).resolves.toBeUndefined();
  });

  it('does nothing without Redis', async () => {
    await expect(recordSharePermission(null, 's1', WRITE)).resolves.toBeUndefined();
  });
});

describe('recordedPermissionOf', () => {
  it('is the recorded permission when the record names that blob version', async () => {
    const { client, redis } = scripted(vi.fn());
    client.hmget.mockResolvedValue(['"etag-2"', 'edit']);
    expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBe('edit');
    expect(client.hmget).toHaveBeenCalledWith('share:permissionVersion:s1', 'etag', 'permission');
  });

  it('is null when the record names another blob version', async () => {
    const { client, redis } = scripted(vi.fn());
    client.hmget.mockResolvedValue(['"etag-1"', 'edit']);
    expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBeNull();
  });

  it('is null with no record, a malformed one, or a Redis failure', async () => {
    const { client, redis } = scripted(vi.fn());
    client.hmget.mockResolvedValueOnce([null, null]);
    expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBeNull();
    client.hmget.mockResolvedValueOnce(['"etag-2"', 'admin']);
    expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBeNull();
    client.hmget.mockRejectedValueOnce(new Error('redis down'));
    expect(await recordedPermissionOf(redis, 's1', '"etag-2"')).toBeNull();
  });
});
