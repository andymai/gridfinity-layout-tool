/**
 * CSS pattern overlays used to distinguish bin categories by texture, not color
 * alone (WCAG 1.4.1 — for colorblind / low-vision users). Applied as a
 * background-image layer on the bin fill, so patterns sit behind labels.
 *
 * Assignment is derived from the category id (not its list position) so a
 * category keeps the same pattern when categories are reordered.
 */

export interface CategoryPatternStyle {
  backgroundImage: string;
  backgroundSize: string;
}

/** Number of visually distinct patterns available. */
export const CATEGORY_PATTERN_COUNT = 10;

/**
 * Stable pattern index for a category id. Deterministic and independent of the
 * category's order in the list, so reordering never reshuffles patterns.
 */
export function getCategoryPatternIndex(categoryId: string): number {
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) {
    hash = (Math.imul(hash, 31) + categoryId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % CATEGORY_PATTERN_COUNT;
}

/**
 * Build the CSS background layer(s) for a pattern index, drawn in `color`.
 * Each entry is a distinct texture (diagonals, lines, dots, grids) so adjacent
 * categories stay easy to tell apart.
 */
export function getCategoryPatternStyle(index: number, color: string): CategoryPatternStyle {
  const line = (angle: number, gap: number, width = 1.5): string =>
    `repeating-linear-gradient(${angle}deg, ${color} 0, ${color} ${width}px, transparent ${width}px, transparent ${gap}px)`;

  switch (((index % CATEGORY_PATTERN_COUNT) + CATEGORY_PATTERN_COUNT) % CATEGORY_PATTERN_COUNT) {
    case 0: // forward diagonal hatch
      return { backgroundImage: line(45, 7), backgroundSize: 'auto' };
    case 1: // back diagonal hatch
      return { backgroundImage: line(-45, 7), backgroundSize: 'auto' };
    case 2: // vertical lines
      return { backgroundImage: line(90, 7), backgroundSize: 'auto' };
    case 3: // horizontal lines
      return { backgroundImage: line(0, 7), backgroundSize: 'auto' };
    case 4: // dots
      return {
        backgroundImage: `radial-gradient(${color} 1.3px, transparent 1.6px)`,
        backgroundSize: '8px 8px',
      };
    case 5: // cross-hatch (both diagonals)
      return { backgroundImage: `${line(45, 8)}, ${line(-45, 8)}`, backgroundSize: 'auto' };
    case 6: // grid (vertical + horizontal)
      return { backgroundImage: `${line(90, 8)}, ${line(0, 8)}`, backgroundSize: 'auto' };
    case 7: // dense forward diagonal
      return { backgroundImage: line(45, 4, 1), backgroundSize: 'auto' };
    case 8: // wide back diagonal
      return { backgroundImage: line(-45, 11, 2.5), backgroundSize: 'auto' };
    case 9: // coarse thick grid (distinct from the fine grid of case 6)
      return {
        backgroundImage: `${line(0, 12, 2.5)}, ${line(90, 12, 2.5)}`,
        backgroundSize: 'auto',
      };
    default:
      return { backgroundImage: 'none', backgroundSize: 'auto' };
  }
}
