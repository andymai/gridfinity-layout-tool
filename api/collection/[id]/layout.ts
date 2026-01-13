import { put, head } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from '../../lib/rateLimit.js';
import {
  isValidCollectionId,
  validateShareLayout,
  validateLayoutCount,
  isCollectionExpired,
  calculateCollectionExpiration,
  generateUniqueLayoutName,
  COLLECTION_CONSTRAINTS,
} from '../../lib/validation.js';
import { filterLayoutContent } from '../../lib/contentFilter.js';
import { notifyLayoutAdded } from '../../lib/partykit.js';

/**
 * POST /api/collection/[id]/layout - Add a new layout to a collection
 *
 * Request body:
 * {
 *   layout: Layout;           // The layout data
 * }
 *
 * Response (201):
 * {
 *   id: string;              // Layout UUID
 *   name: string;            // Layout name (may be auto-suffixed)
 *   modifiedAt: number;
 * }
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

/**
 * Generate a UUID for layouts.
 */
function generateLayoutId(): string {
  return crypto.randomUUID();
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
  // Only allow POST for adding layouts
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
    const rateLimit = await checkRateLimit(clientIP, 'collection:addLayout');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many layouts added. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const { layout } = req.body || {};

    if (!layout) {
      return res.status(400).json({
        error: 'Missing layout data',
        code: 'VALIDATION_ERROR',
      });
    }

    // Fetch collection metadata
    const metaPath = `collections/${id}/meta.json`;
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

    // Check layout limit
    const countResult = validateLayoutCount(metadata.layoutCount);
    if (!countResult.valid) {
      return res.status(400).json({
        error: countResult.error.message,
        code: countResult.error.code,
      });
    }

    // Validate the layout
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

    // Generate unique layout name
    const existingNames = metadata.layouts.map((l) => l.name);
    const baseName = (validationResult.layout.name as string) || 'Untitled';
    const uniqueName = generateUniqueLayoutName(baseName, existingNames);

    const layoutId = generateLayoutId();
    const now = Date.now();

    // Create layout metadata
    const layoutMetadata: CollectionLayoutMetadata = {
      id: layoutId,
      name: uniqueName.slice(0, COLLECTION_CONSTRAINTS.NAME_MAX_LENGTH),
      modifiedAt: now,
      preview: extractLayoutPreview(validationResult.layout),
    };

    // Store the layout
    await put(
      `collections/${id}/layouts/${layoutId}.json`,
      JSON.stringify({
        layout: validationResult.layout,
        modifiedAt: now,
      }),
      {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      }
    );

    // Update collection metadata
    const updatedMetadata: CollectionMetadata = {
      ...metadata,
      modifiedAt: now,
      expiresAt: calculateCollectionExpiration(), // Extend on activity
      layoutCount: metadata.layoutCount + 1,
      layouts: [...metadata.layouts, layoutMetadata],
    };

    await put(metaPath, JSON.stringify(updatedMetadata), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // Notify PartyKit for real-time sync (fire and forget)
    notifyLayoutAdded(id, layoutId, layoutMetadata.name, now).catch(() => {});

    return res.status(201).json({
      id: layoutId,
      name: layoutMetadata.name,
      modifiedAt: now,
      preview: layoutMetadata.preview,
    });
  } catch (error) {
    console.error('Add layout error:', error);
    return res.status(500).json({
      error: 'Failed to add layout',
      code: 'NETWORK_ERROR',
    });
  }
}
