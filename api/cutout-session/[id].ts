import { put, del, head } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import { ErrorCode } from '../lib/shared.js';

/**
 * Session TTL in seconds (10 minutes).
 */
const SESSION_TTL_SECONDS = 600;

/**
 * Maximum image size (5 MB).
 */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/**
 * Allowed image MIME types.
 */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface SessionData {
  status: 'pending' | 'ready';
  createdAt: string;
  clientIP: string;
  imageUrl?: string;
  imageName?: string;
}

/**
 * Validate session ID format (16-char alphanumeric).
 */
function isValidSessionId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9]{16}$/.test(id);
}

/**
 * Safely parse JSON with proper error handling.
 */
function safeParseSession(json: string): SessionData | null {
  try {
    return JSON.parse(json) as SessionData;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!isValidSessionId(id)) {
    return res.status(400).json({
      error: 'Invalid session ID',
      code: ErrorCode.VALIDATION_ERROR,
    });
  }

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, id);
    case 'POST':
      return handlePost(req, res, id);
    case 'DELETE':
      return handleDelete(req, res, id);
    default:
      res.setHeader('Allow', 'GET, POST, DELETE');
      return res
        .status(405)
        .json({ error: 'Method not allowed', code: ErrorCode.METHOD_NOT_ALLOWED });
  }
}

/**
 * GET /api/cutout-session/[id] - Poll for session status (desktop).
 *
 * Returns current session status and image URL if available.
 */
async function handleGet(req: VercelRequest, res: VercelResponse, sessionId: string) {
  try {
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'view');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Try again later.',
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

    const sessionJson = await redis.get(`cutout:session:${sessionId}`);
    if (!sessionJson) {
      return res.status(404).json({
        error: 'Session not found or expired',
        code: ErrorCode.NOT_FOUND,
      });
    }

    const session = safeParseSession(sessionJson);
    if (!session) {
      return res.status(500).json({
        error: 'Failed to parse session data',
        code: ErrorCode.SERVER_ERROR,
      });
    }

    // Return session status (exclude internal fields)
    return res.status(200).json({
      status: session.status,
      imageUrl: session.imageUrl,
      imageName: session.imageName,
    });
  } catch {
    return res.status(500).json({
      error: 'Failed to check session',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}

/**
 * POST /api/cutout-session/[id] - Upload image to session (mobile).
 *
 * Accepts multipart form data with an image file.
 * Stores the image in Vercel Blob and updates session status.
 */
async function handlePost(req: VercelRequest, res: VercelResponse, sessionId: string) {
  try {
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'cutout-upload');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many uploads. Try again later.',
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

    // Verify session exists
    const sessionJson = await redis.get(`cutout:session:${sessionId}`);
    if (!sessionJson) {
      return res.status(404).json({
        error: 'Session not found or expired',
        code: ErrorCode.NOT_FOUND,
      });
    }

    const session = safeParseSession(sessionJson);
    if (!session) {
      return res.status(500).json({
        error: 'Failed to parse session data',
        code: ErrorCode.SERVER_ERROR,
      });
    }

    // Check if session already has an image
    if (session.status === 'ready' && session.imageUrl) {
      return res.status(400).json({
        error: 'Session already has an image. Create a new session to upload another.',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Parse and validate request body
    const body = (req.body ?? {}) as Record<string, unknown>;
    const image = typeof body.image === 'string' ? body.image : null;
    const filename = typeof body.filename === 'string' ? body.filename : null;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : null;

    if (!image) {
      return res.status(400).json({
        error: 'Missing image data. Send base64-encoded image in "image" field.',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Validate MIME type
    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({
        error: `Invalid image type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Decode base64 image
    let imageBuffer: Buffer;
    try {
      imageBuffer = Buffer.from(image, 'base64');
    } catch {
      return res.status(400).json({
        error: 'Invalid base64 image data',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Validate size
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      return res.status(400).json({
        error: `Image too large. Maximum size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
        code: ErrorCode.SIZE_LIMIT,
      });
    }

    // Determine file extension from validated MIME type (e.g., 'image/jpeg' -> 'jpeg')
    const ext = mimeType.substring(mimeType.indexOf('/') + 1);
    const blobPath = `cutouts/${sessionId}.${ext}`;

    // Store in Vercel Blob
    const blob = await put(blobPath, imageBuffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
    });

    // Update session with image URL
    const updatedSession: SessionData = {
      ...session,
      status: 'ready',
      imageUrl: blob.url,
      imageName: filename || `cutout.${ext}`,
    };

    // Get remaining TTL and update session
    const ttl = await redis.ttl(`cutout:session:${sessionId}`);
    await redis.setex(
      `cutout:session:${sessionId}`,
      ttl > 0 ? ttl : SESSION_TTL_SECONDS,
      JSON.stringify(updatedSession)
    );

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
    });
  } catch {
    return res.status(500).json({
      error: 'Failed to upload image',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}

/**
 * DELETE /api/cutout-session/[id] - Clean up session and image.
 *
 * Called by desktop after processing the image, or when user cancels.
 */
async function handleDelete(req: VercelRequest, res: VercelResponse, sessionId: string) {
  try {
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'delete');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Try again later.',
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

    // Get session to find blob URL
    const sessionJson = await redis.get(`cutout:session:${sessionId}`);
    if (sessionJson) {
      const session = safeParseSession(sessionJson);
      if (!session) {
        return res.status(500).json({
          error: 'Failed to parse session data',
          code: ErrorCode.SERVER_ERROR,
        });
      }

      // Delete blob if exists
      if (session.imageUrl) {
        // Extract blob path from URL and delete
        const blobPath = `cutouts/${sessionId}`;
        // Try to delete with common extensions
        for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
          const fullPath = `${blobPath}.${ext}`;
          const blobInfo = await head(fullPath).catch(() => null);
          if (blobInfo) {
            await del(fullPath);
            break;
          }
        }
      }
    }

    // Delete session from Redis
    await redis.del(`cutout:session:${sessionId}`);

    return res.status(200).json({
      success: true,
      message: 'Session deleted',
    });
  } catch {
    return res.status(500).json({
      error: 'Failed to delete session',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}
