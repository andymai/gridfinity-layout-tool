import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from './lib/rateLimit.js';
import {
  validateCollectionName,
  validateShareLayout,
  calculateCollectionExpiration,
  COLLECTION_CONSTRAINTS,
} from './lib/validation.js';
import { filterLayoutContent } from './lib/contentFilter.js';

/**
 * POST /api/collection - Create a new collection
 *
 * Request body:
 * {
 *   name: string;              // Collection name (max 64 chars)
 *   initialLayout?: Layout;    // Optional first layout
 * }
 *
 * Response (201):
 * {
 *   id: string;               // 12-char alphanumeric
 *   name: string;
 *   createdAt: number;
 *   expiresAt: number;
 *   url: string;              // Full shareable URL
 *   viewOnlyUrl: string;      // View-only URL
 *   layouts: CollectionLayoutRef[];
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
 * Generate a 12-character alphanumeric ID.
 * 62^12 = ~3.2e21 combinations
 */
function generateCollectionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const randomBytes = crypto.getRandomValues(new Uint8Array(12));
  for (let i = 0; i < 12; i++) {
    id += chars[randomBytes[i] % chars.length];
  }
  return id;
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
  // Only allow POST for creating collections
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'collection:create');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many collections created. Try again later.',
        code: 'RATE_LIMITED',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Parse and validate request body
    const { name, initialLayout } = req.body || {};

    // Validate collection name
    const nameResult = validateCollectionName(name);
    if (!nameResult.valid) {
      return res.status(400).json({
        error: nameResult.error.message,
        code: nameResult.error.code,
      });
    }

    const collectionId = generateCollectionId();
    const now = Date.now();
    const expiresAt = calculateCollectionExpiration();

    // Process initial layout if provided
    const layouts: CollectionLayoutMetadata[] = [];
    let layoutToStore: Record<string, unknown> | null = null;
    let layoutId: string | null = null;

    if (initialLayout) {
      // Validate the layout
      const layoutJson = JSON.stringify(initialLayout);
      const validationResult = validateShareLayout(initialLayout, layoutJson.length);

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

      layoutId = generateLayoutId();
      layoutToStore = validationResult.layout;

      const layoutName = (validationResult.layout.name as string) || 'Untitled';
      layouts.push({
        id: layoutId,
        name: layoutName.slice(0, COLLECTION_CONSTRAINTS.NAME_MAX_LENGTH),
        modifiedAt: now,
        preview: extractLayoutPreview(validationResult.layout),
      });
    }

    // Create collection metadata
    const metadata: CollectionMetadata = {
      id: collectionId,
      name: nameResult.name,
      createdAt: now,
      modifiedAt: now,
      expiresAt,
      layoutCount: layouts.length,
      layouts,
    };

    // Store collection metadata
    await put(`collections/${collectionId}/meta.json`, JSON.stringify(metadata), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    // Store initial layout if provided
    if (layoutToStore && layoutId) {
      await put(
        `collections/${collectionId}/layouts/${layoutId}.json`,
        JSON.stringify({
          layout: layoutToStore,
          modifiedAt: now,
        }),
        {
          access: 'public',
          contentType: 'application/json',
          addRandomSuffix: false,
        }
      );
    }

    // Build response
    const baseUrl = getBaseUrl(req);
    const url = `${baseUrl}/c/${collectionId}`;
    const viewOnlyUrl = `${baseUrl}/c/${collectionId}/view`;

    return res.status(201).json({
      id: collectionId,
      name: nameResult.name,
      createdAt: now,
      expiresAt,
      url,
      viewOnlyUrl,
      layouts: layouts.map((l) => ({
        id: l.id,
        name: l.name,
        modifiedAt: l.modifiedAt,
        preview: l.preview,
      })),
    });
  } catch (error) {
    console.error('Collection creation error:', error);
    return res.status(500).json({
      error: 'Failed to create collection',
      code: 'NETWORK_ERROR',
    });
  }
}

/**
 * Get base URL from request headers.
 */
function getBaseUrl(req: VercelRequest): string {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${protocol}://${host}`;
}
