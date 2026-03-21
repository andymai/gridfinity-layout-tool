/**
 * Compute the horizontal center of a wall cutout accounting for alignment and offset.
 *
 * Pure function with no feature-specific dependencies — shared between the
 * geometry builder (generation feature) and the ghost preview (bin-designer feature).
 *
 * @returns horizontal center coordinate relative to wall center (0 = centered on span)
 */
export function computeCutoutCenter(
  wallSpan: number,
  cutWidth: number,
  wallThickness: number,
  alignment: 'left' | 'center' | 'right',
  offset: number
): number {
  const halfSpan = wallSpan / 2;
  const halfCut = cutWidth / 2;
  const margin = wallThickness; // auto-margin from corner for structural integrity

  let anchor: number;
  switch (alignment) {
    case 'left':
      anchor = -halfSpan + margin + halfCut;
      break;
    case 'right':
      anchor = halfSpan - margin - halfCut;
      break;
    default:
      anchor = 0;
  }

  // Apply offset, clamped so cutout respects corner margin on both sides
  const raw = anchor + offset;
  const minCenter = -halfSpan + margin + halfCut;
  const maxCenter = halfSpan - margin - halfCut;
  // If cutout is too wide for margin, allow it centered (degenerate case)
  if (minCenter > maxCenter) return 0;
  return Math.max(minCenter, Math.min(maxCenter, raw));
}
