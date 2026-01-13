import Redis from 'ioredis';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from '../../lib/rateLimit.js';
import { isValidCollectionId } from '../../lib/validation.js';

/**
 * Heartbeat endpoint for presence tracking.
 * POST /api/collection/[id]/heartbeat
 *
 * Clients send heartbeats while actively editing a layout.
 * Heartbeats expire after 60 seconds of no updates.
 *
 * Request: { layoutId: string, deviceId: string }
 * Response: { acknowledged: true, activeEditors: number }
 */

// Lazy-initialize Redis connection
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      commandTimeout: 5000,
    });
  }
  return redis;
}

// Heartbeat TTL in seconds (60 seconds)
const HEARTBEAT_TTL = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  const { id } = req.query;

  // Validate collection ID format
  if (typeof id !== 'string' || !isValidCollectionId(id)) {
    return res.status(400).json({
      error: 'Invalid collection ID',
      code: 'VALIDATION_ERROR',
    });
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'collection:heartbeat');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const { layoutId, deviceId } = req.body || {};

    // Validate required fields
    if (!layoutId || typeof layoutId !== 'string') {
      return res.status(400).json({
        error: 'layoutId is required',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({
        error: 'deviceId is required',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate layoutId format (UUID)
    if (!/^[a-f0-9-]{36}$/.test(layoutId)) {
      return res.status(400).json({
        error: 'Invalid layoutId format',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate deviceId length (prevent abuse)
    if (deviceId.length > 64) {
      return res.status(400).json({
        error: 'deviceId too long',
        code: 'VALIDATION_ERROR',
      });
    }

    const client = getRedis();
    let activeEditors = 0;

    if (client) {
      const now = Math.floor(Date.now() / 1000);
      const heartbeatKey = `heartbeat:${id}:${layoutId}`;

      // Store heartbeat with timestamp as score (for cleanup)
      await client.zadd(heartbeatKey, now, deviceId);

      // Remove expired heartbeats (older than TTL)
      await client.zremrangebyscore(heartbeatKey, 0, now - HEARTBEAT_TTL);

      // Set key expiration (cleanup if collection becomes inactive)
      await client.expire(heartbeatKey, HEARTBEAT_TTL * 2);

      // Count active editors
      activeEditors = await client.zcard(heartbeatKey);
    }

    return res.status(200).json({
      acknowledged: true,
      activeEditors,
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    // Don't fail the request on Redis errors - heartbeat is best-effort
    return res.status(200).json({
      acknowledged: true,
      activeEditors: 0,
    });
  }
}

/**
 * Get active editor count for a layout (used by poll endpoint).
 */
export async function getActiveEditorCount(
  collectionId: string,
  layoutId: string
): Promise<number> {
  const client = getRedis();
  if (!client) return 0;

  try {
    const now = Math.floor(Date.now() / 1000);
    const heartbeatKey = `heartbeat:${collectionId}:${layoutId}`;

    // Clean up expired and count remaining
    await client.zremrangebyscore(heartbeatKey, 0, now - HEARTBEAT_TTL);
    return await client.zcard(heartbeatKey);
  } catch (error) {
    console.error('Failed to get active editor count:', error);
    return 0;
  }
}
