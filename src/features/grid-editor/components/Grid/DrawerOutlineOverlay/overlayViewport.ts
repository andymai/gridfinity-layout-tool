/**
 * Frame the drawer-outline overlay's SVG to the UNION of the padded plate and
 * the shape's flattened bbox (#3107). A custom perimeter may now reach past the
 * grid extent (or sit offset within it); framing to the plate alone clips
 * whatever the shape draws beyond it, since the SVG's own `overflow: hidden`
 * hard-crops the canvas. Mirrors the pen editor's grid∪sketch frame.
 *
 * All values are px in the plate-local frame (origin at the padded plate's
 * bottom-left, y-up). A shape reaching left of / below that origin yields a
 * negative `originX`/`originY`; the caller shifts its mm→px mapping by them so
 * the far side stays on-canvas without moving the grid.
 */

export interface OverlayShapeBoundsPx {
  readonly minX: number;
  readonly maxX: number;
  /** y-up: `minY` is the bottom edge, `maxY` the top. */
  readonly minY: number;
  readonly maxY: number;
}

export interface OverlayViewport {
  readonly svgW: number;
  readonly svgH: number;
  /** Container offsets: the SVG sits at `left = gap + offsetX`, `top = gap + offsetY`. */
  readonly offsetX: number;
  readonly offsetY: number;
  /** Subtract from the raw mm→px x so an off-origin shape stays on-canvas (≤ 0). */
  readonly originX: number;
  /** Undo inside the flipped mm→px y for the same reason (≤ 0). */
  readonly originY: number;
}

/**
 * `plateW`/`plateH` are the padded plate's px extent; `padL`/`padT` are the
 * left/top padding (px) already folded into that extent. `shape` is the
 * flattened outline bbox in the same plate-local px frame.
 */
export function computeOverlayViewport(
  plateW: number,
  plateH: number,
  padL: number,
  padT: number,
  shape: OverlayShapeBoundsPx
): OverlayViewport {
  const xMin = Math.min(0, shape.minX);
  const xMax = Math.max(plateW, shape.maxX);
  const yMin = Math.min(0, shape.minY);
  const yMax = Math.max(plateH, shape.maxY);
  return {
    svgW: xMax - xMin,
    svgH: yMax - yMin,
    offsetX: -padL + xMin,
    offsetY: -padT + (plateH - yMax),
    originX: xMin,
    originY: yMin,
  };
}
