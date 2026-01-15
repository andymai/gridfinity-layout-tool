import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from './lib/rateLimit.js';
import { validateShareLayout } from './lib/validation.js';
import { filterLayoutContent } from './lib/contentFilter.js';

/**
 * Validate a layout ID format.
 * Supports multiple formats for backwards compatibility:
 * - Standard UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (older layouts)
 * - Base36 timestamp: {timestamp}-{random 7 chars} e.g., "lszwz1k7v-8j2kqp1"
 * - Legacy 12-char: alphanumeric only
 */
function isValidLayoutId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  // Standard UUID format (8-4-4-4-12 hex chars)
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return true;
  // Base36 timestamp format (variable length + hyphen + 7 chars)
  if (/^[a-z0-9]+-[a-z0-9]{7}$/.test(id)) return true;
  // Legacy 12-char alphanumeric format
  if (/^[a-zA-Z0-9]{12}$/.test(id)) return true;
  return false;
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
  const salt = process.env.TOKEN_SALT;
  if (!salt) {
    throw new Error('TOKEN_SALT environment variable must be configured');
  }
  const data = new TextEncoder().encode(salt + token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface ShareMetadata {
  deleteTokenHash: string;
  createdAt: string;
  lastUpdatedAt: string;
  lastAccessedAt: string;
  permission: 'view' | 'edit';
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
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'create');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many shares created. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Parse and validate request body
    const { layout, layoutId, permission = 'view', authorName } = req.body || {};

    if (!layout) {
      return res.status(400).json({
        error: 'Missing layout data',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate layoutId - must be provided by client
    if (!isValidLayoutId(layoutId)) {
      return res.status(400).json({
        error: 'Invalid or missing layoutId. Must be a 12-character alphanumeric string.',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate permission
    if (permission !== 'view' && permission !== 'edit') {
      return res.status(400).json({
        error: 'Invalid permission. Must be "view" or "edit".',
        code: 'VALIDATION_ERROR',
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

    // Use client-provided layoutId as the share ID
    // This ensures share URLs match the owner's local layout ID
    const shareId = layoutId;
    const deleteToken = generateDeleteToken();
    const deleteTokenHash = await hashToken(deleteToken);

    const now = new Date();
    const nowIso = now.toISOString();

    // Prepare data to store (shares are permanent, no expiration)
    const shareData: ShareData = {
      layout: validationResult.layout,
      metadata: {
        deleteTokenHash,
        createdAt: nowIso,
        lastUpdatedAt: nowIso,
        lastAccessedAt: nowIso,
        permission,
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

    // Return success response - use unified /l/{id} format
    const shareUrl = `${getBaseUrl(req)}/l/${shareId}`;

    return res.status(201).json({
      id: shareId,
      url: shareUrl,
      deleteToken,
      permission,
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
