import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { checkCommunityPublishQuota, COMMUNITY_MAX_LIVE_DESIGNS } from './communityQuota.js';

const scard = vi.fn();
const redis = { scard } as unknown as Redis;

describe('checkCommunityPublishQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scard.mockResolvedValue(0);
  });

  it('allows a first publish', async () => {
    const result = await checkCommunityPublishQuota(redis, 'user-1');
    expect(result).toEqual({ ok: true });
    expect(scard).toHaveBeenCalledWith('community:published:user-1');
  });

  it('allows publishing up to the cap', async () => {
    scard.mockResolvedValue(COMMUNITY_MAX_LIVE_DESIGNS - 1);
    expect((await checkCommunityPublishQuota(redis, 'user-1')).ok).toBe(true);
  });

  it('rejects a new publish at the cap', async () => {
    scard.mockResolvedValue(COMMUNITY_MAX_LIVE_DESIGNS);
    const result = await checkCommunityPublishQuota(redis, 'user-1');
    expect(result).toEqual({
      ok: false,
      error: {
        type: 'QUOTA_EXCEEDED',
        reason: 'count',
        current: COMMUNITY_MAX_LIVE_DESIGNS + 1,
        limit: COMMUNITY_MAX_LIVE_DESIGNS,
      },
    });
  });
});
