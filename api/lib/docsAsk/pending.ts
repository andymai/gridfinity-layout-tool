import { createHmac, timingSafeEqual } from 'crypto';
import type { Redis } from 'ioredis';
import { docsAskResumeKey } from '../redisKeys.js';
import type { ClientResult } from './clientTools.js';

export const PENDING_TTL_MS = 15 * 60 * 1000;
// Longer than the envelope lives, so a nonce cannot be claimed again before it expires.
const NONCE_TTL_SECONDS = Math.ceil(PENDING_TTL_MS / 1000) + 60;

/**
 * A turn that waits for the reader's browser: what the model said so far,
 * the browser results that earlier rounds of the turn got, and the rounds
 * used. The server keeps no state, so the panel holds this signed copy and
 * sends it back with the new results.
 */
export interface PendingFields {
  readonly question: string;
  readonly page: string;
  readonly locale: string;
  readonly messages: readonly unknown[];
  readonly results: readonly ClientResult[];
  readonly rounds: number;
  readonly issuedAt: number;
  readonly nonce: string;
}

export function pendingSignature(key: string, pending: PendingFields): string {
  return createHmac('sha256', key)
    .update(
      JSON.stringify([
        'pending',
        pending.question,
        pending.page,
        pending.locale,
        pending.messages,
        pending.results,
        pending.rounds,
        pending.issuedAt,
        pending.nonce,
      ])
    )
    .digest('hex');
}

export function pendingCheck(
  key: string,
  pending: PendingFields & { readonly signature: string },
  now: number
): 'ok' | 'forged' | 'expired' {
  const expected = Buffer.from(pendingSignature(key, pending), 'hex');
  const given = Buffer.from(pending.signature, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return 'forged';
  return now - pending.issuedAt > PENDING_TTL_MS || pending.issuedAt > now ? 'expired' : 'ok';
}

const localNonces = new Map<string, number>();

/**
 * Claims a nonce once, so a resume cannot run twice. Without Redis only a
 * development server goes on, with a set in memory; production has no replay
 * protection then, so it refuses.
 */
export async function claimNonce(
  redis: Redis | null,
  nonce: string,
  production: boolean,
  now: number
): Promise<'claimed' | 'used' | 'unavailable'> {
  if (redis) {
    const set = await redis.set(docsAskResumeKey(nonce), '1', 'EX', NONCE_TTL_SECONDS, 'NX');
    return set === 'OK' ? 'claimed' : 'used';
  }
  if (production) return 'unavailable';
  for (const [held, at] of localNonces) {
    if (now - at > NONCE_TTL_SECONDS * 1000) localNonces.delete(held);
  }
  if (localNonces.has(nonce)) return 'used';
  localNonces.set(nonce, now);
  return 'claimed';
}
