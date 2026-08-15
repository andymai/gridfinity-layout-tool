import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { deriveDonorId } from './supporters.js';
import { deriveAuthorPublicId } from './communityIds.js';
import { supportersAuthorsKey, supportersDonorsKey, supportersLinkKey } from './redisKeys.js';
import {
  MAX_DONOR_CANDIDATES,
  deriveDonorCandidates,
  linkSupporterAccount,
  readSupporterLink,
  resolveSupporterAuthors,
  setSupporterBadgePublic,
  unlinkSupporterAccount,
} from './supporterLink.js';

/** Just enough Redis for this module: strings with SET NX, sets, and hashes. */
function makeRedisMock() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const hashes = new Map<string, Map<string, string>>();
  const hashOf = (k: string) => {
    const h = hashes.get(k) ?? new Map<string, string>();
    hashes.set(k, h);
    return h;
  };
  return {
    store,
    sets,
    hashes,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string, ...args: string[]) => {
      if (args.includes('NX') && store.has(k)) return null;
      store.set(k, v);
      return 'OK';
    }),
    del: vi.fn(async (...keys: string[]) => {
      let removed = 0;
      for (const k of keys) if (store.delete(k)) removed++;
      return removed;
    }),
    sadd: vi.fn(async (k: string, ...members: string[]) => {
      const s = sets.get(k) ?? new Set<string>();
      let added = 0;
      for (const m of members) {
        if (s.has(m)) continue;
        s.add(m);
        added++;
      }
      sets.set(k, s);
      return added;
    }),
    srem: vi.fn(async (k: string, ...members: string[]) => {
      const s = sets.get(k);
      if (!s) return 0;
      let removed = 0;
      for (const m of members) if (s.delete(m)) removed++;
      return removed;
    }),
    smismember: vi.fn(async (k: string, ...members: string[]) => {
      const s = sets.get(k);
      return members.map((m) => (s?.has(m) ? 1 : 0));
    }),
    hget: vi.fn(async (k: string, f: string) => hashOf(k).get(f) ?? null),
    hset: vi.fn(async (k: string, f: string, v: string) => {
      hashOf(k).set(f, v);
      return 1;
    }),
    hmget: vi.fn(async (k: string, ...fields: string[]) => {
      const h = hashOf(k);
      return fields.map((f) => h.get(f) ?? null);
    }),
  } as unknown as Redis & {
    store: Map<string, string>;
    sets: Map<string, Set<string>>;
    hashes: Map<string, Map<string, string>>;
  };
}

const SALT = 'test-salt';
const originalSalt = process.env.TOKEN_SALT;

let redis: ReturnType<typeof makeRedisMock>;

beforeEach(() => {
  process.env.TOKEN_SALT = SALT;
  redis = makeRedisMock();
});

afterEach(() => {
  if (originalSalt === undefined) delete process.env.TOKEN_SALT;
  else process.env.TOKEN_SALT = originalSalt;
});

/** Seed a Ko-fi donor record keyed the way the webhook would key it. */
function seedDonor(email: string, name = 'Jo'): string {
  const donorId = deriveDonorId(email);
  if (!donorId) throw new Error('salt not set');
  const hash = redis.hashes.get(supportersDonorsKey()) ?? new Map<string, string>();
  hash.set(donorId, JSON.stringify({ n: name, t: '2026-01-02T03:04:05.000Z' }));
  redis.hashes.set(supportersDonorsKey(), hash);
  return donorId;
}

describe('deriveDonorCandidates', () => {
  it('derives one id per distinct address', () => {
    const ids = deriveDonorCandidates(['a@example.com', 'b@example.com']);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(deriveDonorId('a@example.com'));
  });

  it('collapses duplicates that differ only by case or whitespace', () => {
    expect(deriveDonorCandidates(['a@example.com', ' A@Example.com '])).toHaveLength(1);
  });

  it('skips blanks and absurdly long addresses', () => {
    expect(deriveDonorCandidates(['', '   ', `${'x'.repeat(400)}@example.com`])).toEqual([]);
  });

  it('caps how many addresses one sign-in may probe', () => {
    const many = Array.from({ length: MAX_DONOR_CANDIDATES + 5 }, (_, i) => `u${i}@example.com`);
    expect(deriveDonorCandidates(many)).toHaveLength(MAX_DONOR_CANDIDATES);
  });

  it('yields nothing without TOKEN_SALT rather than a reversible digest', () => {
    delete process.env.TOKEN_SALT;
    expect(deriveDonorCandidates(['a@example.com'])).toEqual([]);
  });
});

describe('linkSupporterAccount', () => {
  it('links the account when a verified address matches a donor record', async () => {
    seedDonor('kofi@example.com');
    const link = await linkSupporterAccount(redis, 'user-1', [
      ...deriveDonorCandidates(['work@example.com', 'kofi@example.com']),
    ]);
    expect(link).toEqual({ donorId: deriveDonorId('kofi@example.com'), badgePublic: true });
  });

  it('publishes the badge under the author public id, not the user id', async () => {
    seedDonor('kofi@example.com');
    await linkSupporterAccount(redis, 'user-1', deriveDonorCandidates(['kofi@example.com']));
    const badged = redis.sets.get(supportersAuthorsKey());
    expect([...(badged ?? [])]).toEqual([deriveAuthorPublicId('user-1')]);
    expect(badged?.has('user-1')).toBe(false);
  });

  it('returns null when no candidate supported', async () => {
    seedDonor('someone-else@example.com');
    expect(
      await linkSupporterAccount(redis, 'user-1', deriveDonorCandidates(['kofi@example.com']))
    ).toBeNull();
  });

  it('returns null for an account with no candidates at all', async () => {
    expect(await linkSupporterAccount(redis, 'user-1', [])).toBeNull();
  });

  it('is idempotent across sign-ins', async () => {
    seedDonor('kofi@example.com');
    const candidates = deriveDonorCandidates(['kofi@example.com']);
    const first = await linkSupporterAccount(redis, 'user-1', candidates);
    const second = await linkSupporterAccount(redis, 'user-1', candidates);
    expect(second).toEqual(first);
  });

  it('does not re-publish a badge the supporter turned off', async () => {
    seedDonor('kofi@example.com');
    const candidates = deriveDonorCandidates(['kofi@example.com']);
    const link = await linkSupporterAccount(redis, 'user-1', candidates);
    if (!link) throw new Error('expected a link');
    await setSupporterBadgePublic(redis, 'user-1', link, false);

    // A later sign-in runs the same match again; the stored preference wins.
    const relinked = await linkSupporterAccount(redis, 'user-1', candidates);
    expect(relinked?.badgePublic).toBe(false);
    expect(redis.sets.get(supportersAuthorsKey())?.size ?? 0).toBe(0);
  });

  it('leaves a donor record claimed by another account alone', async () => {
    const donorId = seedDonor('shared@example.com');
    await redis.set(supportersLinkKey(donorId), 'user-first');

    expect(
      await linkSupporterAccount(
        redis,
        'user-second',
        deriveDonorCandidates(['shared@example.com'])
      )
    ).toBeNull();
    expect(await redis.get(supportersLinkKey(donorId))).toBe('user-first');
  });

  it('falls through a contested candidate to one that is still free', async () => {
    const taken = seedDonor('shared@example.com');
    seedDonor('mine@example.com');
    await redis.set(supportersLinkKey(taken), 'user-first');

    const link = await linkSupporterAccount(
      redis,
      'user-second',
      deriveDonorCandidates(['shared@example.com', 'mine@example.com'])
    );
    expect(link?.donorId).toBe(deriveDonorId('mine@example.com'));
  });
});

describe('resolveSupporterAuthors', () => {
  it('returns only the badged authors', async () => {
    seedDonor('kofi@example.com');
    await linkSupporterAccount(redis, 'user-1', deriveDonorCandidates(['kofi@example.com']));
    const badged = await resolveSupporterAuthors(redis, [
      deriveAuthorPublicId('user-1') ?? '',
      deriveAuthorPublicId('user-2') ?? '',
    ]);
    expect(badged.has(deriveAuthorPublicId('user-1') ?? '')).toBe(true);
    expect(badged.has(deriveAuthorPublicId('user-2') ?? '')).toBe(false);
  });

  it('costs one entry per author, not one per design', async () => {
    seedDonor('kofi@example.com');
    await linkSupporterAccount(redis, 'user-1', deriveDonorCandidates(['kofi@example.com']));
    const author = deriveAuthorPublicId('user-1') ?? '';
    const badged = await resolveSupporterAuthors(redis, [author, author, author]);
    expect(badged.size).toBe(1);
  });

  it('makes no Redis call for an empty page', async () => {
    expect((await resolveSupporterAuthors(redis, [])).size).toBe(0);
    expect(redis.smismember).not.toHaveBeenCalled();
  });

  it('degrades to no badges rather than failing the page', async () => {
    vi.mocked(redis.smismember).mockRejectedValueOnce(new Error('redis down'));
    await expect(resolveSupporterAuthors(redis, ['author-1'])).resolves.toEqual(new Set());
  });
});

describe('setSupporterBadgePublic', () => {
  it('retracts and restores the badge, persisting the choice', async () => {
    seedDonor('kofi@example.com');
    const link = await linkSupporterAccount(
      redis,
      'user-1',
      deriveDonorCandidates(['kofi@example.com'])
    );
    if (!link) throw new Error('expected a link');

    await setSupporterBadgePublic(redis, 'user-1', link, false);
    expect((await readSupporterLink(redis, 'user-1'))?.badgePublic).toBe(false);
    expect(redis.sets.get(supportersAuthorsKey())?.size ?? 0).toBe(0);

    await setSupporterBadgePublic(redis, 'user-1', link, true);
    expect((await readSupporterLink(redis, 'user-1'))?.badgePublic).toBe(true);
    expect(redis.sets.get(supportersAuthorsKey())?.size).toBe(1);
  });
});

describe('unlinkSupporterAccount', () => {
  it('drops the binding and the badge but keeps the donor record on the wall', async () => {
    const donorId = seedDonor('kofi@example.com', 'Jo');
    await linkSupporterAccount(redis, 'user-1', deriveDonorCandidates(['kofi@example.com']));

    await unlinkSupporterAccount(redis, 'user-1');

    expect(await readSupporterLink(redis, 'user-1')).toBeNull();
    expect(redis.sets.get(supportersAuthorsKey())?.size ?? 0).toBe(0);
    expect(await redis.get(supportersLinkKey(donorId))).toBeNull();
    // The wall is unchanged: deleting an account must not quietly reduce the count.
    expect(redis.hashes.get(supportersDonorsKey())?.get(donorId)).toContain('Jo');
  });

  it('lets the same person re-claim their donor record after deleting the account', async () => {
    seedDonor('kofi@example.com');
    const candidates = deriveDonorCandidates(['kofi@example.com']);
    await linkSupporterAccount(redis, 'user-1', candidates);
    await unlinkSupporterAccount(redis, 'user-1');

    const relinked = await linkSupporterAccount(redis, 'user-2', candidates);
    expect(relinked?.donorId).toBe(deriveDonorId('kofi@example.com'));
  });

  it('never releases a claim held by a different account', async () => {
    const donorId = seedDonor('shared@example.com');
    await redis.set(supportersLinkKey(donorId), 'user-first');
    await unlinkSupporterAccount(redis, 'user-second');
    expect(await redis.get(supportersLinkKey(donorId))).toBe('user-first');
  });
});
