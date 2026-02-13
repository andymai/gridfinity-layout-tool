import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from './lib/rateLimit.js';
import { validateShareLayout, isValidationError } from './lib/validation.js';
import { validateDesignerShare } from './lib/designerValidation.js';
import { filterLayoutContent } from './lib/contentFilter.js';
import {
  isValidShareId,
  hashToken,
  generateDeleteToken,
  ErrorCode,
  methodNotAllowed,
  getBaseUrl,
  type ShareData,
} from './lib/shared.js';

/**
 * HTTP POST handler that creates a share (designer or layout) and stores its data in Vercel Blob.
 *
 * Validates request method and rate limits the client; validates the provided `layoutId`, permission, and
 * payload (designer params or layout structure); for layout shares runs content filtering; generates a
 * delete token (stored as a hash), persists the share metadata and payload, and returns the share ID,
 * public URL, delete token, and permission on success. Responds with appropriate 4xx errors for validation,
 * rate limiting, or content blocking, and 500 on unexpected failures.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
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
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { layout, layoutId, permission = 'view', authorName, type, params } = body;

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

    let sharePayload: unknown;

    if (type === 'designer') {
      // Designer share: validate BinParams
      const designerPayload = { type, version: body.version, params };
      const payloadJson = JSON.stringify(designerPayload);
      const result = validateDesignerShare(designerPayload, payloadJson.length);

      if (!result.valid) {
        return res.status(400).json({
          error: result.error.message,
          code: result.error.code,
        });
      }

      sharePayload = result.payload;
    } else {
      // Layout share: validate layout structure
      if (!layout) {
        return res.status(400).json({
          error: 'Missing layout data',
          code: ErrorCode.VALIDATION_ERROR,
        });
      }

      const layoutJson = JSON.stringify(layout);
      const validationResult = validateShareLayout(layout, layoutJson.length);

      if (isValidationError(validationResult)) {
        return res.status(400).json({
          error: validationResult.error.message,
          code: validationResult.error.code,
        });
      }

      // Content filtering (layout shares only)
      const contentResult = filterLayoutContent(validationResult.layout);
      if (!contentResult.passed) {
        return res.status(400).json({
          error: `Content blocked: ${contentResult.reason}`,
          code: 'CONTENT_BLOCKED',
        });
      }

      sharePayload = validationResult.layout;
    }

    // Use client-provided layoutId as the share ID
    const shareId = layoutId;
    const deleteToken = generateDeleteToken();
    const deleteTokenHash = await hashToken(deleteToken);

    const now = new Date();
    const nowIso = now.toISOString();

    // Prepare data to store (shares are permanent, no expiration)
    const shareData: ShareData = {
      layout: sharePayload,
      metadata: {
        deleteTokenHash,
        createdAt: nowIso,
        lastUpdatedAt: nowIso,
        lastAccessedAt: nowIso,
        permission,
        authorName: typeof authorName === 'string' ? authorName.slice(0, 64) : undefined,
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
    const shareUrl = `${getBaseUrl()}/${type === 'designer' ? 'd' : 'l'}/${shareId}`;

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
