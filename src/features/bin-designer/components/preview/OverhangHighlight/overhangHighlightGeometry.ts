/**
 * Geometry for the overhang-section hover highlight (see OverhangHighlight).
 *
 * Pure box math, kept out of the R3F component so coordinate correctness is
 * unit-testable without a WebGL context. The bin is centered at the origin in
 * XY (matching FootprintGrid/BinMesh): `left`/`right` are −X/+X walls,
 * `front`/`back` are −Y/+Y walls, Z is height with z=0 at the bottom of the feet.
 *
 * The wall/overhang region spans `[wallBottomZ, wallTopZ]` — the flat bottom
 * under the overhang sits at the socket top, so wall sides start above the
 * feet, not at z=0. The feet ring lives in the socket zone `[0, wallBottomZ]`.
 */

import type { OverhangHighlightSide } from '@/features/bin-designer/types';

export interface HighlightBox {
  readonly center: readonly [number, number, number];
  readonly size: readonly [number, number, number];
}

export interface OverhangHighlightInput {
  /** Outer footprint width in mm (X extent), tolerance-adjusted. */
  readonly outerW: number;
  /** Outer footprint depth in mm (Y extent), tolerance-adjusted. */
  readonly outerD: number;
  /** Z of the overhang region's flat bottom (socket top; 0 for a flat base). */
  readonly wallBottomZ: number;
  /** Z of the body top including the stacking lip. */
  readonly wallTopZ: number;
  /** Per-side outward overhang in mm. */
  readonly overhang: {
    readonly left: number;
    readonly right: number;
    readonly front: number;
    readonly back: number;
  };
}

/** Thin sliver that marks a wall face when its overhang is 0mm. */
const FACE_THICKNESS = 0.4;
/** Minimum foot-ring slab height when the base is flat (no socket zone). */
const MIN_FOOT_HEIGHT = 0.6;

/**
 * Boxes to highlight in the 3D preview for the given overhang control. Wall
 * sides return a flush face sliver (always, so the wall is identifiable at 0mm)
 * plus a grown band extending outward by the side's overhang. `feet` returns
 * the bottom overhang ring affected by the feet toggle.
 */
export function computeOverhangHighlightBoxes(
  side: OverhangHighlightSide,
  { outerW, outerD, wallBottomZ, wallTopZ, overhang }: OverhangHighlightInput
): HighlightBox[] {
  const halfW = outerW / 2;
  const halfD = outerD / 2;

  if (side === 'feet') {
    return footRingBoxes(halfW, halfD, wallBottomZ, overhang);
  }

  const wallH = wallTopZ - wallBottomZ;
  const midZ = (wallBottomZ + wallTopZ) / 2;
  const boxes: HighlightBox[] = [];
  const value = overhang[side];

  switch (side) {
    case 'right':
      boxes.push({ center: [halfW, 0, midZ], size: [FACE_THICKNESS, outerD, wallH] });
      if (value > 0) {
        boxes.push({ center: [halfW + value / 2, 0, midZ], size: [value, outerD, wallH] });
      }
      break;
    case 'left':
      boxes.push({ center: [-halfW, 0, midZ], size: [FACE_THICKNESS, outerD, wallH] });
      if (value > 0) {
        boxes.push({ center: [-halfW - value / 2, 0, midZ], size: [value, outerD, wallH] });
      }
      break;
    case 'back':
      boxes.push({ center: [0, halfD, midZ], size: [outerW, FACE_THICKNESS, wallH] });
      if (value > 0) {
        boxes.push({ center: [0, halfD + value / 2, midZ], size: [outerW, value, wallH] });
      }
      break;
    case 'front':
      boxes.push({ center: [0, -halfD, midZ], size: [outerW, FACE_THICKNESS, wallH] });
      if (value > 0) {
        boxes.push({ center: [0, -halfD - value / 2, midZ], size: [outerW, value, wallH] });
      }
      break;
  }

  return boxes;
}

/**
 * Bottom overhang ring in the socket zone `[0, socketTopZ]`: per-side strips
 * span the nominal perpendicular extent and corner squares fill the gaps, so
 * adjacent overhangs never double-cover (translucent overlap would darken the
 * seam).
 */
function footRingBoxes(
  halfW: number,
  halfD: number,
  socketTopZ: number,
  overhang: OverhangHighlightInput['overhang']
): HighlightBox[] {
  const sizeZ = Math.max(socketTopZ, MIN_FOOT_HEIGHT);
  const z = sizeZ / 2;
  const { left, right, front, back } = overhang;
  const boxes: HighlightBox[] = [];

  if (right > 0) {
    boxes.push({ center: [halfW + right / 2, 0, z], size: [right, 2 * halfD, sizeZ] });
  }
  if (left > 0) {
    boxes.push({ center: [-halfW - left / 2, 0, z], size: [left, 2 * halfD, sizeZ] });
  }
  if (back > 0) {
    boxes.push({ center: [0, halfD + back / 2, z], size: [2 * halfW, back, sizeZ] });
  }
  if (front > 0) {
    boxes.push({ center: [0, -halfD - front / 2, z], size: [2 * halfW, front, sizeZ] });
  }

  if (right > 0 && back > 0) {
    boxes.push({ center: [halfW + right / 2, halfD + back / 2, z], size: [right, back, sizeZ] });
  }
  if (left > 0 && back > 0) {
    boxes.push({ center: [-halfW - left / 2, halfD + back / 2, z], size: [left, back, sizeZ] });
  }
  if (right > 0 && front > 0) {
    boxes.push({ center: [halfW + right / 2, -halfD - front / 2, z], size: [right, front, sizeZ] });
  }
  if (left > 0 && front > 0) {
    boxes.push({ center: [-halfW - left / 2, -halfD - front / 2, z], size: [left, front, sizeZ] });
  }

  return boxes;
}
