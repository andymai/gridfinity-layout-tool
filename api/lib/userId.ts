import { createHash, randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import {
  communityPublishedKey,
  userIdentityKey,
  userIndexKey,
  userProfileKey,
} from './redisKeys.js';

export type AuthProvider = 'google' | 'github';

/**
 * The ORIGINAL derivation: `sha256(provider:subject)`, unsalted.
 *
 * Kept only to recognize accounts created before the lookup table below. It
 * must never mint an id for a new account: GitHub's `providerSubject` is a
 * public, sequential, bounded (~2^28) account id, so the whole output space is
 * precomputable. Anyone who obtained a single Redis key holding these ids — a
 * `community:reports:{id}` set from a backup, say — could match every member
 * against a rainbow table and name the GitHub account behind each pseudonymous
 * reporter, liker or publisher.
 */
function deriveLegacyUserId(provider: AuthProvider, providerSubject: string): string {
  return createHash('sha256').update(`${provider}:${providerSubject}`).digest('hex').slice(0, 32);
}

/**
 * A fresh, opaque user id.
 *
 * Random rather than derived, which is strictly stronger than the salted hash
 * the sibling derivations (`deriveDonorId`, `deriveAuthorPublicId`) use: those
 * stay reversible to anyone who holds both the salt and the input space, while
 * this has no input to recover. The provider identity is reachable only
 * through the salted lookup key, never from the id itself.
 *
 * 32 hex chars = 128 bits, matching the width every existing id and Blob path
 * is built around.
 */
function generateUserId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Resolve `(provider, subject)` to this deployment's user id, minting one on
 * first sign-in.
 *
 * Three cases, in order:
 *   1. The identity is already mapped — return it. The steady state.
 *   2. No mapping, but DURABLE state exists under the legacy derivation —
 *      ADOPT that id into the map and return it. The user keeps their layouts,
 *      designs and published community records, and not a single key or blob
 *      moves. Their id stays reversible, which is the deliberate limit of this
 *      change: `authorPublicId` is derived from `userId` and is baked into
 *      print-photo Blob paths that are already public URLs, so rotating an
 *      existing id means rewriting content that has already been handed out.
 *   3. Neither — mint a random id and map it.
 *
 * Concurrent first sign-ins race on step 3; `SET NX` decides the winner and
 * the loser re-reads, so two tabs can never split one identity across two ids.
 *
 * Returns null when TOKEN_SALT is unset, matching `deriveDonorId` and
 * `deriveAuthorPublicId`: the caller must fail the sign-in rather than fall
 * back to an unsalted key. An unsalted map key would reproduce the exact
 * vulnerability this replaces — `uidmap:{sha256(github:N)} -> userId` is the
 * join that turns a leaked id back into an account.
 */
export async function resolveUserId(
  redis: Redis,
  provider: AuthProvider,
  providerSubject: string
): Promise<string | null> {
  const identityKey = userIdentityKey(provider, providerSubject);
  if (identityKey === null) return null;

  const mapped = await redis.get(identityKey);
  if (mapped !== null && mapped !== '') return mapped;

  const legacyId = deriveLegacyUserId(provider, providerSubject);
  // Probe the DURABLE keys, not just the profile. The profile carries a 1-year
  // TTL refreshed on sign-in, while the sync indexes and the published set
  // have none — so a user dormant for over a year has an expired profile and
  // fully intact data. Testing the profile alone would mint them a new id and
  // sign them into an empty account while their layouts, designs and published
  // community records sat stranded under the legacy id, unreachable.
  //
  // EXISTS takes multiple keys and returns how many are present, so this stays
  // one round trip.
  const legacyExists =
    (await redis.exists(
      userProfileKey(legacyId),
      userIndexKey(legacyId, 'layouts'),
      userIndexKey(legacyId, 'designs'),
      userIndexKey(legacyId, 'baseplates'),
      communityPublishedKey(legacyId)
    )) > 0;

  const candidate = legacyExists ? legacyId : generateUserId();
  const won = await redis.set(identityKey, candidate, 'NX');
  if (won === 'OK') return candidate;

  // Lost the race: another sign-in for this identity mapped it first. Its
  // value is authoritative — returning our own candidate would hand this
  // session a second id for one person.
  const winner = await redis.get(identityKey);
  return winner !== null && winner !== '' ? winner : candidate;
}
