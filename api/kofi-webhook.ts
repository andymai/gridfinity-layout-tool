import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis } from './lib/rateLimit.js';
import { logger } from './lib/logger.js';
import { ErrorCode, methodNotAllowed } from './lib/shared.js';
import { supportersDonorsKey, supportersMessageKey } from './lib/redisKeys.js';
import {
  MESSAGE_DEDUPE_TTL_SECONDS,
  deriveDonorId,
  normalizeDisplayName,
  parseKofiPayload,
} from './lib/supporters.js';

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
 * Order matters. The verification token is checked before we touch Redis, so a
 * forged request costs no round trip. Rate limiting sits behind that as a
 * backstop for a leaked token.
 *
 * Stored: a pseudonymous donor id (see `deriveDonorId`) and a display name.
 * Never stored: the email, the amount, or the message the supporter left.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

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
    const rateLimit = await checkRateLimit(getClientIP(req), 'kofi.webhook');
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many webhook deliveries.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const redis = getRedis();
    if (!redis) {
      // 503 rather than 200: Ko-fi retries on failure, and this feed has no
      // backfill, so a silent 200 here would lose the supporter for good.
      logger.error('Ko-fi webhook failed: Redis unavailable');
      return res.status(503).json({
        error: 'Supporter store unavailable.',
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }

    // Dedupe Ko-fi's retries. SET NX returns null when the key already exists.
    const firstDelivery = await redis.set(
      supportersMessageKey(payload.message_id),
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
