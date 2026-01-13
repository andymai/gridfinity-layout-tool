import { put, del, head, list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from '../lib/rateLimit.js';
import {
  isValidCollectionId,
  validateCollectionName,
  isCollectionExpired,
  calculateCollectionExpiration,
} from '../lib/validation.js';
import { notifyCollectionUpdated } from '../lib/partykit.js';

/**
 * Collection CRUD operations:
 * - GET /api/collection/[id] - Get collection metadata and layout list
 * - PUT /api/collection/[id] - Update collection (rename)
 * - DELETE /api/collection/[id] - Delete entire collection
 */

interface CollectionMetadata {
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  expiresAt: number;
  layoutCount: number;
  layouts: CollectionLayoutMetadata[];
}

interface CollectionLayoutMetadata {
  id: string;
  name: string;
  modifiedAt: number;
  preview: {
    drawerWidth: number;
    drawerDepth: number;
    drawerHeight: number;
    binCount: number;
    layerCount: number;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  // Validate collection ID format
  if (typeof id !== 'string' || !isValidCollectionId(id)) {
    return res.status(400).json({
      error: 'Invalid collection ID',
      code: 'VALIDATION_ERROR',
    });
  }

  const metaPath = `collections/${id}/meta.json`;

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, id, metaPath);
    case 'PUT':
      return handlePut(req, res, id, metaPath);
    case 'DELETE':
      return handleDelete(req, res, id);
    default:
      res.setHeader('Allow', 'GET, PUT, DELETE');
      return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
}

/**
 * GET /api/collection/[id] - Get collection metadata and layout list
 */
async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
  metaPath: string
) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'collection:view');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

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
      // Collection expired - delete it
      await deleteCollectionBlobs(id);
      return res.status(404).json({
        error: 'Collection has expired',
        code: 'COLLECTION_EXPIRED',
      });
    }

    // Check if view-only mode requested (via query param or path)
    const viewOnly = req.query.view === 'true' || req.url?.includes('/view');

    // Return collection data
    return res.status(200).json({
      id: metadata.id,
      name: metadata.name,
      createdAt: metadata.createdAt,
      modifiedAt: metadata.modifiedAt,
      expiresAt: metadata.expiresAt,
      layoutCount: metadata.layoutCount,
      layouts: metadata.layouts,
      viewOnly,
    });
  } catch (error) {
    console.error('Collection fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch collection',
      code: 'NETWORK_ERROR',
    });
  }
}

/**
 * PUT /api/collection/[id] - Update collection metadata (rename)
 */
async function handlePut(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
  metaPath: string
) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'collection:update');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many updates. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const { name } = req.body || {};

    // Validate new name
    const nameResult = validateCollectionName(name);
    if (!nameResult.valid) {
      return res.status(400).json({
        error: nameResult.error.message,
        code: nameResult.error.code,
      });
    }

    // Fetch existing metadata
    const blobInfo = await head(metaPath).catch(() => null);
    if (!blobInfo) {
      return res.status(404).json({
        error: 'Collection not found',
        code: 'NOT_FOUND',
      });
    }

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

    // Update metadata
    const now = Date.now();
    const updatedMetadata: CollectionMetadata = {
      ...metadata,
      name: nameResult.name,
      modifiedAt: now,
      // Extend expiration on activity
      expiresAt: calculateCollectionExpiration(),
    };

    // Save updated metadata
    await put(metaPath, JSON.stringify(updatedMetadata), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // Notify PartyKit for real-time sync (fire and forget)
    notifyCollectionUpdated(id, updatedMetadata.name, now).catch(() => {});

    return res.status(200).json({
      id: updatedMetadata.id,
      name: updatedMetadata.name,
      modifiedAt: updatedMetadata.modifiedAt,
      expiresAt: updatedMetadata.expiresAt,
    });
  } catch (error) {
    console.error('Collection update error:', error);
    return res.status(500).json({
      error: 'Failed to update collection',
      code: 'NETWORK_ERROR',
    });
  }
}

/**
 * DELETE /api/collection/[id] - Delete entire collection
 */
async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  id: string
) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'collection:delete');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many delete attempts. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Delete all blobs for this collection
    const deletedCount = await deleteCollectionBlobs(id);

    if (deletedCount === 0) {
      return res.status(404).json({
        error: 'Collection not found',
        code: 'NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Collection deleted successfully',
    });
  } catch (error) {
    console.error('Collection delete error:', error);
    return res.status(500).json({
      error: 'Failed to delete collection',
      code: 'NETWORK_ERROR',
    });
  }
}

/**
 * Delete all blobs for a collection.
 */
async function deleteCollectionBlobs(collectionId: string): Promise<number> {
  try {
    // List all blobs with the collection prefix
    const { blobs } = await list({ prefix: `collections/${collectionId}/` });

    if (blobs.length === 0) {
      return 0;
    }

    // Delete all blobs
    await Promise.all(blobs.map((blob) => del(blob.url)));

    return blobs.length;
  } catch (error) {
    console.error('Failed to delete collection blobs:', error);
    throw error;
  }
}
