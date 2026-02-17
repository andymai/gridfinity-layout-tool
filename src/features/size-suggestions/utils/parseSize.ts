/**
 * Parse a size string like "2x1" or "1.5x2" into width and depth.
 * Returns null for invalid formats.
 */
export function parseSize(size: string): { width: number; depth: number } | null {
  const match = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(size);
  if (!match) return null;
  const width = parseFloat(match[1]);
  const depth = parseFloat(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) return null;
  return { width, depth };
}
