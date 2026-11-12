import { describe, it, expect, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { reserveShareRevision, seedShareRevision } from './shareRevision.js';

const FLOOR = Date.parse('2026-03-01T10:00:00.000Z');

function scripted(reserve: unknown, seed: unknown = vi.fn().mockResolvedValue(FLOOR)) {
  const client = {
    defineCommand: vi.fn((name: string) => {
      Object.assign(client, { [name]: name === 'reserveShareRevision' ? reserve : seed });
    }),
  };
  return { client, redis: client as unknown as Redis };
}

describe('reserveShareRevision', () => {
  it('is null without Redis', async () => {
    expect(await reserveShareRevision(null, 's1', FLOOR)).toBeNull();
  });

  it('registers the scripts once per client and passes the share key, floor and TTL', async () => {
    const reserve = vi.fn().mockResolvedValue(FLOOR + 7);
    const { client, redis } = scripted(reserve);

    expect(await reserveShareRevision(redis, 's1', FLOOR)).toBe(FLOOR + 7);
    await reserveShareRevision(redis, 's1', FLOOR);

    expect(client.defineCommand).toHaveBeenCalledTimes(2);
    expect(reserve).toHaveBeenCalledWith('share:revision:s1', FLOOR, expect.any(Number));
  });

  it('is null when the share has no counter', async () => {
    const { redis } = scripted(vi.fn().mockResolvedValue(null));
    expect(await reserveShareRevision(redis, 's1', FLOOR)).toBeNull();
  });

  it('is null when Redis fails', async () => {
    const { redis } = scripted(vi.fn().mockRejectedValue(new Error('redis down')));
    expect(await reserveShareRevision(redis, 's1', FLOOR)).toBeNull();
  });

  it('never goes below the floor', async () => {
    const { redis } = scripted(vi.fn().mockResolvedValue(FLOOR - 1));
    expect(await reserveShareRevision(redis, 's1', FLOOR)).toBe(FLOOR);
  });
});

describe('seedShareRevision', () => {
  it('passes the share key, stamp and TTL', async () => {
    const seed = vi.fn().mockResolvedValue(FLOOR);
    const { redis } = scripted(vi.fn(), seed);
    await seedShareRevision(redis, 's1', FLOOR);
    expect(seed).toHaveBeenCalledWith('share:revision:s1', FLOOR, expect.any(Number));
  });

  it('does not throw when Redis fails', async () => {
    const { redis } = scripted(vi.fn(), vi.fn().mockRejectedValue(new Error('redis down')));
    await expect(seedShareRevision(redis, 's1', FLOOR)).resolves.toBeUndefined();
  });
});
