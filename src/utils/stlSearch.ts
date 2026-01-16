import type { STLSearchSite } from '../store/settings';

/**
 * Format a dimension value for display in search queries.
 * Handles fractional values (half-bin mode) appropriately.
 */
export function formatDimension(val: number): string {
  return val % 1 === 0 ? val.toString() : val.toFixed(1);
}

/**
 * Build a search URL by substituting bin dimensions into a URL template.
 * Replaces {width} and {depth} placeholders with formatted values.
 *
 * When needsSplit is true, searches for "gridfinity split" instead of dimensions,
 * since oversized bins won't have matching STLs.
 *
 * @example
 * buildSearchUrl(
 *   { urlTemplate: 'https://printables.com/search?q=gridfinity+{width}x{depth}', ... },
 *   { width: 2, depth: 3 }
 * )
 * // Returns: 'https://printables.com/search?q=gridfinity+2x3'
 *
 * @example
 * buildSearchUrl(
 *   { urlTemplate: 'https://printables.com/search?q=gridfinity+{width}x{depth}', ... },
 *   { width: 8, depth: 8 },
 *   true // needsSplit
 * )
 * // Returns: 'https://printables.com/search?q=gridfinity+split'
 */
export function buildSearchUrl(
  site: STLSearchSite,
  dimensions: { width: number; depth: number },
  needsSplit?: boolean
): string {
  if (needsSplit) {
    // Replace dimension placeholders with "split" in a single pass to avoid order issues
    return site.urlTemplate.replace(
      /\{width\}x\{depth\}|\{width\}%20\{depth\}|\{width\}|\{depth\}/g,
      (match) => {
        // Combined patterns get "split"
        if (match === '{width}x{depth}' || match === '{width}%20{depth}') {
          return 'split';
        }
        // Standalone {width} gets "split", {depth} gets empty (already handled by combined)
        if (match === '{width}') {
          return 'split';
        }
        // {depth} - remove to avoid duplicating "split" when following standalone {width}
        return '';
      }
    );
  }

  return site.urlTemplate
    .replace(/\{width\}/g, formatDimension(dimensions.width))
    .replace(/\{depth\}/g, formatDimension(dimensions.depth));
}

/**
 * Open a search URL in a new browser tab.
 * Uses noopener/noreferrer for security.
 */
export function openSearchUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Open an STL search for a specific site and bin dimensions.
 * Convenience function combining buildSearchUrl and openSearchUrl.
 *
 * @param needsSplit - If true, searches for "gridfinity split" instead of dimensions
 */
export function openSTLSearch(
  site: STLSearchSite,
  dimensions: { width: number; depth: number },
  needsSplit?: boolean
): void {
  const url = buildSearchUrl(site, dimensions, needsSplit);
  openSearchUrl(url);
}

/**
 * Validate a URL template for STL search.
 * Returns an error message if invalid, or null if valid.
 */
export function validateUrlTemplate(template: string): string | null {
  if (!template.trim()) {
    return 'URL template cannot be empty';
  }

  const hasWidth = template.includes('{width}');
  const hasDepth = template.includes('{depth}');

  if (!hasWidth && !hasDepth) {
    return 'URL template must include {width} or {depth} placeholder';
  }

  // Test URL validity by substituting test values
  const testUrl = template
    .replace(/\{width\}/g, '1')
    .replace(/\{depth\}/g, '1');

  try {
    new URL(testUrl);
    return null;
  } catch {
    return 'URL template must be a valid URL';
  }
}
