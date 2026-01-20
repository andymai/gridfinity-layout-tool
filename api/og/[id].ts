/**
 * Dynamic Open Graph meta tags endpoint for shared layouts.
 * Returns HTML with layout-specific OG tags for better social sharing.
 *
 * This enables rich previews when shared layout URLs are posted on:
 * - Social media (Twitter, Facebook, LinkedIn, Reddit)
 * - Messaging apps (Discord, Slack, iMessage)
 * - Search engines (Google, Bing)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { head } from '@vercel/blob';

interface LayoutData {
  name: string;
  drawer: {
    width: number;
    depth: number;
    height: number;
  };
  bins: Array<{ id: string }>;
  layers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

interface ShareMetadata {
  createdAt: string;
  lastUpdatedAt: string;
  permission: 'view' | 'edit';
  authorName?: string;
}

interface ShareData {
  layout: LayoutData;
  metadata: ShareMetadata;
}

/**
 * Validate share ID format (supports multiple formats for backwards compatibility)
 */
function isValidShareId(id: string): boolean {
  // Standard UUID format
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return true;
  // Base36 timestamp format
  if (/^[a-z0-9]+-[a-z0-9]{7}$/.test(id)) return true;
  // Legacy 12-char alphanumeric format
  if (/^[a-zA-Z0-9]{12}$/.test(id)) return true;
  return false;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a description from layout data
 */
function generateDescription(layout: LayoutData, authorName?: string): string {
  const { drawer, bins, layers, categories } = layout;
  const parts: string[] = [];

  parts.push(`${drawer.width}×${drawer.depth} Gridfinity drawer layout`);
  parts.push(`${bins.length} bin${bins.length !== 1 ? 's' : ''}`);

  if (layers.length > 1) {
    parts.push(`${layers.length} layers`);
  }

  if (categories.length > 1) {
    parts.push(`${categories.length} categories`);
  }

  let description = parts.join(' • ');

  if (authorName) {
    description += ` • Created by ${authorName}`;
  }

  description += ' • Plan and organize your 3D printed storage with the free Gridfinity Layout Tool.';

  return description;
}

/**
 * Generate page title from layout
 */
function generateTitle(layout: LayoutData, authorName?: string): string {
  const name = layout.name || 'Untitled Layout';
  if (authorName) {
    return `${name} by ${authorName} | Gridfinity Layout Tool`;
  }
  return `${name} | Gridfinity Layout Tool`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (typeof id !== 'string' || !isValidShareId(id)) {
    return res.status(400).json({
      error: 'Invalid share ID',
      code: 'VALIDATION_ERROR',
    });
  }

  const blobPath = `shares/${id}.json`;

  try {
    // Check if blob exists and fetch metadata
    const blobInfo = await head(blobPath).catch(() => null);

    if (!blobInfo) {
      // Return default OG tags if share not found
      return generateDefaultResponse(res, id);
    }

    // Fetch the blob content
    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      return generateDefaultResponse(res, id);
    }

    const shareData: ShareData = await response.json();
    const { layout, metadata } = shareData;

    const title = generateTitle(layout, metadata.authorName);
    const description = generateDescription(layout, metadata.authorName);
    const url = `https://gridfinitylayouttool.com/l/${id}`;

    // Return OG metadata as JSON (for use by the middleware or client)
    return res.status(200).json({
      title: escapeHtml(title),
      description: escapeHtml(description),
      url,
      image: 'https://gridfinitylayouttool.com/og-image.png',
      siteName: 'Gridfinity Layout Tool',
      type: 'website',
      layout: {
        name: escapeHtml(layout.name || 'Untitled Layout'),
        drawer: layout.drawer,
        binCount: layout.bins.length,
        layerCount: layout.layers.length,
        categoryCount: layout.categories.length,
      },
      author: metadata.authorName ? escapeHtml(metadata.authorName) : null,
      permission: metadata.permission,
      createdAt: metadata.createdAt,
    });
  } catch (error) {
    console.error('OG fetch error:', error);
    return generateDefaultResponse(res, id);
  }
}

/**
 * Generate default OG response when layout data isn't available
 */
function generateDefaultResponse(res: VercelResponse, id: string) {
  return res.status(200).json({
    title: 'Shared Gridfinity Layout | Gridfinity Layout Tool',
    description:
      'View this shared Gridfinity drawer layout. Plan and organize your 3D printed storage with the free Gridfinity Layout Tool.',
    url: `https://gridfinitylayouttool.com/l/${id}`,
    image: 'https://gridfinitylayouttool.com/og-image.png',
    siteName: 'Gridfinity Layout Tool',
    type: 'website',
    layout: null,
    author: null,
    permission: 'view',
    createdAt: null,
  });
}
