import { head } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import { REPORT_THRESHOLD } from '../lib/contentFilter.js';
import { isValidShareId, ErrorCode, methodNotAllowed, shareReportKey } from '../lib/shared.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  const { id } = req.query;

  if (typeof id !== 'string' || !isValidShareId(id)) {
    return res.status(400).json({
      error: 'Invalid share ID',
      code: ErrorCode.VALIDATION_ERROR,
    });
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'report');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many reports. Try again later.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const { reason } = (req.body ?? {}) as Record<string, unknown>;

    // Validate reason (optional but helpful)
    const reportReason = typeof reason === 'string' ? reason.slice(0, 500) : 'No reason provided';

    const blobPath = `shares/${id}.json`;

    // Verify the share exists before accepting the report
    const blobInfo = await head(blobPath).catch(() => null);
    if (!blobInfo) {
      return res.status(404).json({
        error: 'Share not found',
        code: ErrorCode.NOT_FOUND,
      });
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
      newReportCount = (results?.[0]?.[1] as number) ?? 0;
    }

    // Log report for manual review
    console.warn('Share reported:', {
      id,
      reportCount: newReportCount,
      reason: reportReason,
      timestamp: new Date().toISOString(),
    });

    // Check if threshold exceeded
    if (newReportCount >= REPORT_THRESHOLD) {
      console.warn('Share report threshold exceeded:', {
        id,
        reportCount: newReportCount,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Report submitted. Thank you for helping keep the community safe.',
    });
  } catch (error) {
    console.error('Report error:', error);
    return res.status(500).json({
      error: 'Failed to submit report',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}
