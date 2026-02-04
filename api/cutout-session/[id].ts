import { put, del } from '@vercel/blob';
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
type AllowedMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Magic byte signatures for allowed image types.
 */
const IMAGE_SIGNATURES: Record<AllowedMimeType, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
};

const ALLOWED_MIME_TYPES: AllowedMimeType[] = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Type guard for AllowedMimeType.
 */
function isAllowedMimeType(value: string): value is AllowedMimeType {
  return ALLOWED_MIME_TYPES.includes(value as AllowedMimeType);
}

interface SessionData {
  status: 'pending' | 'ready';
  createdAt: string;
  clientIPHash: string;
  secretHash: string;
  imageUrl?: string;
  imageName?: string;
  blobPath?: string; // Store actual path for reliable cleanup
}

/**
 * Validate session ID format (32 hex chars = 128 bits).
 * Uses constant-time comparison to prevent timing attacks.
 */
function isValidSessionId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  if (id.length !== 32) return false;

  // Constant-time check for hex characters
  let valid = true;
  for (let i = 0; i < id.length; i++) {
    const c = id.charCodeAt(i);
    const isHex = (c >= 48 && c <= 57) || (c >= 97 && c <= 102); // 0-9, a-f
    valid = valid && isHex;
  }
  return valid;
}

/**
 * Validate session secret format (32 hex chars).
 */
function isValidSecret(secret: unknown): secret is string {
  if (typeof secret !== 'string') return false;
  if (secret.length !== 32) return false;

  let valid = true;
  for (let i = 0; i < secret.length; i++) {
    const c = secret.charCodeAt(i);
    const isHex = (c >= 48 && c <= 57) || (c >= 97 && c <= 102);
    valid = valid && isHex;
  }
  return valid;
}

/**
 * Hash session secret for comparison using SHA-256.
 * Must match the hash function in cutout-session.ts
 */
async function hashSessionSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validate image magic bytes match declared MIME type.
 * Prevents upload of non-image files with fake MIME types.
 */
function validateImageMagicBytes(buffer: Buffer, declaredMimeType: AllowedMimeType): boolean {
  const signatures = IMAGE_SIGNATURES[declaredMimeType];
  return signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
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
 * SECURITY: Requires session secret in Authorization header.
 * Only the session creator (desktop) should have this secret.
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

    // Extract session secret from Authorization header
    const authHeader = req.headers.authorization;
    const secret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!isValidSecret(secret)) {
      return res.status(401).json({
        error: 'Missing or invalid session secret',
        code: ErrorCode.UNAUTHORIZED,
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

    // Verify session secret (constant-time comparison)
    const providedHash = await hashSessionSecret(secret);
    if (!constantTimeCompare(providedHash, session.secretHash)) {
      return res.status(403).json({
        error: 'Invalid session secret',
        code: ErrorCode.FORBIDDEN,
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
 * SECURITY: No secret required - mobile only has the session ID from QR code.
 * This is intentional: mobile can upload, but cannot read or delete.
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

    // Check if session already has an image (one upload per session)
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

    // Validate MIME type is in allowlist
    if (!mimeType || !isAllowedMimeType(mimeType)) {
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

    // SECURITY: Validate magic bytes match declared MIME type
    if (!validateImageMagicBytes(imageBuffer, mimeType)) {
      return res.status(400).json({
        error: 'File content does not match declared image type',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Determine file extension from validated MIME type
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
    const blobPath = `cutouts/${sessionId}.${ext}`;

    // Store in Vercel Blob
    const blob = await put(blobPath, imageBuffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
    });

    // Update session with image URL and blob path for cleanup
    const updatedSession: SessionData = {
      ...session,
      status: 'ready',
      imageUrl: blob.url,
      imageName: filename || `cutout.${ext}`,
      blobPath, // Store for reliable cleanup
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
 * SECURITY: Requires session secret in Authorization header.
 * Prevents attackers from deleting other users' sessions.
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

    // Extract session secret from Authorization header
    const authHeader = req.headers.authorization;
    const secret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!isValidSecret(secret)) {
      return res.status(401).json({
        error: 'Missing or invalid session secret',
        code: ErrorCode.UNAUTHORIZED,
      });
    }

    const redis = getRedis();
    if (!redis) {
      return res.status(503).json({
        error: 'Session service unavailable',
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }

    // Get session to verify secret and find blob path
    const sessionJson = await redis.get(`cutout:session:${sessionId}`);
    if (!sessionJson) {
      // Session already gone - consider this success
      return res.status(200).json({
        success: true,
        message: 'Session not found or already deleted',
      });
    }

    const session = safeParseSession(sessionJson);
    if (!session) {
      return res.status(500).json({
        error: 'Failed to parse session data',
        code: ErrorCode.SERVER_ERROR,
      });
    }

    // Verify session secret (constant-time comparison)
    const providedHash = await hashSessionSecret(secret);
    if (!constantTimeCompare(providedHash, session.secretHash)) {
      return res.status(403).json({
        error: 'Invalid session secret',
        code: ErrorCode.FORBIDDEN,
      });
    }

    // Delete blob if path is stored (reliable cleanup)
    if (session.blobPath) {
      try {
        await del(session.blobPath);
      } catch {
        // Ignore blob deletion errors - may already be gone
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
