/**
 * URL utilities for layout routing.
 *
 * URL format: /l/{layoutId}/{slug}
 * Example: /l/abc123xyz789/my-workshop-layout
 *
 * The layoutId is the canonical identifier (12-char alphanumeric).
 * The slug is cosmetic for SEO/readability - mismatched slugs redirect
 * to the canonical URL (like Stack Overflow).
 *
 * Legacy formats (backward compatible):
 * - #local/{uuid} - Old local layout hash
 * - #share={data} - URL-encoded shares (self-contained)
 */

import { isValidLayoutId, isLegacyUUID } from '@/shared/utils';
import { slugify } from './slug';

// Legacy prefixes for backward compatibility
const LEGACY_LOCAL_HASH_PREFIX = '#local/';
const LEGACY_SHARE_HASH_PREFIX = '#share=';

/** Layout URL prefix */
const LAYOUT_PATH_PREFIX = '/l/';

/**
 * Parse layout info from the current URL.
 *
 * Returns the layout ID and slug if present.
 * Handles both new format (/l/{id}/{slug}) and legacy formats.
 */
export function parseLayoutFromURL(): { layoutId: string; slug: string | null } | null {
  const pathname = window.location.pathname;
  const hash = window.location.hash;

  // Check for legacy URL-encoded share (takes highest precedence)
  if (hash.startsWith(LEGACY_SHARE_HASH_PREFIX)) {
    return null; // Let SharedLayoutImporter handle this
  }

  // Check for new format: /l/{layoutId}/{slug} or /l/{layoutId}
  const pathMatch = pathname.match(/^\/l\/([a-zA-Z0-9]{12})(?:\/(.*))?$/);
  if (pathMatch) {
    const [, layoutId, slug] = pathMatch;
    return { layoutId, slug: slug || null };
  }

  // Check for legacy UUID format: /l/{uuid}/{slug} or /l/{uuid}
  const uuidMatch = pathname.match(
    /^\/l\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/(.*))?$/i
  );
  if (uuidMatch) {
    const [, layoutId, slug] = uuidMatch;
    return { layoutId, slug: slug || null };
  }

  // Check for legacy local hash: #local/{id}
  if (hash.startsWith(LEGACY_LOCAL_HASH_PREFIX)) {
    const id = hash.slice(LEGACY_LOCAL_HASH_PREFIX.length);
    if (id && (isValidLayoutId(id) || isLegacyUUID(id))) {
      return { layoutId: id, slug: null };
    }
  }

  return null;
}

/**
 * Update the URL to point to a specific layout.
 *
 * @param layoutId - The layout's canonical ID
 * @param layoutName - The layout name (will be slugified)
 * @param addToHistory - Whether to add to browser history (default: false)
 */
export function setLayoutURL(layoutId: string, layoutName: string, addToHistory = false): void {
  const slug = slugify(layoutName);
  const newPath = `${LAYOUT_PATH_PREFIX}${layoutId}/${slug}`;

  // Skip if URL is already correct
  if (window.location.pathname === newPath) {
    return;
  }

  if (addToHistory) {
    window.history.pushState({ layoutId, slug }, '', newPath);
  } else {
    window.history.replaceState({ layoutId, slug }, '', newPath);
  }
}

/**
 * Clear the layout URL (navigate to root).
 * Used when entering a transient state like shared preview.
 */
export function clearLayoutURL(): void {
  if (window.location.pathname !== '/') {
    window.history.replaceState({}, '', '/');
  }
}

/**
 * Check if the current slug matches the expected slug for a layout.
 * Returns the canonical URL if redirect is needed, null if URL is correct
 * or if not currently on a layout URL.
 */
export function getCanonicalRedirect(layoutId: string, layoutName: string): string | null {
  const parsed = parseLayoutFromURL();

  // Not on a layout URL - no redirect needed
  if (!parsed) {
    return null;
  }

  const currentSlug = parsed.slug;
  const expectedSlug = slugify(layoutName);

  // Redirect if:
  // - No slug in URL (e.g., /l/abc123xyz789)
  // - Wrong slug (e.g., /l/abc123xyz789/old-name)
  if (currentSlug !== expectedSlug) {
    return `${LAYOUT_PATH_PREFIX}${layoutId}/${expectedSlug}`;
  }

  return null;
}

/**
 * Get the layout ID from a popstate event's state object.
 */
export function getLayoutIdFromHistoryState(state: unknown): string | null {
  if (state && typeof state === 'object' && 'layoutId' in state) {
    const layoutId = (state as { layoutId: unknown }).layoutId;
    if (typeof layoutId === 'string' && layoutId.length > 0) {
      return layoutId;
    }
  }
  return null;
}

/**
 * Check if the current URL has a legacy URL-encoded share.
 */
export function hasLegacyShareHash(): boolean {
  return window.location.hash.startsWith(LEGACY_SHARE_HASH_PREFIX);
}
