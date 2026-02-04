import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis } from './lib/rateLimit.js';
import { ErrorCode } from './lib/shared.js';

/**
 * Session TTL in seconds (10 minutes).
 */
const SESSION_TTL_SECONDS = 600;

/**
 * Generate a unique session ID (16-char alphanumeric).
 */
function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/**
 * POST /api/cutout-session - Create a new cutout upload session.
 *
 * Creates a temporary session that allows mobile devices to upload
 * images to be processed as cutouts on the desktop. Sessions expire
 * after 10 minutes.
 *
 * Returns:
 * - sessionId: Unique identifier for the session
 * - expiresAt: ISO timestamp when the session expires
 * - uploadUrl: URL for mobile to upload images
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST for creating sessions
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res
      .status(405)
      .json({ error: 'Method not allowed', code: ErrorCode.METHOD_NOT_ALLOWED });
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'cutout-session');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many sessions created. Try again later.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const redis = getRedis();
    if (!redis) {
      return res.status(503).json({
        error: 'Session service unavailable',
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }

    // Generate session ID and calculate expiry
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    // Store session in Redis with TTL
    const sessionData = {
      status: 'pending',
      createdAt: new Date().toISOString(),
      clientIP,
    };

    await redis.setex(
      `cutout:session:${sessionId}`,
      SESSION_TTL_SECONDS,
      JSON.stringify(sessionData)
    );

    // Build upload URL
    const baseUrl = getBaseUrl();
    const uploadUrl = `${baseUrl}/api/cutout-session/${sessionId}`;

    return res.status(201).json({
      sessionId,
      expiresAt: expiresAt.toISOString(),
      uploadUrl,
    });
  } catch {
    return res.status(500).json({
      error: 'Failed to create session',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}

/**
 * Get base URL from environment.
 */
function getBaseUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'https://localhost:3000';
}
