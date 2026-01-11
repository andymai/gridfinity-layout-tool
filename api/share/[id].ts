import { put, del, head } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from '../lib/rateLimit.js';
import { validateShareLayout, validateExpiration } from '../lib/validation.js';
import { filterLayoutContent } from '../lib/contentFilter.js';

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

/**
 * Hash a delete token using SHA-256 with server salt.
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

/**
 * Validate share ID format (12 alphanumeric chars).
 */
function isValidShareId(id: string): boolean {
  return /^[A-Za-z0-9]{12}$/.test(id);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (typeof id !== 'string' || !isValidShareId(id)) {
    return res.status(400).json({
      error: 'Invalid share ID',
      code: 'VALIDATION_ERROR',
    });
  }

  const blobPath = `shares/${id}.json`;

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, id, blobPath);
    case 'PUT':
      return handlePut(req, res, id, blobPath);
    case 'DELETE':
      return handleDelete(req, res, id, blobPath);
    default:
      res.setHeader('Allow', 'GET, PUT, DELETE');
      return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
}

/**
 * GET /api/share/[id] - Fetch a shared layout
 */
async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
  blobPath: string
) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'view');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Check if blob exists
    const blobInfo = await head(blobPath).catch(() => null);
    if (!blobInfo) {
      return res.status(404).json({
        error: 'Share not found or has expired',
        code: 'NOT_FOUND',
      });
    }

    // Fetch the blob content
    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      return res.status(404).json({
        error: 'Share not found or has expired',
        code: 'NOT_FOUND',
      });
    }

    const shareData: ShareData = await response.json();

    // Check expiration
    const expiresAt = new Date(shareData.metadata.expiresAt);
    if (expiresAt < new Date()) {
      // Expired - delete and return 404
      await del(blobPath).catch(() => {});
      return res.status(404).json({
        error: 'Share has expired',
        code: 'EXPIRED',
      });
    }

    // Return layout with public metadata (exclude sensitive fields)
    return res.status(200).json({
      layout: shareData.layout,
      metadata: {
        expiresAt: shareData.metadata.expiresAt,
        expiresInDays: shareData.metadata.expiresInDays,
        createdAt: shareData.metadata.createdAt,
        authorName: shareData.metadata.authorName,
      },
    });
  } catch (error) {
    console.error('Share fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch share',
      code: 'NETWORK_ERROR',
    });
  }
}

/**
 * PUT /api/share/[id] - Update an existing share
 */
async function handlePut(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
  blobPath: string
) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'update');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many updates. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const { layout, expiresInDays, deleteToken } = req.body || {};

    if (!deleteToken) {
      return res.status(401).json({
        error: 'Delete token required for updates',
        code: 'UNAUTHORIZED',
      });
    }

    if (!layout) {
      return res.status(400).json({
        error: 'Missing layout data',
        code: 'VALIDATION_ERROR',
      });
    }

    // Fetch existing share
    const blobInfo = await head(blobPath).catch(() => null);
    if (!blobInfo) {
      return res.status(404).json({
        error: 'Share not found',
        code: 'NOT_FOUND',
      });
    }

    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      return res.status(404).json({
        error: 'Share not found',
        code: 'NOT_FOUND',
      });
    }

    const existingData: ShareData = await response.json();

    // Verify delete token
    const tokenHash = await hashToken(deleteToken);
    if (tokenHash !== existingData.metadata.deleteTokenHash) {
      return res.status(401).json({
        error: 'Invalid delete token',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate new expiration if provided
    const newExpiration = expiresInDays ?? existingData.metadata.expiresInDays;
    if (!validateExpiration(newExpiration)) {
      return res.status(400).json({
        error: 'Invalid expiration. Must be 30, 60, 90, or 365 days.',
        code: 'INVALID_EXPIRATION',
      });
    }

    // Validate new layout
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

    // Calculate new expiration
    const now = new Date();
    const expiresAt = new Date(now.getTime() + newExpiration * 24 * 60 * 60 * 1000);

    // Update share data (preserve original deleteTokenHash and createdAt)
    const updatedData: ShareData = {
      layout: validationResult.layout,
      metadata: {
        ...existingData.metadata,
        expiresAt: expiresAt.toISOString(),
        expiresInDays: newExpiration,
      },
    };

    // Delete old blob and create new one (put with same path overwrites)
    await put(blobPath, JSON.stringify(updatedData), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    const shareUrl = `${getBaseUrl(req)}/s/${id}`;

    return res.status(200).json({
      id,
      url: shareUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Share update error:', error);
    return res.status(500).json({
      error: 'Failed to update share',
      code: 'NETWORK_ERROR',
    });
  }
}

/**
 * DELETE /api/share/[id] - Delete a share
 */
async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
  blobPath: string
) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'delete');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many delete attempts. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Get delete token from header or body
    const deleteToken = req.headers['x-delete-token'] as string ||
      (req.body && req.body.deleteToken);

    if (!deleteToken) {
      return res.status(401).json({
        error: 'Delete token required',
        code: 'UNAUTHORIZED',
      });
    }

    // Fetch existing share
    const blobInfo = await head(blobPath).catch(() => null);
    if (!blobInfo) {
      return res.status(404).json({
        error: 'Share not found',
        code: 'NOT_FOUND',
      });
    }

    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      return res.status(404).json({
        error: 'Share not found',
        code: 'NOT_FOUND',
      });
    }

    const existingData: ShareData = await response.json();

    // Verify delete token
    const tokenHash = await hashToken(deleteToken);
    if (tokenHash !== existingData.metadata.deleteTokenHash) {
      return res.status(401).json({
        error: 'Invalid delete token',
        code: 'UNAUTHORIZED',
      });
    }

    // Delete the blob
    await del(blobPath);

    return res.status(200).json({
      success: true,
      message: 'Share deleted successfully',
    });
  } catch (error) {
    console.error('Share delete error:', error);
    return res.status(500).json({
      error: 'Failed to delete share',
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
