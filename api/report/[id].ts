import { head } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import { REPORT_THRESHOLD } from '../lib/contentFilter.js';
import {
  rateLimited,
  isValidShareId,
  ErrorCode,
  methodNotAllowed,
  shareReportKey,
  sendError,
} from '../lib/shared.js';
import { logger } from '../lib/logger.js';

/**
 * SECURITY: report counter inflation.
 * Counters here are protected only by per-IP rate limiting (10/hr) and are
 * anonymous; no signed-in account is required to file one. A botnet with 5+
 * residential IPs can reach REPORT_THRESHOLD on any share, so the threshold
 * is currently a manual-review trigger only. There is NO automated takedown
 * here. Before wiring up automated takedown for shares, add a CAPTCHA (or
 * proof-of-work, or unique-account requirement) to this report flow so the
 * threshold can't be hit by IP rotation alone.
 *
 * Community showcase reports (`api/community/[id].ts`, POST
 * `{ action: 'report' }`) DO auto-hide at the same REPORT_THRESHOLD: that
 * flow requires `requireSession` and dedupes on `community:reports:{id}` (a
 * SET of userIds, not IPs), so its threshold can only be reached by
 * REPORT_THRESHOLD distinct signed-in accounts, not rotated IPs. That is the
 * unique-account requirement this comment asks for, applied there instead of
 * here.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  const { id } = req.query;

  if (typeof id !== 'string' || !isValidShareId(id)) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid share ID');
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'report');

    if (!rateLimit.allowed) {
      return rateLimited(res, rateLimit.retryAfterSeconds, 'Too many reports. Try again later.');
    }

    const { reason } = (req.body ?? {}) as Record<string, unknown>;

    // Validate reason (optional but helpful)
    const reportReason = typeof reason === 'string' ? reason.slice(0, 500) : 'No reason provided';

    const blobPath = `shares/${id}.json`;

    // Verify the share exists before accepting the report
    const blobInfo = await head(blobPath).catch(() => null);
    if (!blobInfo) {
      return sendError(res, 404, ErrorCode.NOT_FOUND, 'Share not found');
    }

    // Increment report count atomically in Redis (fixes TOCTOU race condition).
    // Falls back to zero-count logging if Redis is unavailable.
    let newReportCount = 0;
    const redis = getRedis();
    if (redis) {
      const key = shareReportKey(id);
      // pipeline.exec() is the Redis pipeline flush, not child_process.exec()
      const pipe = redis.pipeline();
      pipe.incr(key);
      pipe.expire(key, 365 * 24 * 60 * 60); // 1-year TTL
      const results = await pipe.exec();
      const rawCount = results?.[0]?.[1];
      newReportCount = typeof rawCount === 'number' ? rawCount : 0;
    }

    // Log report for manual review
    logger.warn('Share reported', {
      id,
      reportCount: newReportCount,
      reason: reportReason,
    });

    // Check if threshold exceeded
    if (newReportCount >= REPORT_THRESHOLD) {
      logger.warn('Share report threshold exceeded', {
        id,
        reportCount: newReportCount,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Report submitted. Thank you for helping keep the community safe.',
    });
  } catch (error) {
    logger.error('Report error', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to submit report');
  }
}
