/**
 * URL utilities for layout routing.
 * Handles hash-based routing for bookmarkable layout URLs.
 *
 * URL formats:
 * - #local/{id} - Direct link to a layout (only works on same device)
 * - #share={data} - Shared layout with embedded data (works anywhere)
 */

const LAYOUT_HASH_PREFIX = '#local/';
const SHARE_HASH_PREFIX = '#share=';

/**
 * Parse the current URL hash to extract a layout ID.
 * Returns null if no layout hash is present or if share hash takes precedence.
 */
export function parseLayoutIdFromHash(): string | null {
  const hash = window.location.hash;

  // Share links take precedence - they contain full layout data
  if (hash.startsWith(SHARE_HASH_PREFIX)) {
    return null;
  }

  // Check for layout hash
  if (hash.startsWith(LAYOUT_HASH_PREFIX)) {
    const id = hash.slice(LAYOUT_HASH_PREFIX.length);
    // Basic validation - must have some content
    if (id && id.length > 0) {
      return id;
    }
  }

  return null;
}

/**
 * Update the URL hash to point to a specific layout.
 * Uses replaceState to avoid polluting history on every auto-save.
 */
export function setLayoutHash(layoutId: string, addToHistory = false): void {
  const newHash = `${LAYOUT_HASH_PREFIX}${layoutId}`;

  if (addToHistory) {
    // Push to history - enables back/forward navigation
    window.history.pushState({ layoutId }, '', newHash);
  } else {
    // Replace without adding to history
    window.history.replaceState({ layoutId }, '', newHash);
  }
}

/**
 * Clear the layout hash from the URL.
 * Used when switching to a transient state like shared preview.
 */
export function clearLayoutHash(): void {
  // Remove hash entirely, keeping the rest of the URL
  const url = window.location.pathname + window.location.search;
  window.history.replaceState({}, '', url || '/');
}

/**
 * Check if the current URL has a share hash.
 * Share links take precedence over layout routing.
 */
export function hasShareHash(): boolean {
  return window.location.hash.startsWith(SHARE_HASH_PREFIX);
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

// ============================================================================
// Collection URL Utilities
// ============================================================================

/**
 * Collection URL format: /c/{12-char-alphanumeric}
 * View-only format: /c/{id}/view
 */
const COLLECTION_PATH_REGEX = /^\/c\/([a-zA-Z0-9]{12})(\/view)?$/;

/**
 * Parse a collection ID from the current URL pathname.
 * Returns the collection ID and whether it's view-only mode.
 */
export function parseCollectionFromURL(): { collectionId: string; viewOnly: boolean } | null {
  if (typeof window === 'undefined') return null;

  const match = window.location.pathname.match(COLLECTION_PATH_REGEX);
  if (match) {
    return {
      collectionId: match[1],
      viewOnly: match[2] === '/view',
    };
  }

  return null;
}

/**
 * Check if the current URL is a collection URL.
 */
export function isCollectionURL(): boolean {
  return parseCollectionFromURL() !== null;
}

/**
 * Set the URL to a collection path.
 */
export function setCollectionURL(collectionId: string, viewOnly = false, addToHistory = false): void {
  const path = viewOnly ? `/c/${collectionId}/view` : `/c/${collectionId}`;

  if (addToHistory) {
    window.history.pushState({ collectionId, viewOnly }, '', path);
  } else {
    window.history.replaceState({ collectionId, viewOnly }, '', path);
  }
}

/**
 * Clear the collection URL (navigate to root).
 */
export function clearCollectionURL(): void {
  if (typeof window === 'undefined') return;

  if (window.location.pathname.startsWith('/c/')) {
    window.history.replaceState({}, '', '/');
  }
}

/**
 * Get collection info from a popstate event's state object.
 */
export function getCollectionFromHistoryState(state: unknown): { collectionId: string; viewOnly: boolean } | null {
  if (state && typeof state === 'object' && 'collectionId' in state) {
    const collectionId = (state as { collectionId: unknown }).collectionId;
    const viewOnly = (state as { viewOnly?: unknown }).viewOnly === true;
    if (typeof collectionId === 'string' && collectionId.length === 12) {
      return { collectionId, viewOnly };
    }
  }
  return null;
}

/**
 * Generate a full collection URL for sharing.
 */
export function generateCollectionURL(collectionId: string, viewOnly = false): string {
  if (typeof window === 'undefined') return '';

  const base = `${window.location.origin}/c/${collectionId}`;
  return viewOnly ? `${base}/view` : base;
}
