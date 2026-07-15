import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis } from './lib/rateLimit.js';
import { logger } from './lib/logger.js';
import { ErrorCode, methodNotAllowed } from './lib/shared.js';
import { supportersDonorsKey, supportersMessageKey } from './lib/redisKeys.js';
import {
  MESSAGE_DEDUPE_TTL_SECONDS,
  deriveDonorId,
  messageDedupeId,
  normalizeDisplayName,
  parseKofiPayload,
} from './lib/supporters.js';

/** Cheap liveness probe used to tell a rate-limit rejection from a Redis outage. */
async function isRedisReachable(redis: Redis): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

/** Constant-time compare that can't leak length via an early return. */
function tokensMatch(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Ko-fi webhook receiver — the only way a new supporter reaches /supporters.
 *
 * Ko-fi POSTs form-encoded with a single `data` JSON field on every payment.
 * There is no read API to poll and no replay endpoint, so this is a one-shot
 * feed: whatever we fail to record here is gone.
 *
 * Order matters, and it is deliberately the reverse of every other endpoint
 * here. Elsewhere `checkRateLimit` runs first because there is no cheaper gate
 * available. This endpoint has one: comparing the verification token reads an
 * env var and touches no I/O, whereas `checkRateLimit` costs a Redis round
 * trip. Verifying first makes a flood of forged requests free to reject;
 * rate-limiting first would charge us a Redis op for each one, making the
 * cheapest attack more expensive to absorb, not less.
 *
 * Rate limiting therefore sits behind the token as a blast-radius cap on a
 * *leaked* token, which is the only way past the first gate. Note the token
 * lives inside the JSON body, so Ko-fi's format forces a parse before any
 * verification — that parse is the one thing an unauthenticated caller can
 * make us do, and Vercel's body cap bounds it.
 *
 * Stored: a pseudonymous donor id (see `deriveDonorId`) and a display name.
 * Never stored: the email, the amount, or the message the supporter left.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  // Ko-fi posts form-encoded. Accept JSON too rather than pinning to the exact
  // header they happen to send today: a wrong guess here 415s every delivery,
  // and with no replay that loses the supporters outright. The body shape (and
  // the token inside it) is the real check — this only turns away callers that
  // were never going to parse.
  const contentType = req.headers['content-type'] ?? '';
  if (!/application\/(x-www-form-urlencoded|json)/i.test(contentType)) {
    logger.warn('Ko-fi webhook rejected: unexpected content-type', { contentType });
    return res.status(415).json({
      error: 'Unsupported content type.',
      code: ErrorCode.VALIDATION_ERROR,
    });
  }

  const expectedToken = process.env.KOFI_VERIFICATION_TOKEN;
  if (!expectedToken) {
    // Fail closed: without the token we cannot tell Ko-fi from anyone else, and
    // this endpoint writes to a public page.
    logger.error('Ko-fi webhook rejected: KOFI_VERIFICATION_TOKEN is not configured');
    return res.status(503).json({
      error: 'Supporter sync is not configured.',
      code: ErrorCode.CONFIGURATION_ERROR,
    });
  }

  const payload = parseKofiPayload(req.body);
  if (!payload) {
    return res.status(400).json({
      error: 'Malformed Ko-fi payload.',
      code: ErrorCode.VALIDATION_ERROR,
    });
  }

  if (!tokensMatch(payload.verification_token, expectedToken)) {
    logger.warn('Ko-fi webhook rejected: verification token mismatch');
    return res.status(401).json({ error: 'Invalid token.', code: ErrorCode.UNAUTHORIZED });
  }

  try {
    // `getRedis()` only returns null when REDIS_URL is *unset* — it constructs
    // a client fine when the server is simply unreachable, so this guard alone
    // does not cover an outage. See the rate-limit branch below.
    const redis = getRedis();
    if (!redis) {
      logger.error('Ko-fi webhook failed: REDIS_URL not configured');
      return res.status(503).json({
        error: 'Supporter store unavailable.',
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }

    const rateLimit = await checkRateLimit(getClientIP(req), 'kofi.webhook');
    if (!rateLimit.allowed) {
      // `checkRateLimit` fails closed: it swallows Redis errors and returns
      // `allowed: false`, which is indistinguishable from a genuine rejection.
      // Those need different answers here — a real limit is 429, but an outage
      // must be a 503 so Ko-fi's retry brings the supporter back. This feed has
      // no replay, so guessing wrong loses them permanently. One ping, only on
      // the rejection path, tells the two apart.
      if (!(await isRedisReachable(redis))) {
        logger.error('Ko-fi webhook failed: Redis unreachable');
        return res.status(503).json({
          error: 'Supporter store unavailable.',
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
      }
      return res.status(429).json({
        error: 'Too many webhook deliveries.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Dedupe Ko-fi's retries. SET NX returns null when the key already exists.
    const firstDelivery = await redis.set(
      supportersMessageKey(messageDedupeId(payload.message_id)),
      '1',
      'EX',
      MESSAGE_DEDUPE_TTL_SECONDS,
      'NX'
    );
    if (firstDelivery === null) {
      return res.status(200).json({ ok: true, deduped: true });
    }

    // Subscription renewals are the same person as the first payment. Skipping
    // them keeps one bin per supporter even if the email is missing (below).
    if (payload.is_subscription_payment && payload.is_first_subscription_payment === false) {
      return res.status(200).json({ ok: true, renewal: true });
    }

    // No email (or no salt to hash it with) means we cannot recognise this
    // person again — mint a random id so they still get a bin rather than
    // silently colliding with someone else.
    const donorId = payload.email ? deriveDonorId(payload.email) : null;
    const displayName = normalizeDisplayName(payload.from_name, payload.is_public);

    await redis.hset(supportersDonorsKey(), donorId ?? `anon-${randomUUID()}`, displayName ?? '');

    return res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('Ko-fi webhook error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to record supporter.',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}
