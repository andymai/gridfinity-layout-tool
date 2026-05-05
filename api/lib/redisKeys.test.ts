import { describe, it, expect } from 'vitest';
import {
  shareHashKey,
  shareReportKey,
  rateLimitKey,
  sessionKey,
  userSessionsKey,
  userProfileKey,
  userIndexKey,
  userIndexUpdatedAtKey,
} from './redisKeys';

describe('redisKeys', () => {
  describe('share keys', () => {
    it('shareHashKey produces share:hash:{id}', () => {
      expect(shareHashKey('abc123')).toBe('share:hash:abc123');
    });

    it('shareReportKey produces share:reports:{id}', () => {
      expect(shareReportKey('abc123')).toBe('share:reports:abc123');
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

  describe('namespace separation', () => {
    it('share keys never collide with sync keys', () => {
      const shareKeys = [shareHashKey('a'), shareReportKey('a')];
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
    });
  });
});
