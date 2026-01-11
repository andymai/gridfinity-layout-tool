import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from './lib/rateLimit';
import { validateShareLayout, validateExpiration } from './lib/validation';
import { filterLayoutContent } from './lib/contentFilter';

/**
 * Generate a 12-character alphanumeric share ID.
 * 62^12 = ~3.2e21 combinations
 */
function generateShareId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const randomBytes = crypto.getRandomValues(new Uint8Array(12));
  for (let i = 0; i < 12; i++) {
    id += chars[randomBytes[i] % chars.length];
  }
  return id;
}

/**
 * Generate a 32-character hex delete token (128-bit entropy).
 */
function generateDeleteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a delete token using SHA-256 with server salt.
 * Uses Web Crypto API (available in Vercel Edge/Node).
 */
async function hashToken(token: string): Promise<string> {
  const salt = process.env.TOKEN_SALT || 'gridfinity-share-salt';
  const data = new TextEncoder().encode(salt + token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface ShareMetadata {
  deleteTokenHash: string;
  expiresAt: string;
  expiresInDays: number;
  createdAt: string;
  authorName?: string;
  reportCount: number;
}

interface ShareData {
  layout: unknown;
  metadata: ShareMetadata;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST for creating shares
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(req as unknown as Request);
    const rateLimit = await checkRateLimit(clientIP, 'create');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many shares created. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Parse and validate request body
    const { layout, expiresInDays, authorName } = req.body || {};

    if (!layout) {
      return res.status(400).json({
        error: 'Missing layout data',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate expiration
    if (!validateExpiration(expiresInDays)) {
      return res.status(400).json({
        error: 'Invalid expiration. Must be 30, 60, 90, or 365 days.',
        code: 'INVALID_EXPIRATION',
      });
    }

    // Validate layout structure and size
    const layoutJson = JSON.stringify(layout);
    const validationResult = validateShareLayout(layout, layoutJson.length);

    if (!validationResult.valid) {
      return res.status(400).json({
        error: validationResult.error.message,
        code: validationResult.error.code,
      });
    }

    // Content filtering
    const contentResult = filterLayoutContent(validationResult.layout);
    if (!contentResult.passed) {
      return res.status(400).json({
        error: `Content blocked: ${contentResult.reason}`,
        code: 'CONTENT_BLOCKED',
      });
    }

    // Generate IDs and tokens
    const shareId = generateShareId();
    const deleteToken = generateDeleteToken();
    const deleteTokenHash = await hashToken(deleteToken);

    // Calculate expiration
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    // Prepare data to store
    const shareData: ShareData = {
      layout: validationResult.layout,
      metadata: {
        deleteTokenHash,
        expiresAt: expiresAt.toISOString(),
        expiresInDays,
        createdAt: now.toISOString(),
        authorName: authorName ? String(authorName).slice(0, 64) : undefined,
        reportCount: 0,
      },
    };

    // Store in Vercel Blob
    await put(`shares/${shareId}.json`, JSON.stringify(shareData), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    // Return success response
    const shareUrl = `${getBaseUrl(req)}/s/${shareId}`;

    return res.status(201).json({
      id: shareId,
      url: shareUrl,
      deleteToken,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Share creation error:', error);
    return res.status(500).json({
      error: 'Failed to create share',
      code: 'NETWORK_ERROR',
    });
  }
}

/**
 * Get base URL from request headers.
 */
function getBaseUrl(req: VercelRequest): string {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${protocol}://${host}`;
}
