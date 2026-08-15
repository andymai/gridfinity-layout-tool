import type { Redis } from 'ioredis';
import { logger } from './logger.js';
import { deriveDonorId } from './supporters.js';
import { deriveAuthorPublicId } from './communityIds.js';
import {
  supportersAuthorsKey,
  supportersDonorsKey,
  supportersLinkKey,
  supportersUserKey,
} from './redisKeys.js';

/**
 * Links a signed-in account to the Ko-fi donor record it paid from, so
 * supporting can be recognized in the app without ever showing an amount or a
 * tier.
 *
 * The match runs on SALTED HASHES of provider-VERIFIED email addresses, never
 * on a raw address and never on one the user typed. That is the whole security
 * model, and it is doing two jobs at once:
 *
 *   - No oracle. A free-text "which email did you use?" field would let anyone
 *     probe `supporters:donors` for arbitrary addresses and enumerate who
 *     supports this project.
 *   - No takeover. A linked supporter can rewrite the name and message on their
 *     own bin (see `api/supporters/me.ts`), so claiming a stranger's donor
 *     record would mean editing their public presence on the wall. Restricting
 *     candidates to addresses the OAuth provider has verified for THIS account
 *     means a successful claim is, by construction, the person who owns that
 *     mailbox.
 *
 * The cost is coverage: someone who paid Ko-fi from an address that is on
 * neither their Google nor their GitHub account cannot be matched automatically
 * and has to ask. That trade is deliberate.
 */

/**
 * Cap on how many verified addresses one sign-in may probe.
 *
 * A GitHub account can carry an unbounded number of verified emails, and each
 * candidate costs an HEXISTS on the sign-in path. Ten covers a realistic
 * multi-address account with room to spare.
 */
export const MAX_DONOR_CANDIDATES = 10;

/** Bound the per-address work before hashing; an email far past this is not one. */
const MAX_EMAIL_LENGTH = 320;

/**
 * A user's supporter link: which donor record they own, and whether their
 * badge is public.
 *
 * `badgePublic` lives here rather than as bare membership in
 * `supporters:authors` because the set is rewritten on every sign-in — without
 * a persisted preference, re-linking would silently re-publish a badge the
 * supporter had turned off.
 */
export interface SupporterLink {
  donorId: string;
  badgePublic: boolean;
}

interface StoredLink {
  d: string;
  /** 0/1 rather than a boolean to keep the record byte-small; absent = public. */
  b?: number;
}

/**
 * Reduce verified addresses to the donor ids they would have been stored under.
 *
 * Returns an empty list without TOKEN_SALT (`deriveDonorId` refuses to produce
 * a reversible digest), which correctly degrades to "nobody is a supporter"
 * rather than to a wrong match.
 */
export function deriveDonorCandidates(emails: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const email of emails) {
    if (typeof email !== 'string') continue;
    const trimmed = email.trim();
    if (!trimmed || trimmed.length > MAX_EMAIL_LENGTH) continue;
    const donorId = deriveDonorId(trimmed);
    if (donorId) seen.add(donorId);
    if (seen.size >= MAX_DONOR_CANDIDATES) break;
  }
  return [...seen];
}

function parseStoredLink(raw: string | null): SupporterLink | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null) return null;
    const record = value as StoredLink;
    if (typeof record.d !== 'string' || !record.d) return null;
    return { donorId: record.d, badgePublic: record.b !== 0 };
  } catch {
    return null;
  }
}

function serializeLink(link: SupporterLink): string {
  const payload: StoredLink = { d: link.donorId };
  if (!link.badgePublic) payload.b = 0;
  return JSON.stringify(payload);
}

/** The user's existing link, or null if they have never been matched. */
export async function readSupporterLink(
  redis: Redis,
  userId: string
): Promise<SupporterLink | null> {
  return parseStoredLink(await redis.get(supportersUserKey(userId)));
}

/**
 * Publish or retract a supporter's badge.
 *
 * The `supporters:authors` set is keyed by `authorPublicId`, so a user whose id
 * can't be derived (no TOKEN_SALT) simply gets no badge — the preference is
 * still persisted, and the next successful derivation honours it.
 */
async function applyBadgeVisibility(
  redis: Redis,
  userId: string,
  badgePublic: boolean
): Promise<void> {
  const authorPublicId = deriveAuthorPublicId(userId);
  if (!authorPublicId) return;
  if (badgePublic) {
    await redis.sadd(supportersAuthorsKey(), authorPublicId);
  } else {
    await redis.srem(supportersAuthorsKey(), authorPublicId);
  }
}

/**
 * Match an account against the donor hash and bind the first candidate that
 * hits, returning the resulting link (or the existing one).
 *
 * Idempotent, and safe to call on every sign-in: an already-linked user
 * short-circuits on their stored record, so a badge they turned off is never
 * silently re-published.
 *
 * `SET NX` decides a contested donor record. Losing to another account is not
 * an error — it means that mailbox is verified on two accounts and one of them
 * claimed it first — so we simply move on to the next candidate rather than
 * failing the sign-in.
 */
export async function linkSupporterAccount(
  redis: Redis,
  userId: string,
  candidates: readonly string[]
): Promise<SupporterLink | null> {
  const existing = await readSupporterLink(redis, userId);
  if (existing) return existing;
  if (candidates.length === 0) return null;

  // One round trip for the whole candidate set: the common answer is "none of
  // these supported", and that should not cost a request per address.
  const present = await redis.hmget(supportersDonorsKey(), ...candidates);

  for (const [index, value] of present.entries()) {
    if (value === null) continue;
    const donorId = candidates[index];
    const won = await redis.set(supportersLinkKey(donorId), userId, 'NX');
    if (won !== 'OK') {
      const owner = await redis.get(supportersLinkKey(donorId));
      // Another account holds this donor record. Ours may still match a later
      // candidate, so keep looking rather than giving up.
      if (owner !== userId) continue;
    }
    const link: SupporterLink = { donorId, badgePublic: true };
    await redis.set(supportersUserKey(userId), serializeLink(link));
    await applyBadgeVisibility(redis, userId, true);
    return link;
  }
  return null;
}

/** Flip whether a linked supporter's badge shows publicly. */
export async function setSupporterBadgePublic(
  redis: Redis,
  userId: string,
  link: SupporterLink,
  badgePublic: boolean
): Promise<SupporterLink> {
  const next: SupporterLink = { ...link, badgePublic };
  await redis.set(supportersUserKey(userId), serializeLink(next));
  await applyBadgeVisibility(redis, userId, badgePublic);
  return next;
}

/**
 * Which of these community authors are badged supporters.
 *
 * One SMISMEMBER for a whole gallery page. The ids passed in are
 * `authorPublicId`s, which already appear on every public card, so this reads
 * nothing the caller did not already have.
 *
 * Fails SOFT, and that asymmetry is deliberate: this decorates the gallery and
 * the design detail, which are core browsing surfaces, so a Redis hiccup here
 * must cost a badge rather than the page. Degrading to "nobody is badged" is
 * also the safe direction — the failure mode is a missing badge, never a
 * wrongly granted one.
 */
export async function resolveSupporterAuthors(
  redis: Redis,
  authorPublicIds: readonly string[]
): Promise<Set<string>> {
  const unique = [...new Set(authorPublicIds.filter(Boolean))];
  if (unique.length === 0) return new Set();
  let flags: (number | null)[];
  try {
    flags = await redis.smismember(supportersAuthorsKey(), ...unique);
  } catch (error) {
    logger.warn('Supporter badge lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Set();
  }
  const badged = new Set<string>();
  for (const [index, flag] of flags.entries()) {
    if (flag === 1) badged.add(unique[index]);
  }
  return badged;
}

/**
 * Release a user's supporter link on account deletion.
 *
 * The donor record itself survives — it is the wall, and it carries no user
 * identifier — but the binding and the badge must go, or a deleted account
 * would keep a public badge and permanently lock a donor record that its owner
 * could otherwise re-claim by signing in again.
 */
export async function unlinkSupporterAccount(redis: Redis, userId: string): Promise<void> {
  const link = await readSupporterLink(redis, userId);
  await applyBadgeVisibility(redis, userId, false);
  await redis.del(supportersUserKey(userId));
  if (link) {
    // Only clear the claim if it is still ours: another account can never hold
    // it (SET NX), but a partially-applied earlier delete could have.
    const owner = await redis.get(supportersLinkKey(link.donorId));
    if (owner === userId) await redis.del(supportersLinkKey(link.donorId));
  }
}
