import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis, hashIP } from './lib/rateLimit.js';
import { ErrorCode } from './lib/shared.js';

/**
 * Session TTL in seconds (10 minutes).
 */
const SESSION_TTL_SECONDS = 600;

/**
 * Generate a cryptographically secure session ID (32 hex chars = 128 bits).
 *
 * Security: 128-bit entropy makes brute-force enumeration infeasible.
 * At 10^6 attempts/second, expected time to find one valid session
 * among 1000 active sessions is ~10^28 years.
 */
function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a secret token for session authentication (32 hex chars).
 *
 * Security: This token must be presented for polling and deletion.
 * Only the session creator (desktop) receives this token.
 */
function generateSessionSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * POST /api/cutout-session - Create a new cutout upload session.
 *
 * Creates a temporary session that allows mobile devices to upload
 * images to be processed as cutouts on the desktop. Sessions expire
 * after 10 minutes.
 *
 * Security model:
 * - Session ID is public (embedded in QR code for mobile upload)
 * - Session secret is private (only returned to desktop, required for polling)
 * - Mobile can only POST to upload (no secret needed)
 * - Desktop must provide secret for GET (poll) and DELETE (cleanup)
 *
 * Returns:
 * - sessionId: Public identifier (safe to share in QR code)
 * - sessionSecret: Private token for polling/deletion (keep secret)
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
    // Rate limiting - restrictive for public deployment
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

    // Generate session ID, secret, and calculate expiry
    const sessionId = generateSessionId();
    const sessionSecret = generateSessionSecret();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    // Store session in Redis with TTL
    // Note: clientIP is hashed for privacy (GDPR compliance)
    const sessionData = {
      status: 'pending',
      createdAt: new Date().toISOString(),
      clientIPHash: hashIP(clientIP),
      secretHash: await hashSessionSecret(sessionSecret),
    };

    await redis.setex(
      `cutout:session:${sessionId}`,
      SESSION_TTL_SECONDS,
      JSON.stringify(sessionData)
    );

    // Build upload URL (public, for QR code)
    const baseUrl = getBaseUrl();
    const uploadUrl = `${baseUrl}/api/cutout-session/${sessionId}`;

    return res.status(201).json({
      sessionId,
      sessionSecret, // Only returned once - client must store this
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
 * Hash session secret for storage using SHA-256.
 * We store the hash, not the plaintext, so Redis compromise doesn't leak secrets.
 */
async function hashSessionSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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
