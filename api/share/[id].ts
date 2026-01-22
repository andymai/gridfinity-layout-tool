import { put, del, head } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from '../lib/rateLimit.js';
import { validateShareLayout } from '../lib/validation.js';
import { filterLayoutContent } from '../lib/contentFilter.js';
import { isValidShareId, hashToken, ErrorCode, type ShareData } from '../lib/shared.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (typeof id !== 'string' || !isValidShareId(id)) {
    return res.status(400).json({
      error: 'Invalid share ID',
      code: ErrorCode.VALIDATION_ERROR,
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
      return res
        .status(405)
        .json({ error: 'Method not allowed', code: ErrorCode.METHOD_NOT_ALLOWED });
  }
}

/**
 * GET /api/share/[id] - Fetch a shared layout
 */
async function handleGet(req: VercelRequest, res: VercelResponse, _id: string, blobPath: string) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'view');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Try again later.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Check if blob exists
    const blobInfo = await head(blobPath).catch(() => null);
    if (!blobInfo) {
      return res.status(404).json({
        error: 'Share not found',
        code: ErrorCode.NOT_FOUND,
      });
    }

    // Fetch the blob content
    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      return res.status(404).json({
        error: 'Share not found',
        code: ErrorCode.NOT_FOUND,
      });
    }

    const shareData = (await response.json()) as ShareData;

    // Update lastAccessedAt timestamp (fire-and-forget, don't block response)
    const now = new Date().toISOString();
    const updatedData: ShareData = {
      ...shareData,
      metadata: {
        ...shareData.metadata,
        lastAccessedAt: now,
      },
    };
    put(blobPath, JSON.stringify(updatedData), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    }).catch(() => {});

    // Return layout with public metadata (exclude sensitive fields)
    return res.status(200).json({
      layout: shareData.layout,
      metadata: {
        createdAt: shareData.metadata.createdAt,
        lastUpdatedAt: shareData.metadata.lastUpdatedAt,
        permission: shareData.metadata.permission ?? 'view', // Default for old shares
        authorName: shareData.metadata.authorName,
      },
    });
  } catch (error) {
    console.error('Share fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch share',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}

/**
 * PUT /api/share/[id] - Update an existing share
 */
async function handlePut(req: VercelRequest, res: VercelResponse, id: string, blobPath: string) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'update');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many updates. Try again later.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const { layout, permission, deleteToken } = req.body || {};

    if (!deleteToken) {
      return res.status(401).json({
        error: 'Delete token required for updates',
        code: ErrorCode.UNAUTHORIZED,
      });
    }

    // Fetch existing share
    const blobInfo = await head(blobPath).catch(() => null);
    if (!blobInfo) {
      return res.status(404).json({
        error: 'Share not found',
        code: ErrorCode.NOT_FOUND,
      });
    }

    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      return res.status(404).json({
        error: 'Share not found',
        code: ErrorCode.NOT_FOUND,
      });
    }

    const existingData = (await response.json()) as ShareData;

    // Verify delete token
    const tokenHash = await hashToken(deleteToken);
    if (tokenHash !== existingData.metadata.deleteTokenHash) {
      return res.status(401).json({
        error: 'Invalid delete token',
        code: ErrorCode.UNAUTHORIZED,
      });
    }

    // Validate permission if provided
    const newPermission = permission ?? existingData.metadata.permission ?? 'view';
    if (newPermission !== 'view' && newPermission !== 'edit') {
      return res.status(400).json({
        error: 'Invalid permission. Must be "view" or "edit".',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    const now = new Date().toISOString();

    // Permission-only update (no layout provided)
    if (!layout) {
      const updatedData: ShareData = {
        ...existingData,
        metadata: {
          ...existingData.metadata,
          permission: newPermission,
          lastUpdatedAt: now,
        },
      };

      await put(blobPath, JSON.stringify(updatedData), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      const shareUrl = `${getBaseUrl(req)}/l/${id}`;

      return res.status(200).json({
        id,
        url: shareUrl,
        permission: newPermission,
      });
    }

    // Full update with layout
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
        code: ErrorCode.CONTENT_BLOCKED,
      });
    }

    // Update share data (preserve original deleteTokenHash and createdAt)
    const updatedData: ShareData = {
      layout: validationResult.layout,
      metadata: {
        ...existingData.metadata,
        permission: newPermission,
        lastUpdatedAt: now,
      },
    };

    await put(blobPath, JSON.stringify(updatedData), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    const shareUrl = `${getBaseUrl(req)}/l/${id}`;

    return res.status(200).json({
      id,
      url: shareUrl,
      permission: newPermission,
    });
  } catch (error) {
    console.error('Share update error:', error);
    return res.status(500).json({
      error: 'Failed to update share',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}

/**
 * DELETE /api/share/[id] - Delete a share
 */
async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  _id: string,
  blobPath: string
) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'delete');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many delete attempts. Try again later.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Get delete token from header or body
    const deleteToken =
      (req.headers['x-delete-token'] as string) || (req.body && req.body.deleteToken);

    if (!deleteToken) {
      return res.status(401).json({
        error: 'Delete token required',
        code: ErrorCode.UNAUTHORIZED,
      });
    }

    // Fetch existing share
    const blobInfo = await head(blobPath).catch(() => null);
    if (!blobInfo) {
      return res.status(404).json({
        error: 'Share not found',
        code: ErrorCode.NOT_FOUND,
      });
    }

    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      return res.status(404).json({
        error: 'Share not found',
        code: ErrorCode.NOT_FOUND,
      });
    }

    const existingData = (await response.json()) as ShareData;

    // Verify delete token
    const tokenHash = await hashToken(deleteToken);
    if (tokenHash !== existingData.metadata.deleteTokenHash) {
      return res.status(401).json({
        error: 'Invalid delete token',
        code: ErrorCode.UNAUTHORIZED,
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
