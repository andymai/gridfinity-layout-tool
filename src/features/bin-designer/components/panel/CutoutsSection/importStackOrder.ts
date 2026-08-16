/**
 * Stacking order for a batch of imported cutout shapes.
 *
 * `addCutout` puts each new shape on its own layer at the top of the stack, so
 * importing a set hands out `zIndex` in the order the shapes are added — which
 * for an SVG is document order. That is the wrong key: an SVG commonly draws
 * its largest shape last (an outline, a border, a background rect), and since
 * an explicit layer outranks the renderer's smaller-shape-wins tiebreaker, that
 * shape ends up covering everything imported with it. The smaller shapes were
 * then impossible to click without dragging the big one away.
 *
 * Adding largest first puts the big shapes at the bottom, which is both what a
 * user expects of nested outlines and what the tiebreaker did before z-order
 * became explicit in.
 */

/** The bounding-box area the renderer's stacking key uses (`width * depth`). */
interface Sized {
  readonly width: number;
  readonly depth: number;
}

/**
 * Largest-first, so the caller's add loop assigns rising `zIndex` to shrinking
 * shapes. Stable for equal areas, so identical shapes keep document order.
 */
export function byDescendingArea<T extends Sized>(specs: readonly T[]): T[] {
  return [...specs].sort((a, b) => b.width * b.depth - a.width * a.depth);
}
