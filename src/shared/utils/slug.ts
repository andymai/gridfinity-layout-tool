/**
 * URL slug utilities for human-readable layout URLs.
 *
 * Converts layout names to URL-safe slugs:
 * - "My Workshop Layout" → "my-workshop-layout"
 * - "Garage Tool Drawer #1" → "garage-tool-drawer-1"
 *
 * The slug is cosmetic (for SEO/readability). The layout ID is the
 * canonical identifier that actually routes to the content.
 */

/** Maximum slug length to keep URLs manageable */
const MAX_SLUG_LENGTH = 50;

/**
 * Convert a layout name to a URL-safe slug.
 *
 * Rules:
 * - Lowercase
 * - Spaces and underscores become hyphens
 * - Remove non-alphanumeric characters (except hyphens)
 * - Collapse multiple hyphens
 * - Trim hyphens from start/end
 * - Truncate to max length (at word boundary if possible)
 * - Default to "layout" if empty
 *
 * @example
 * slugify("My Workshop Layout") // "my-workshop-layout"
 * slugify("Garage Tool Drawer #1") // "garage-tool-drawer-1"
 * slugify("  --Hello World--  ") // "hello-world"
 * slugify("") // "layout"
 */
export function slugify(name: string): string {
  let slug = name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Truncate to max length, preferring word boundaries
  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_SLUG_LENGTH);
    // Try to cut at last hyphen to avoid partial words
    const lastHyphen = slug.lastIndexOf('-');
    if (lastHyphen > MAX_SLUG_LENGTH / 2) {
      slug = slug.slice(0, lastHyphen);
    }
  }

  return slug || 'layout';
}

/**
 * Build a full layout URL path from ID and name.
 *
 * @example
 * buildLayoutPath("abc123xyz789", "My Layout") // "/l/abc123xyz789/my-layout"
 */
export function buildLayoutPath(layoutId: string, layoutName: string): string {
  return `/l/${layoutId}/${slugify(layoutName)}`;
}
