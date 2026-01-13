import { put, del, head } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from '../../../lib/rateLimit.js';
import {
  isValidCollectionId,
  validateShareLayout,
  validateCollectionName,
  isCollectionExpired,
  calculateCollectionExpiration,
  COLLECTION_CONSTRAINTS,
} from '../../../lib/validation.js';
import { filterLayoutContent } from '../../../lib/contentFilter.js';
import { notifyLayoutUpdated, notifyLayoutDeleted } from '../../../lib/partykit.js';

/**
 * Layout CRUD operations within a collection:
 * - GET /api/collection/[id]/layout/[layoutId] - Get full layout data
 * - PUT /api/collection/[id]/layout/[layoutId] - Update layout (with conflict check)
 * - DELETE /api/collection/[id]/layout/[layoutId] - Remove layout from collection
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

interface StoredLayout {
  layout: Record<string, unknown>;
  modifiedAt: number;
}

/**
 * Validate UUID format.
 */
function isValidLayoutId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Extract preview data from a layout.
 */
function extractLayoutPreview(layout: Record<string, unknown>): CollectionLayoutMetadata['preview'] {
  const drawer = layout.drawer as { width: number; depth: number; height: number } | undefined;
  const bins = layout.bins as unknown[] | undefined;
  const layers = layout.layers as unknown[] | undefined;

  return {
    drawerWidth: drawer?.width ?? 10,
    drawerDepth: drawer?.depth ?? 8,
    drawerHeight: drawer?.height ?? 12,
    binCount: bins?.length ?? 0,
    layerCount: layers?.length ?? 1,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id, layoutId } = req.query;

  // Validate collection ID format
  if (typeof id !== 'string' || !isValidCollectionId(id)) {
    return res.status(400).json({
      error: 'Invalid collection ID',
      code: 'VALIDATION_ERROR',
    });
  }

  // Validate layout ID format
  if (typeof layoutId !== 'string' || !isValidLayoutId(layoutId)) {
    return res.status(400).json({
      error: 'Invalid layout ID',
      code: 'VALIDATION_ERROR',
    });
  }

  const metaPath = `collections/${id}/meta.json`;
  const layoutPath = `collections/${id}/layouts/${layoutId}.json`;

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, layoutPath);
    case 'PUT':
      return handlePut(req, res, id, layoutId, metaPath, layoutPath);
    case 'DELETE':
      return handleDelete(req, res, id, layoutId, metaPath, layoutPath);
    default:
      res.setHeader('Allow', 'GET, PUT, DELETE');
      return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
}

/**
 * GET /api/collection/[id]/layout/[layoutId] - Get full layout data
 */
async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  layoutPath: string
) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'collection:fetchLayout');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Fetch layout
    const blobInfo = await head(layoutPath).catch(() => null);
    if (!blobInfo) {
      return res.status(404).json({
        error: 'Layout not found',
        code: 'NOT_FOUND',
      });
    }

    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      return res.status(404).json({
        error: 'Layout not found',
        code: 'NOT_FOUND',
      });
    }

    const stored: StoredLayout = await response.json();

    return res.status(200).json({
      layout: stored.layout,
      modifiedAt: stored.modifiedAt,
    });
  } catch (error) {
    console.error('Layout fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch layout',
      code: 'NETWORK_ERROR',
    });
  }
}

/**
 * PUT /api/collection/[id]/layout/[layoutId] - Update layout with conflict detection
 *
 * Request body:
 * {
 *   layout: Layout;
 *   expectedModifiedAt?: number;  // For optimistic concurrency control
 *   name?: string;                // Optional rename
 * }
 *
 * Response (200): { modifiedAt: number }
 * Response (409): { code: 'CONFLICT', serverModifiedAt, serverLayout }
 */
async function handlePut(
  req: VercelRequest,
  res: VercelResponse,
  collectionId: string,
  layoutId: string,
  metaPath: string,
  layoutPath: string
) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'collection:updateLayout');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many updates. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const { layout, expectedModifiedAt, name } = req.body || {};

    if (!layout) {
      return res.status(400).json({
        error: 'Missing layout data',
        code: 'VALIDATION_ERROR',
      });
    }

    // Fetch collection metadata
    const metaBlobInfo = await head(metaPath).catch(() => null);
    if (!metaBlobInfo) {
      return res.status(404).json({
        error: 'Collection not found',
        code: 'NOT_FOUND',
      });
    }

    const metaResponse = await fetch(metaBlobInfo.url);
    const metadata: CollectionMetadata = await metaResponse.json();

    // Check expiration
    if (isCollectionExpired(metadata.expiresAt)) {
      return res.status(404).json({
        error: 'Collection has expired',
        code: 'COLLECTION_EXPIRED',
      });
    }

    // Fetch existing layout
    const layoutBlobInfo = await head(layoutPath).catch(() => null);
    if (!layoutBlobInfo) {
      return res.status(404).json({
        error: 'Layout not found',
        code: 'NOT_FOUND',
      });
    }

    const layoutResponse = await fetch(layoutBlobInfo.url);
    const existingStored: StoredLayout = await layoutResponse.json();

    // Conflict detection: if client provided expectedModifiedAt, check it
    if (expectedModifiedAt !== undefined && existingStored.modifiedAt > expectedModifiedAt) {
      return res.status(409).json({
        code: 'CONFLICT',
        serverModifiedAt: existingStored.modifiedAt,
        serverLayout: existingStored.layout,
      });
    }

    // Validate the new layout
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

    const now = Date.now();

    // Handle optional rename
    let newName: string | undefined;
    if (name !== undefined) {
      const nameResult = validateCollectionName(name);
      if (!nameResult.valid) {
        return res.status(400).json({
          error: nameResult.error.message,
          code: nameResult.error.code,
        });
      }
      newName = nameResult.name.slice(0, COLLECTION_CONSTRAINTS.NAME_MAX_LENGTH);
    }

    // Store updated layout
    await put(
      layoutPath,
      JSON.stringify({
        layout: validationResult.layout,
        modifiedAt: now,
      }),
      {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      }
    );

    // Update collection metadata
    const updatedLayouts = metadata.layouts.map((l) => {
      if (l.id === layoutId) {
        return {
          ...l,
          name: newName ?? l.name,
          modifiedAt: now,
          preview: extractLayoutPreview(validationResult.layout),
        };
      }
      return l;
    });

    const updatedMetadata: CollectionMetadata = {
      ...metadata,
      modifiedAt: now,
      expiresAt: calculateCollectionExpiration(),
      layouts: updatedLayouts,
    };

    await put(metaPath, JSON.stringify(updatedMetadata), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // Notify PartyKit for real-time sync (fire and forget)
    // Pass modifiedBy as undefined - clients can add their deviceId if needed
    notifyLayoutUpdated(collectionId, layoutId, now).catch(() => {});

    return res.status(200).json({
      modifiedAt: now,
    });
  } catch (error) {
    console.error('Layout update error:', error);
    return res.status(500).json({
      error: 'Failed to update layout',
      code: 'NETWORK_ERROR',
    });
  }
}

/**
 * DELETE /api/collection/[id]/layout/[layoutId] - Remove layout from collection
 */
async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  collectionId: string,
  layoutId: string,
  metaPath: string,
  layoutPath: string
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

    // Fetch collection metadata
    const metaBlobInfo = await head(metaPath).catch(() => null);
    if (!metaBlobInfo) {
      return res.status(404).json({
        error: 'Collection not found',
        code: 'NOT_FOUND',
      });
    }

    const metaResponse = await fetch(metaBlobInfo.url);
    const metadata: CollectionMetadata = await metaResponse.json();

    // Check if layout exists in collection
    const layoutIndex = metadata.layouts.findIndex((l) => l.id === layoutId);
    if (layoutIndex === -1) {
      return res.status(404).json({
        error: 'Layout not found in collection',
        code: 'NOT_FOUND',
      });
    }

    // Delete the layout blob
    await del(layoutPath);

    const now = Date.now();

    // Update collection metadata
    const updatedLayouts = metadata.layouts.filter((l) => l.id !== layoutId);
    const updatedMetadata: CollectionMetadata = {
      ...metadata,
      modifiedAt: now,
      expiresAt: calculateCollectionExpiration(),
      layoutCount: updatedLayouts.length,
      layouts: updatedLayouts,
    };

    await put(metaPath, JSON.stringify(updatedMetadata), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // Notify PartyKit for real-time sync (fire and forget)
    notifyLayoutDeleted(collectionId, layoutId).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Layout deleted successfully',
    });
  } catch (error) {
    console.error('Layout delete error:', error);
    return res.status(500).json({
      error: 'Failed to delete layout',
      code: 'NETWORK_ERROR',
    });
  }
}
