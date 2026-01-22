import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from './lib/rateLimit.js';
import { validateShareLayout } from './lib/validation.js';
import { filterLayoutContent } from './lib/contentFilter.js';
import {
  isValidShareId,
  hashToken,
  generateDeleteToken,
  ErrorCode,
  type ShareData,
} from './lib/shared.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST for creating shares
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res
      .status(405)
      .json({ error: 'Method not allowed', code: ErrorCode.METHOD_NOT_ALLOWED });
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'create');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many shares created. Try again later.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Parse and validate request body
    const { layout, layoutId, permission = 'view', authorName } = req.body || {};

    if (!layout) {
      return res.status(400).json({
        error: 'Missing layout data',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Validate layoutId - must be provided by client
    if (!isValidShareId(layoutId)) {
      return res.status(400).json({
        error: 'Invalid or missing layoutId. Must be a 12-character alphanumeric string.',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Validate permission
    if (permission !== 'view' && permission !== 'edit') {
      return res.status(400).json({
        error: 'Invalid permission. Must be "view" or "edit".',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Validate layout structure and size
    const layoutJson = JSON.stringify(layout);
    const validationResult = validateShareLayout(layout, layoutJson.length);

    if (!validationResult.valid) {
      const { error } = validationResult;
      return res.status(400).json({
        error: error.message,
        code: error.code,
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
      code: ErrorCode.SERVER_ERROR,
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
