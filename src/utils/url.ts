/**
 * URL utilities for layout routing.
 * Handles hash-based routing for bookmarkable layout URLs.
 *
 * URL formats:
 * - #layout/{id} - Direct link to a layout (only works on same device)
 * - #share={data} - Shared layout with embedded data (works anywhere)
 */

const LAYOUT_HASH_PREFIX = '#layout/';
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
