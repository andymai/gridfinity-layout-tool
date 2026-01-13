import { head } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from '../../lib/rateLimit.js';
import { isValidCollectionId, isCollectionExpired } from '../../lib/validation.js';
import { getActiveEditorCount } from './heartbeat.js';

/**
 * Poll endpoint for lightweight change detection.
 * GET /api/collection/[id]/poll
 *
 * Returns collection modifiedAt and per-layout timestamps for efficient
 * change detection without fetching full layout data.
 *
 * Supports If-Modified-Since header for 304 Not Modified responses.
 */

interface CollectionMetadata {
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  expiresAt: number;
  layoutCount: number;
  layouts: Array<{
    id: string;
    name: string;
    modifiedAt: number;
  }>;
}

interface PollResponse {
  modifiedAt: number;
  layouts: Array<{
    id: string;
    modifiedAt: number;
    activeEditors: number;
  }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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
    // Rate limiting (generous for polling)
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'collection:poll');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const metaPath = `collections/${id}/meta.json`;

    // Check if collection exists
    const blobInfo = await head(metaPath).catch(() => null);
    if (!blobInfo) {
      return res.status(404).json({
        error: 'Collection not found',
        code: 'NOT_FOUND',
      });
    }

    // Fetch metadata
    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      return res.status(404).json({
        error: 'Collection not found',
        code: 'NOT_FOUND',
      });
    }

    const metadata: CollectionMetadata = await response.json();

    // Check expiration
    if (isCollectionExpired(metadata.expiresAt)) {
      return res.status(404).json({
        error: 'Collection has expired',
        code: 'COLLECTION_EXPIRED',
      });
    }

    // Check If-Modified-Since header for 304 response
    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince) {
      const clientTimestamp = parseInt(ifModifiedSince, 10);
      if (!isNaN(clientTimestamp) && metadata.modifiedAt <= clientTimestamp) {
        return res.status(304).end();
      }
    }

    // Build poll response with layout timestamps and active editor counts
    const layoutsWithEditors = await Promise.all(
      metadata.layouts.map(async (layout) => ({
        id: layout.id,
        modifiedAt: layout.modifiedAt,
        activeEditors: await getActiveEditorCount(id, layout.id),
      }))
    );

    const pollResponse: PollResponse = {
      modifiedAt: metadata.modifiedAt,
      layouts: layoutsWithEditors,
    };

    // Set caching headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Last-Modified', metadata.modifiedAt.toString());

    return res.status(200).json(pollResponse);
  } catch (error) {
    console.error('Collection poll error:', error);
    return res.status(500).json({
      error: 'Failed to poll collection',
      code: 'NETWORK_ERROR',
    });
  }
}
