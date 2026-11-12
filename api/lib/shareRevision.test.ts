import { describe, it, expect, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { reserveShareRevision } from './shareRevision.js';

const FLOOR = Date.parse('2026-03-01T10:00:00.000Z');

describe('reserveShareRevision', () => {
  it('is the floor without Redis', async () => {
    expect(await reserveShareRevision(null, 's1', FLOOR)).toBe(FLOOR);
  });

  it('registers the script once per client and passes the share key, floor and TTL', async () => {
    const reserve = vi.fn().mockResolvedValue(FLOOR + 7);
    const client = {
      defineCommand: vi.fn((name: string) => {
        Object.assign(client, { [name]: reserve });
      }),
    };
    const redis = client as unknown as Redis;

    expect(await reserveShareRevision(redis, 's1', FLOOR)).toBe(FLOOR + 7);
    await reserveShareRevision(redis, 's1', FLOOR);

    expect(client.defineCommand).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledWith('share:revision:s1', FLOOR, expect.any(Number));
  });

  it('is the floor when Redis fails', async () => {
    const redis = {
      reserveShareRevision: vi.fn().mockRejectedValue(new Error('redis down')),
    } as unknown as Redis;
    expect(await reserveShareRevision(redis, 's1', FLOOR)).toBe(FLOOR);
  });

  it('never goes below the floor', async () => {
    const redis = {
      reserveShareRevision: vi.fn().mockResolvedValue(FLOOR - 1),
    } as unknown as Redis;
    expect(await reserveShareRevision(redis, 's1', FLOOR)).toBe(FLOOR);
  });
});
