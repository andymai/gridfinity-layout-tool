import { Liveblocks } from '@liveblocks/node';
import { head } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from './lib/rateLimit.js';
import { ErrorCode, isValidShareId, methodNotAllowed } from './lib/shared.js';
import { logger } from './lib/logger.js';
import type { ShareData } from './lib/shared.js';

/**
 * Liveblocks authentication endpoint.
 *
 * This endpoint authenticates users for Liveblocks room access.
 * Permission is enforced by fetching share metadata from Vercel Blob:
 * - 'edit' permission grants FULL_ACCESS (read + write)
 * - 'view' permission grants READ_ACCESS (read only)
 *
 * @see https://liveblocks.io/docs/authentication
 */

// Lazy initialization to avoid non-null assertion and handle missing config gracefully
let _liveblocks: Liveblocks | null = null;
function getLiveblocks(): Liveblocks {
  if (!_liveblocks) {
    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!secret) {
      throw new Error('LIVEBLOCKS_SECRET_KEY not configured');
    }
    _liveblocks = new Liveblocks({ secret });
  }
  return _liveblocks;
}

/**
 * Assign a consistent color to a user based on their ID.
 * Uses a predefined palette of distinct, accessible colors.
 */
const PARTICIPANT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
];

function assignColor(userId: string): string {
  // Simple hash to get consistent color per user
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % PARTICIPANT_COLORS.length;
  return PARTICIPANT_COLORS[index];
}

interface AuthRequest {
  room: string;
  userId: string;
  userName?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  try {
    // Check if Liveblocks is configured
    if (!process.env.LIVEBLOCKS_SECRET_KEY) {
      logger.error('LIVEBLOCKS_SECRET_KEY not configured');
      return res.status(500).json({
        error: 'Collaboration not configured',
        code: ErrorCode.CONFIGURATION_ERROR,
      });
    }

    // Rate limiting - use 'view' limits (100/min) since auth is lightweight
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'view');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Try again later.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Parse request body
    const { room, userId, userName } = req.body as AuthRequest;

    // Validate room ID format (must be gridfinity-{shareId})
    if (!room || typeof room !== 'string') {
      return res.status(400).json({
        error: 'Missing room ID',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    if (!room.startsWith('gridfinity-')) {
      return res.status(400).json({
        error: 'Invalid room ID format',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Extract share ID and validate format
    const shareId = room.replace('gridfinity-', '');
    if (!isValidShareId(shareId)) {
      return res.status(400).json({
        error: 'Invalid share ID',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Validate user ID
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Missing user ID',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Fetch share metadata from Vercel Blob to check permission
    const blobPath = `shares/${shareId}.json`;
    const blobInfo = await head(blobPath).catch(() => null);

    if (!blobInfo) {
      return res.status(404).json({
        error: 'Share not found',
        code: ErrorCode.NOT_FOUND,
      });
    }

    const blobResponse = await fetch(blobInfo.url);
    if (!blobResponse.ok) {
      return res.status(404).json({
        error: 'Share not found',
        code: ErrorCode.NOT_FOUND,
      });
    }

    const shareData = (await blobResponse.json()) as ShareData;
    const permission = shareData.metadata.permission;

    // Prepare Liveblocks session
    const session = getLiveblocks().prepareSession(userId, {
      userInfo: {
        name: userName || 'Guest',
        color: assignColor(userId),
      },
    });

    // Grant access based on share permission level
    const accessLevel = permission === 'edit' ? session.FULL_ACCESS : session.READ_ACCESS;
    session.allow(room, accessLevel);

    // Authorize and return session token
    const { body, status } = await session.authorize();
    return res.status(status).send(body);
  } catch (error) {
    logger.error('Liveblocks auth error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      error: 'Authentication failed',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}
