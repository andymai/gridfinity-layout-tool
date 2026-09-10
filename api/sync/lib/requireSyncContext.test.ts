import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mocks = vi.hoisted(() => ({
  requireMethod: vi.fn(),
  requireSession: vi.fn(),
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  rateLimited: vi.fn(),
  serviceUnavailable: vi.fn(),
}));
vi.mock('../../lib/method.js', () => ({ requireMethod: mocks.requireMethod }));
vi.mock('../../lib/session.js', () => ({ requireSession: mocks.requireSession }));
vi.mock('../../lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
}));
vi.mock('../../lib/shared.js', () => ({
  rateLimited: mocks.rateLimited,
  serviceUnavailable: mocks.serviceUnavailable,
}));

import { requireSyncContext } from './requireSyncContext';

const req = {} as VercelRequest;
const res = {} as VercelResponse;

describe('requireSyncContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireMethod.mockReturnValue(true);
    mocks.requireSession.mockResolvedValue({ userId: 'u1' });
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.getRedis.mockReturnValue({ id: 'redis' });
  });

  it('returns the session and redis when every gate passes', async () => {
    const ctx = await requireSyncContext(req, res, ['GET'], 'sync.read');
    expect(ctx).toEqual({ session: { userId: 'u1' }, redis: { id: 'redis' } });
    expect(mocks.requireMethod).toHaveBeenCalledWith(req, res, ['GET']);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('u1', 'sync.read');
  });

  it('stops at the first failing gate without touching the later ones', async () => {
    mocks.requireMethod.mockReturnValue(false);
    expect(await requireSyncContext(req, res, ['GET'], 'sync.read')).toBeNull();
    expect(mocks.requireSession).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.getRedis).not.toHaveBeenCalled();

    mocks.requireMethod.mockReturnValue(true);
    mocks.requireSession.mockResolvedValue(null);
    expect(await requireSyncContext(req, res, ['GET'], 'sync.read')).toBeNull();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();

    mocks.requireSession.mockResolvedValue({ userId: 'u1' });
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 7 });
    expect(await requireSyncContext(req, res, ['GET'], 'sync.read')).toBeNull();
    expect(mocks.rateLimited).toHaveBeenCalledWith(res, 7);
    expect(mocks.getRedis).not.toHaveBeenCalled();

    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.getRedis.mockReturnValue(null);
    expect(await requireSyncContext(req, res, ['GET'], 'sync.read')).toBeNull();
    expect(mocks.serviceUnavailable).toHaveBeenCalledWith(res);
  });
});
