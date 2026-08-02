import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import { logger } from '../lib/logger.js';
import {
  rateLimited,
  serviceUnavailable,
  ErrorCode,
  methodNotAllowed,
  sendError,
} from '../lib/shared.js';
import { scanSessionKey } from '../lib/redisKeys.js';
import { isValidScanToken, validateScanSvg, type ScanSessionRecord } from '../lib/scanSession.js';

/**
 * Phone-scan handoff endpoint, keyed by session token.
 *
 *   POST  /api/scan-session/:token  — phone uploads a traced outline SVG
 *   GET   /api/scan-session/:token  — desktop polls; a `ready` result is
 *                                     delivered idempotently until the TTL expires
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const raw = req.query.token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!isValidScanToken(token)) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid scan token.');
  }

  const redis = getRedis();
  if (!redis) {
    return serviceUnavailable(res, 'Scan handoff is unavailable.');
  }

  const key = scanSessionKey(token);

  try {
    if (req.method === 'POST') {
      const rateLimit = await checkRateLimit(getClientIP(req), 'scan.upload');
      if (!rateLimit.allowed) {
        return rateLimited(res, rateLimit.retryAfterSeconds, 'Too many uploads. Try again later.');
      }

      // The session must still exist (not expired / already consumed).
      if (!(await redis.exists(key))) {
        return sendError(res, 404, ErrorCode.EXPIRED, 'Scan session expired.');
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const validation = validateScanSvg(body.svg);
      if (!validation.valid) {
        const status = validation.code === ErrorCode.SIZE_LIMIT ? 413 : 400;
        return res.status(status).json({ error: validation.error, code: validation.code });
      }

      const record: ScanSessionRecord = {
        status: 'ready',
        svg: validation.svg,
        createdAt: new Date().toISOString(),
      };
      // KEEPTTL: keep the original expiry so an upload (or retry) near expiry
      // can't extend the session past its advertised lifetime.
      await redis.set(key, JSON.stringify(record), 'KEEPTTL');
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      const rateLimit = await checkRateLimit(getClientIP(req), 'scan.poll');
      if (!rateLimit.allowed) {
        return rateLimited(res, rateLimit.retryAfterSeconds, 'Too many requests.');
      }

      const stored = await redis.get(key);
      if (!stored) {
        return sendError(res, 404, ErrorCode.EXPIRED, 'Scan session not found or expired.');
      }

      let record: ScanSessionRecord;
      try {
        record = JSON.parse(stored) as ScanSessionRecord;
      } catch {
        // Corrupt record — treat as gone rather than 500.
        return sendError(res, 404, ErrorCode.EXPIRED, 'Scan session not found or expired.');
      }
      if (record.status === 'ready' && record.svg) {
        // Idempotent delivery: the outline stays available until the session's
        // TTL expires. Consuming it here would lose the scan if the desktop hit
        // a transient error ingesting it, with no way to retry.
        return res.status(200).json({
          status: 'ready',
          svg: record.svg,
          createdAt: record.createdAt,
        });
      }
      return res.status(200).json({ status: 'pending' });
    }

    return methodNotAllowed(res, 'GET, POST');
  } catch (error) {
    logger.error('Scan session handoff error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return sendError(res, 500, ErrorCode.SERVER_ERROR, 'Scan handoff failed.');
  }
}
