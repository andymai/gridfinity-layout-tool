/**
 * Multi-handle layout computation.
 *
 * Computes evenly-spaced horizontal offsets for N handles on a wall span.
 * Pure math — shared between handleBuilder (generation) and GhostHandles (preview).
 */

/** Minimum gap between handles and between handles and wall edges (mm). */
const MIN_GAP = 3;

/**
 * Compute horizontal center offsets for `count` handles on a wall.
 *
 * Handles are evenly distributed with equal gaps between them and the wall edges.
 * If the requested count cannot fit, reduces count until they fit.
 * Returns offsets relative to wall center (0 = centered).
 *
 * @param count - Requested number of handles (1-3)
 * @param wallSpan - Available wall interior span in mm
 * @param handleWidth - Width of each handle in mm
 * @returns Array of horizontal center offsets (mm), or empty if none fit
 */
export function computeMultiHandleOffsets(
  count: number,
  wallSpan: number,
  handleWidth: number
): number[] {
  // Try requested count, then reduce until they fit
  for (let n = Math.min(count, 3); n >= 1; n--) {
    const totalHandleWidth = n * handleWidth;
    const totalGapNeeded = (n + 1) * MIN_GAP;
    if (totalHandleWidth + totalGapNeeded > wallSpan) continue;

    const gap = (wallSpan - totalHandleWidth) / (n + 1);
    const offsets: number[] = [];
    for (let i = 0; i < n; i++) {
      // First handle center at -wallSpan/2 + gap + handleWidth/2, etc.
      const center = -wallSpan / 2 + gap * (i + 1) + handleWidth * (i + 0.5);
      offsets.push(center);
    }
    return offsets;
  }

  // Even one handle can't fit
  return [];
}
