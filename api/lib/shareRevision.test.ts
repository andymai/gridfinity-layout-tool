import { describe, it, expect, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { reserveShareRevision, verifyShareRevision } from './shareRevision.js';

const FLOOR = Date.parse('2026-03-01T10:00:00.000Z');

function scripted(reserve: unknown, verify: unknown = vi.fn().mockResolvedValue(1)) {
  const client = {
    defineCommand: vi.fn((name: string) => {
      Object.assign(client, { [name]: name === 'reserveShareRevision' ? reserve : verify });
    }),
  };
  return { client, redis: client as unknown as Redis };
}

describe('reserveShareRevision', () => {
  it('registers the scripts once per client and passes the share key, floor and TTL', async () => {
    const reserve = vi.fn().mockResolvedValue([FLOOR + 7, 1]);
    const { client, redis } = scripted(reserve);

    expect(await reserveShareRevision(redis, 's1', FLOOR)).toEqual({
      stampMs: FLOOR + 7,
      verified: true,
    });
    await reserveShareRevision(redis, 's1', FLOOR);

    expect(client.defineCommand).toHaveBeenCalledTimes(2);
    expect(reserve).toHaveBeenCalledWith('share:revision:s1', FLOOR, expect.any(Number));
  });

  it('reports an unverified counter', async () => {
    const { redis } = scripted(vi.fn().mockResolvedValue([FLOOR, 0]));
    expect(await reserveShareRevision(redis, 's1', FLOOR)).toEqual({
      stampMs: FLOOR,
      verified: false,
    });
  });

  it('is null when Redis fails', async () => {
    const { redis } = scripted(vi.fn().mockRejectedValue(new Error('redis down')));
    expect(await reserveShareRevision(redis, 's1', FLOOR)).toBeNull();
  });

  it('never goes below the floor', async () => {
    const { redis } = scripted(vi.fn().mockResolvedValue([FLOOR - 1, 1]));
    expect((await reserveShareRevision(redis, 's1', FLOOR))?.stampMs).toBe(FLOOR);
  });
});

describe('verifyShareRevision', () => {
  it('passes the share key and the stamp that landed', async () => {
    const verify = vi.fn().mockResolvedValue(1);
    const { redis } = scripted(vi.fn(), verify);
    await verifyShareRevision(redis, 's1', FLOOR);
    expect(verify).toHaveBeenCalledWith('share:revision:s1', FLOOR);
  });

  it('does not throw when Redis fails', async () => {
    const { redis } = scripted(vi.fn(), vi.fn().mockRejectedValue(new Error('redis down')));
    await expect(verifyShareRevision(redis, 's1', FLOOR)).resolves.toBeUndefined();
  });
});
