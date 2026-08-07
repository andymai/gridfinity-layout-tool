/**
 * The user id used to be `sha256(provider:subject)` with no salt. GitHub's
 * `providerSubject` is a public, sequential, bounded (~2^28) account id, so the
 * entire output space was precomputable: anyone holding a single Redis key of
 * these ids could name the GitHub account behind every pseudonymous reporter,
 * liker and publisher.
 *
 * It is now a random id behind a salted identity map. Accounts created under
 * the old scheme are ADOPTED rather than rotated — `authorPublicId` derives
 * from `userId` and is baked into print-photo Blob paths that are already
 * public URLs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { resolveUserId } from './userId';
import { communityPublishedKey, userIdentityKey, userIndexKey, userProfileKey } from './redisKeys';

const SALT = 'test-salt';

/** The pre-map derivation, reproduced here so the adoption path is pinned. */
function legacyUserId(provider: string, subject: string): string {
  return createHash('sha256').update(`${provider}:${subject}`).digest('hex').slice(0, 32);
}

function createRedis() {
  const strings = new Map<string, string>();
  return {
    strings,
    get: vi.fn(async (key: string) => strings.get(key) ?? null),
    // Mirrors Redis EXISTS: takes many keys, returns how many are present.
    exists: vi.fn(async (...keys: string[]) => keys.filter((k) => strings.has(k)).length),
    set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
      if (args.includes('NX') && strings.has(key)) return null;
      strings.set(key, value);
      return 'OK' as const;
    }),
  };
}

type FakeRedis = ReturnType<typeof createRedis>;
const asRedis = (redis: FakeRedis) => redis as unknown as Parameters<typeof resolveUserId>[0];

describe('resolveUserId', () => {
  let redis: FakeRedis;

  beforeEach(() => {
    vi.stubEnv('TOKEN_SALT', SALT);
    redis = createRedis();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('new account', () => {
    it('mints a 32-char hex id', async () => {
      const uid = await resolveUserId(asRedis(redis), 'github', '12345');
      expect(uid).toMatch(/^[a-f0-9]{32}$/);
    });

    it('is not the unsalted hash of the identity', async () => {
      const uid = await resolveUserId(asRedis(redis), 'github', '12345');
      expect(uid).not.toBe(legacyUserId('github', '12345'));
    });

    // The core property: with no derivation there is no input to recover, so a
    // rainbow table over the GitHub id space buys nothing even given the salt.
    it('is unpredictable across identical calls on a fresh store', async () => {
      const first = await resolveUserId(asRedis(redis), 'github', '12345');
      const second = await resolveUserId(asRedis(createRedis()), 'github', '12345');
      expect(first).not.toBe(second);
    });

    it('is stable for the same identity once mapped', async () => {
      const first = await resolveUserId(asRedis(redis), 'github', '12345');
      const second = await resolveUserId(asRedis(redis), 'github', '12345');
      expect(second).toBe(first);
    });

    it('separates identities across providers and subjects', async () => {
      const a = await resolveUserId(asRedis(redis), 'github', 'shared');
      const b = await resolveUserId(asRedis(redis), 'google', 'shared');
      const c = await resolveUserId(asRedis(redis), 'github', 'other');
      expect(new Set([a, b, c]).size).toBe(3);
    });
  });

  describe('legacy account adoption', () => {
    it('keeps the legacy id when a profile exists under it', async () => {
      const legacy = legacyUserId('github', '999');
      redis.strings.set(userProfileKey(legacy), JSON.stringify({ userId: legacy }));

      expect(await resolveUserId(asRedis(redis), 'github', '999')).toBe(legacy);
    });

    it('records the adoption so it resolves without the profile probe next time', async () => {
      const legacy = legacyUserId('github', '999');
      redis.strings.set(userProfileKey(legacy), JSON.stringify({ userId: legacy }));
      await resolveUserId(asRedis(redis), 'github', '999');

      const key = userIdentityKey('github', '999');
      expect(key).not.toBeNull();
      expect(redis.strings.get(String(key))).toBe(legacy);
    });

    // The profile carries a 1-year TTL refreshed on sign-in; the sync indexes
    // and the published set have none. A user dormant for over a year has an
    // expired profile and fully intact data, so probing the profile alone
    // signed them into an empty account and stranded everything they owned.
    it.each([
      ['layouts index', (uid: string) => userIndexKey(uid, 'layouts')],
      ['designs index', (uid: string) => userIndexKey(uid, 'designs')],
      ['baseplates index', (uid: string) => userIndexKey(uid, 'baseplates')],
      ['published set', (uid: string) => communityPublishedKey(uid)],
    ])('adopts on a surviving %s when the profile has expired', async (_label, keyFor) => {
      const legacy = legacyUserId('google', 'dormant');
      redis.strings.set(keyFor(legacy), 'present');

      expect(await resolveUserId(asRedis(redis), 'google', 'dormant')).toBe(legacy);
    });

    it('probes the durable keys in one round trip', async () => {
      await resolveUserId(asRedis(redis), 'google', 'dormant');
      expect(redis.exists).toHaveBeenCalledTimes(1);
      expect(redis.exists.mock.calls[0].length).toBeGreaterThan(1);
    });

    it('mints a fresh id when no legacy state exists at all', async () => {
      const uid = await resolveUserId(asRedis(redis), 'github', '999');
      expect(uid).not.toBe(legacyUserId('github', '999'));
    });

    // A deleted account's profile is gone, so a re-login must NOT resurrect the
    // legacy id and re-adopt whatever state the cascade failed to clear.
    it('does not adopt a legacy id whose profile was deleted', async () => {
      const uid = await resolveUserId(asRedis(redis), 'google', 'deleted-user');
      expect(uid).not.toBe(legacyUserId('google', 'deleted-user'));
    });
  });

  describe('concurrent first sign-in', () => {
    it('returns the winner id to a caller that lost the SET NX race', async () => {
      const rival = 'f'.repeat(32);
      const key = String(userIdentityKey('github', '777'));
      // Simulate a rival mapping the identity between our GET and our SET.
      redis.set.mockImplementationOnce(async () => {
        redis.strings.set(key, rival);
        return null;
      });

      expect(await resolveUserId(asRedis(redis), 'github', '777')).toBe(rival);
    });

    it('never splits one identity across two ids', async () => {
      const [a, b] = await Promise.all([
        resolveUserId(asRedis(redis), 'github', '888'),
        resolveUserId(asRedis(redis), 'github', '888'),
      ]);
      expect(a).toBe(b);
    });
  });

  describe('without TOKEN_SALT', () => {
    // Falling back to an unsalted map key would rebuild the exact join this
    // replaces: sha256(github:N) -> userId.
    it('refuses to resolve rather than writing an unsalted key', async () => {
      vi.stubEnv('TOKEN_SALT', '');
      expect(await resolveUserId(asRedis(redis), 'github', '12345')).toBeNull();
      expect(redis.set).not.toHaveBeenCalled();
    });
  });
});

describe('userIdentityKey', () => {
  beforeEach(() => vi.stubEnv('TOKEN_SALT', SALT));
  afterEach(() => vi.unstubAllEnvs());

  it('does not embed the raw subject', () => {
    expect(userIdentityKey('github', '12345')).not.toContain('12345');
  });

  it('is not derivable without the salt', () => {
    const salted = userIdentityKey('github', '12345');
    vi.stubEnv('TOKEN_SALT', 'different-salt');
    expect(userIdentityKey('github', '12345')).not.toBe(salted);
  });

  it('returns null without a salt', () => {
    vi.stubEnv('TOKEN_SALT', '');
    expect(userIdentityKey('github', '12345')).toBeNull();
  });
});
