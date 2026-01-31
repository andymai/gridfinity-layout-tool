/**
 * Pure utility functions for Vercel Edge Middleware.
 *
 * Extracted from middleware.ts for testability. All functions are
 * synchronous and have no external dependencies.
 */

/** Bot User-Agent patterns for social media crawlers and search engines. */
const BOT_PATTERNS = [
  'facebookexternalhit',
  'Twitterbot',
  'Slackbot',
  'LinkedInBot',
  'Discordbot',
  'WhatsApp',
  'TelegramBot',
  'Googlebot',
  'bingbot',
  'Applebot',
  'Embedly',
  'Pinterest',
  'Pinterestbot',
  'Rocket.Chat',
  'Iframely',
  'Mastodon',
];

/**
 * Check if a User-Agent string belongs to a known bot/crawler.
 */
export function isBotUserAgent(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_PATTERNS.some((pattern) => lower.includes(pattern.toLowerCase()));
}

/**
 * Extract the share ID from a `/l/{id}` or `/l/{id}/{slug}` pathname.
 *
 * Supports:
 * - 12-char alphanumeric IDs: `/l/abc123DEF456`
 * - Base36 timestamp IDs: `/l/lszwz1k7v-8j2kqp1`
 * - UUIDs: `/l/xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
 * - Any of the above with an optional trailing slug: `/l/{id}/my-layout-name`
 *
 * @returns The share ID, or null if the path doesn't match.
 */
export function extractShareId(pathname: string): string | null {
  // Match /l/{id} with optional /{slug}
  const match = pathname.match(/^\/l\/([^/]+)/);
  if (!match) return null;

  const id = match[1];

  // Validate: 12-char alphanumeric
  if (/^[a-zA-Z0-9]{12}$/.test(id)) return id;

  // Validate: UUID v4
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) {
    return id;
  }

  // Validate: Base36 timestamp format
  if (/^[a-z0-9]+-[a-z0-9]{7}$/.test(id)) return id;

  return null;
}

/**
 * Safely extract meta information from an untyped layout blob.
 *
 * Handles missing or malformed data gracefully, returning sensible
 * defaults for any field that can't be read.
 */
export function buildShareMeta(layout: unknown): { title: string; description: string } {
  const DEFAULT_TITLE = 'Shared Layout | Gridfinity Layout Tool';
  const DEFAULT_DESC =
    'View this shared Gridfinity drawer layout. Plan and visualize 3D printed drawer organizers.';

  if (typeof layout !== 'object' || layout === null) {
    return { title: DEFAULT_TITLE, description: DEFAULT_DESC };
  }

  const obj = layout as Record<string, unknown>;

  // Extract name
  const name = typeof obj.name === 'string' && obj.name.trim().length > 0 ? obj.name.trim() : '';
  const title = name.length > 0 ? `${name.slice(0, 60)} | Gridfinity Layout Tool` : DEFAULT_TITLE;

  // Extract drawer dimensions
  const drawer =
    typeof obj.drawer === 'object' && obj.drawer !== null
      ? (obj.drawer as Record<string, unknown>)
      : null;
  const width = drawer && typeof drawer.width === 'number' ? drawer.width : 0;
  const depth = drawer && typeof drawer.depth === 'number' ? drawer.depth : 0;

  // Count bins (excluding staging)
  const bins = Array.isArray(obj.bins) ? obj.bins : [];
  const gridBinCount = bins.filter(
    (b: unknown) =>
      typeof b === 'object' &&
      b !== null &&
      (b as Record<string, unknown>).layerId !== '__staging__'
  ).length;

  // Count layers
  const layers = Array.isArray(obj.layers) ? obj.layers : [];
  const layerCount = layers.length;

  // Build description
  const description =
    width > 0 && depth > 0
      ? `${width}\u00D7${depth} Gridfinity drawer layout with ${gridBinCount} bins across ${layerCount} layers.`
      : DEFAULT_DESC;

  return { title, description };
}

/**
 * Inject layout-specific meta tags into an HTML string.
 *
 * Performs targeted replacements on title, description, og:*, and twitter:* tags.
 * Also injects a noindex meta tag for shared layouts (they should not be indexed).
 */
export function injectMetaTags(
  html: string,
  meta: { title: string; description: string; url: string }
): string {
  const safeTitle = escapeHtml(meta.title);
  const safeDesc = escapeHtml(meta.description);
  const safeUrl = escapeHtml(meta.url);

  let result = html;

  // Replace <title>...</title>
  result = result.replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`);

  // Replace meta description
  result = result.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${safeDesc}$2`);

  // Replace og:title
  result = result.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${safeTitle}$2`);

  // Replace og:description
  result = result.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    `$1${safeDesc}$2`
  );

  // Replace og:url
  result = result.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${safeUrl}$2`);

  // Replace twitter:title
  result = result.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${safeTitle}$2`);

  // Replace twitter:description
  result = result.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    `$1${safeDesc}$2`
  );

  // Inject noindex for shared layouts (before closing </head>)
  result = result.replace(/(<meta\s+name="robots"\s+content=")[^"]*(")/, '$1noindex$2');

  return result;
}

/**
 * Escape special HTML characters to prevent XSS in injected meta content.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
