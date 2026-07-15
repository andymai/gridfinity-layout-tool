import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import { filterDisplayName } from './contentFilter.js';
import { supportersDonorsKey } from './redisKeys.js';

/** Public shape served by `/api/supporters` and mirrored by the bundled JSON fallback. */
export interface SupportersPayload {
  named: string[];
  anonymousCount: number;
}

/** The subset of Ko-fi's webhook `data` payload we act on. Everything else is discarded. */
export interface KofiPayload {
  verification_token: string;
  message_id: string;
  from_name?: string | null;
  is_public?: boolean;
  email?: string | null;
  is_subscription_payment?: boolean;
  is_first_subscription_payment?: boolean;
}

/** Ko-fi allows long names; the tape texture wraps but can't absorb an essay. */
export const MAX_DISPLAY_NAME_LENGTH = 32;

/** Webhook dedupe markers only need to outlive Ko-fi's retry window. */
export const MESSAGE_DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Derive a stable, pseudonymous donor id from a Ko-fi email.
 *
 * PRIVACY: the raw email is never stored — only this hash, and only as a Redis
 * field name so repeat donations from one person collapse onto one bin instead
 * of minting a new one every subscription renewal.
 *
 * The salt is load-bearing, not decoration: an unsalted SHA-256 of an email is
 * reversible by brute-forcing a wordlist, so it would *be* an email for privacy
 * purposes. Without TOKEN_SALT configured we refuse to derive an id at all
 * (callers fall back to a random id) rather than write a reversible digest.
 */
export function deriveDonorId(email: string): string | null {
  const salt = process.env.TOKEN_SALT;
  if (!salt) return null;
  return createHash('sha256')
    .update(`${salt}:kofi:${email.trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Hash `message_id` into the fixed-length, charset-safe half of its Redis key.
 *
 * Once a token leaks, `message_id` is attacker-shaped: it could carry null
 * bytes, newlines, or be arbitrarily long. Redis keys are binary-safe and have
 * no path semantics, so there's no injection here — but hashing keeps the
 * keyspace tidy and bounded regardless of input.
 *
 * Deliberately a hash rather than a validate-and-reject: this feed has no
 * replay, so rejecting an unexpected id shape would lose that supporter for
 * good. Hashing can't false-negative.
 */
export function messageDedupeId(messageId: string): string {
  return createHash('sha256').update(messageId).digest('hex').slice(0, 32);
}

/**
 * Reduce a Ko-fi `from_name` to something safe to render, or null for "show as
 * anonymous".
 *
 * Null covers every case where we can't confidently show a name: the supporter
 * opted out of a public shout-out, left the field blank, or typed something the
 * content filter rejects. All three land on the same equal-looking bin.
 */
export function normalizeDisplayName(
  rawName: string | null | undefined,
  isPublic: boolean | undefined
): string | null {
  if (isPublic === false) return null;
  // Cap BEFORE filtering, not after. Two reasons, one of them a bug:
  //  - `from_name` is unbounded attacker input once a token leaks, and the
  //    filter runs backtracking regexes over it. Capping first keeps that work
  //    constant instead of quadratic in the payload size.
  //  - It's also the more honest check: we render at most this many characters,
  //    so this is exactly the text that needs to survive the filter.
  const trimmed = (rawName ?? '').trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  if (!trimmed) return null;
  if (!filterDisplayName(trimmed).passed) return null;
  return trimmed;
}

/**
 * Parse Ko-fi's form-encoded webhook body.
 *
 * Ko-fi POSTs `application/x-www-form-urlencoded` with a single `data` field
 * holding the JSON. Returns null on anything unparseable so the caller can
 * reject without throwing.
 */
export function parseKofiPayload(body: unknown): KofiPayload | null {
  const raw = typeof body === 'object' && body !== null && 'data' in body ? body.data : null;
  if (typeof raw !== 'string') return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const candidate = parsed as Partial<KofiPayload>;
  if (typeof candidate.verification_token !== 'string') return null;
  if (typeof candidate.message_id !== 'string' || !candidate.message_id) return null;

  return candidate as KofiPayload;
}

/**
 * Read the supporter list out of Redis.
 *
 * Named order is whatever Redis hands back; the page shuffles on render anyway,
 * so no one is permanently first.
 */
export async function readSupporters(redis: Redis): Promise<SupportersPayload> {
  const donors = await redis.hgetall(supportersDonorsKey());
  const named: string[] = [];
  let anonymousCount = 0;

  for (const name of Object.values(donors)) {
    if (name) named.push(name);
    else anonymousCount += 1;
  }

  return { named, anonymousCount };
}
