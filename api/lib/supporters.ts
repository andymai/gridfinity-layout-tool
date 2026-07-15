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

/**
 * Characters that must never reach a rendered supporter name:
 *   C0/C1 controls (incl. NUL)  - junk that can break the tape texture and the
 *                                 sr-only list, and has no place in a name.
 *   zero-width + BOM            - invisible padding used to smuggle text past
 *                                 eyeballs.
 *   bidi overrides/isolates     - U+202E and friends re-order rendered text, so
 *                                 a name can display as something it isn't.
 *
 * `contentFilter` folds these for *matching* but hands back the original
 * string, so stripping is on us.
 *
 * A code-point scan rather than a regex: a character class covering C0 trips
 * `no-control-regex`, and the rule is right that control characters in a regex
 * are usually a mistake. Same loop shape as `normalizeForBlocklist` in
 * `contentFilter.ts`.
 */
function isUnsafeNameCodePoint(cp: number): boolean {
  return (
    cp <= 0x1f || // C0 controls, incl. NUL
    (cp >= 0x7f && cp <= 0x9f) || // DEL + C1 controls
    (cp >= 0x200b && cp <= 0x200d) || // zero-width space/non-joiner/joiner
    cp === 0xfeff || // BOM / zero-width no-break space
    (cp >= 0x202a && cp <= 0x202e) || // bidi embeddings + overrides
    (cp >= 0x2066 && cp <= 0x2069) // bidi isolates
  );
}

function stripUnsafeNameChars(text: string): string {
  let out = '';
  for (const ch of text) {
    if (!isUnsafeNameCodePoint(ch.codePointAt(0) ?? 0)) out += ch;
  }
  return out;
}

/** Bound the sanitize pass so it stays linear in a small constant, not the payload. */
const SANITIZE_INPUT_CAP = MAX_DISPLAY_NAME_LENGTH * 8;

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

  // Bound the work first: `from_name` is unbounded attacker input once a token
  // leaks, and everything below runs regexes over it. A generous cap keeps the
  // sanitize pass cheap while still leaving room to recover a real name buried
  // in padding.
  const bounded = (rawName ?? '').trim().slice(0, SANITIZE_INPUT_CAP);

  // Strip before capping to the display length, so invisible padding can't eat
  // the budget and push the actual name off the end.
  const cleaned = stripUnsafeNameChars(bounded).trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  if (!cleaned) return null;

  // Filter last, on exactly the text we will render. This ordering is
  // load-bearing twice over: it keeps the filter's backtracking regexes on a
  // short string (they go quadratic on long input), and it means we judge what
  // is actually shown rather than characters past the cut.
  if (!filterDisplayName(cleaned).passed) return null;
  return cleaned;
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
