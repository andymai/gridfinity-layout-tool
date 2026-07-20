import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis } from './lib/rateLimit.js';
import { logger } from './lib/logger.js';
import { ErrorCode, methodNotAllowed } from './lib/shared.js';
import { readSupporters } from './lib/supporters.js';

/**
 * Public supporter list for the /supporters page.
 *
 * Returns display names, join dates, and public messages — never emails or
 * amounts. Cached at the edge because the payload changes at most a few times a
 * day, so the origin only sees cache misses.
 *
 * Any failure returns a non-200 on purpose: the client keeps its bundled
 * fallback list, so a stale page beats an empty baseplate.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  try {
    const rateLimit = await checkRateLimit(getClientIP(req), 'supporters.read');
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const redis = getRedis();
    if (!redis) {
      return res.status(503).json({
        error: 'Supporter list unavailable.',
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }

    const payload = await readSupporters(redis);
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    return res.status(200).json(payload);
  } catch (error) {
    logger.error('Supporters read error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to read supporters.',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}
