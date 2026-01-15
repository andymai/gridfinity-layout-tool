import { Liveblocks } from '@liveblocks/node';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from './lib/rateLimit.js';

/**
 * Liveblocks authentication endpoint.
 *
 * This endpoint authenticates users for Liveblocks room access.
 * For MVP, we use trust-based authentication:
 * - Anyone with the share ID can join the room
 * - Permission level (view/edit) will be enforced in Phase 3
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
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  try {
    // Check if Liveblocks is configured
    if (!process.env.LIVEBLOCKS_SECRET_KEY) {
      console.error('LIVEBLOCKS_SECRET_KEY not configured');
      return res.status(500).json({
        error: 'Collaboration not configured',
        code: 'CONFIGURATION_ERROR',
      });
    }

    // Rate limiting - use 'view' limits (100/min) since auth is lightweight
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'view');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Parse request body
    const { room, userId, userName } = req.body as AuthRequest;

    // Validate room ID format (must be gridfinity-{shareId})
    if (!room || typeof room !== 'string') {
      return res.status(400).json({
        error: 'Missing room ID',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!room.startsWith('gridfinity-')) {
      return res.status(400).json({
        error: 'Invalid room ID format',
        code: 'VALIDATION_ERROR',
      });
    }

    // Extract share ID for future permission checking
    const shareId = room.replace('gridfinity-', '');
    if (shareId.length !== 12) {
      return res.status(400).json({
        error: 'Invalid share ID',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate user ID
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Missing user ID',
        code: 'VALIDATION_ERROR',
      });
    }

    // TODO Phase 3: Fetch share metadata from Vercel Blob and check permission
    // For MVP, grant full access to everyone (trust-based)
    // This will be updated to check share.metadata.permission and grant
    // either READ_ACCESS or FULL_ACCESS accordingly

    // Prepare Liveblocks session
    const session = getLiveblocks().prepareSession(userId, {
      userInfo: {
        name: userName || 'Guest',
        color: assignColor(userId),
      },
    });

    // Grant full access for MVP (trust-based)
    // Phase 3: This will check permission and grant READ_ACCESS for view-only
    session.allow(room, session.FULL_ACCESS);

    // Authorize and return session token
    const { body, status } = await session.authorize();
    return res.status(status).send(body);
  } catch (error) {
    console.error('Liveblocks auth error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      code: 'SERVER_ERROR',
    });
  }
}
