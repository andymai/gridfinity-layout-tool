import { describe, it, expect } from 'vitest';
import {
  shareHashKey,
  shareReportKey,
  shareLastAccessedKey,
  rateLimitKey,
  sessionKey,
  userSessionsKey,
  userProfileKey,
  userIndexKey,
  userIndexUpdatedAtKey,
  COMMUNITY_INDEX_SORTS,
  communityDesignKey,
  communityIndexKey,
  communityLikesKey,
  communityLikedKey,
  communityChildrenKey,
  communityAuthorKey,
  communityPublishedKey,
  communityReportsKey,
  communityReportedKey,
  communityDenylistKey,
  communityOpenedKey,
  communityExportedKey,
} from './redisKeys';

describe('redisKeys', () => {
  describe('share keys', () => {
    it('shareHashKey produces share:hash:{id}', () => {
      expect(shareHashKey('abc123')).toBe('share:hash:abc123');
    });

    it('shareReportKey produces share:reports:{id}', () => {
      expect(shareReportKey('abc123')).toBe('share:reports:abc123');
    });

    it('shareLastAccessedKey produces share:lastAccessed:{id}', () => {
      expect(shareLastAccessedKey('abc123')).toBe('share:lastAccessed:abc123');
    });
  });

  describe('rateLimitKey', () => {
    it('combines action and scope with the ratelimit prefix', () => {
      expect(rateLimitKey('create', 'iphash')).toBe('ratelimit:create:iphash');
      expect(rateLimitKey('sync.write', 'user-uid')).toBe('ratelimit:sync.write:user-uid');
    });
  });

  describe('sync keys', () => {
    it('sessionKey produces session:{token}', () => {
      expect(sessionKey('tok_xyz')).toBe('session:tok_xyz');
    });

    it('userSessionsKey produces users:{uid}:sessions', () => {
      expect(userSessionsKey('user-1')).toBe('users:user-1:sessions');
    });

    it('userProfileKey produces users:{uid}:profile', () => {
      expect(userProfileKey('user-1')).toBe('users:user-1:profile');
    });

    it('userIndexKey produces users:{uid}:index:{kind}', () => {
      expect(userIndexKey('user-1', 'layouts')).toBe('users:user-1:index:layouts');
      expect(userIndexKey('user-1', 'designs')).toBe('users:user-1:index:designs');
    });

    it('userIndexUpdatedAtKey produces users:{uid}:indexUpdatedAt', () => {
      expect(userIndexUpdatedAtKey('user-1')).toBe('users:user-1:indexUpdatedAt');
    });
  });

  describe('community keys', () => {
    it('communityDesignKey produces community:design:{id}', () => {
      expect(communityDesignKey('abc123def456')).toBe('community:design:abc123def456');
    });

    it('communityIndexKey produces community:index:{sort} for every sort', () => {
      expect(COMMUNITY_INDEX_SORTS).toEqual(['newest', 'remixes', 'likes', 'prints']);
      expect(communityIndexKey('newest')).toBe('community:index:newest');
      expect(communityIndexKey('remixes')).toBe('community:index:remixes');
      expect(communityIndexKey('likes')).toBe('community:index:likes');
    });

    it('communityLikesKey produces community:likes:{id}', () => {
      expect(communityLikesKey('abc123def456')).toBe('community:likes:abc123def456');
    });

    it('communityLikedKey produces community:liked:{uid}', () => {
      expect(communityLikedKey('user-1')).toBe('community:liked:user-1');
    });

    it('communityChildrenKey produces community:children:{id}', () => {
      expect(communityChildrenKey('abc123def456')).toBe('community:children:abc123def456');
    });

    it('communityAuthorKey produces community:author:{publicId}', () => {
      expect(communityAuthorKey('deadbeef')).toBe('community:author:deadbeef');
    });

    it('communityPublishedKey produces community:published:{uid}', () => {
      expect(communityPublishedKey('user-1')).toBe('community:published:user-1');
    });

    it('communityReportsKey produces community:reports:{id}', () => {
      expect(communityReportsKey('abc123def456')).toBe('community:reports:abc123def456');
    });

    it('communityReportedKey produces community:reported:{uid}', () => {
      expect(communityReportedKey('user-1')).toBe('community:reported:user-1');
    });

    it('communityDenylistKey produces community:denylist', () => {
      expect(communityDenylistKey()).toBe('community:denylist');
    });

    it('communityOpenedKey produces community:opened:{id}:{bucket}', () => {
      expect(communityOpenedKey('abc123def456', 2953)).toBe('community:opened:abc123def456:2953');
    });

    it('communityExportedKey produces community:exported:{id}:{bucket}', () => {
      expect(communityExportedKey('abc123def456', 2953)).toBe(
        'community:exported:abc123def456:2953'
      );
    });

    it('community keys never collide with each other for a shared id segment', () => {
      const id = 'a';
      const keys = [
        communityDesignKey(id),
        communityIndexKey('newest'),
        communityLikesKey(id),
        communityLikedKey(id),
        communityChildrenKey(id),
        communityAuthorKey(id),
        communityPublishedKey(id),
        communityReportsKey(id),
        communityReportedKey(id),
        communityDenylistKey(),
        communityOpenedKey(id, 0),
        communityExportedKey(id, 0),
      ];
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('namespace separation', () => {
    it('share keys never collide with sync keys', () => {
      const shareKeys = [shareHashKey('a'), shareReportKey('a'), shareLastAccessedKey('a')];
      const syncKeys = [
        sessionKey('a'),
        userSessionsKey('a'),
        userProfileKey('a'),
        userIndexKey('a', 'layouts'),
        userIndexKey('a', 'designs'),
        userIndexUpdatedAtKey('a'),
      ];
      for (const sk of shareKeys) {
        for (const yk of syncKeys) {
          expect(sk).not.toBe(yk);
        }
      }
    });

    it('rateLimit keys never collide with share or sync keys for matching id segments', () => {
      const id = 'abc';
      const rl = rateLimitKey('view', id);
      expect(rl).not.toBe(shareHashKey(id));
      expect(rl).not.toBe(shareReportKey(id));
      expect(rl).not.toBe(sessionKey(id));
      expect(rl).not.toBe(userIndexKey(id, 'layouts'));
    });
  });

  describe('single source of truth', () => {
    it('shared.ts re-exports the same shareHashKey/shareReportKey impls (no drift)', async () => {
      const shared = await import('./shared');
      expect(shared.shareHashKey).toBe(shareHashKey);
      expect(shared.shareReportKey).toBe(shareReportKey);
      expect(shared.shareLastAccessedKey).toBe(shareLastAccessedKey);
    });
  });
});
