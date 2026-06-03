/**
 * Placement math for a cutout's engraved label.
 *
 * Single source of truth shared by the generation engraver
 * (`buildCutoutLabelEngrave`) and the 2D cutout-editor preview
 * (`CutoutLabel3D`) so the on-screen label tracks the printed engraving.
 */

import type { Cutout } from '@/shared/types/bin';

export interface CutoutAabb {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * Rotation-aware world-coord AABB for a positioned cutout. Projects the four
 * rotated corners (rather than a diagonal-based safe box) so a label placed
 * against an edge never overlaps a rotated cutout's footprint.
 *
 * `originX`/`originY` shift the interior-frame origin: the 2D editor passes 0
 * (interior corner origin), generation passes `-innerW/2, -innerD/2` (the
 * bin body is centered on the model origin).
 */
export function cutoutWorldAabb(
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth' | 'rotation'>,
  originX: number,
  originY: number
): CutoutAabb {
  const cx = originX + cutout.x + cutout.width / 2;
  const cy = originY + cutout.y + cutout.depth / 2;
  const hw = cutout.width / 2;
  const hd = cutout.depth / 2;
  if (cutout.rotation === 0) {
    return { minX: cx - hw, maxX: cx + hw, minY: cy - hd, maxY: cy + hd };
  }
  const theta = (cutout.rotation * Math.PI) / 180;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lx, ly] of [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ] as const) {
    const wx = cx + lx * c - ly * s;
    const wy = cy + lx * s + ly * c;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy;
    if (wy > maxY) maxY = wy;
  }
  return { minX, maxX, minY, maxY };
}

export interface CutoutLabelPlacement {
  /** Center of the available band, in the same frame as the origin args. */
  readonly centerX: number;
  readonly centerY: number;
  /** Available width/depth of the band in mm (margin not yet subtracted). */
  readonly availW: number;
  readonly availD: number;
}

/**
 * Where a cutout's engraved label sits, and how much room it has, in the gap
 * between the cutout's rotated AABB and the bin interior boundary on the
 * chosen side.
 *
 * The side is interpreted in WORLD coordinates (top = +Y, right = +X, …); the
 * label text itself reads left-to-right regardless of cutout rotation, so
 * `availW` is always the band's X extent and `availD` its Y extent. Returns
 * `null` when the chosen side has no room.
 */
export function cutoutLabelPlacement(
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth' | 'rotation' | 'textSide'>,
  innerW: number,
  innerD: number,
  originX = 0,
  originY = 0
): CutoutLabelPlacement | null {
  const side = cutout.textSide ?? 'top';
  const { minX, maxX, minY, maxY } = cutoutWorldAabb(cutout, originX, originY);

  const interiorMinX = originX;
  const interiorMaxX = originX + innerW;
  const interiorMinY = originY;
  const interiorMaxY = originY + innerD;

  let availW: number;
  let availD: number;
  let centerX: number;
  let centerY: number;
  switch (side) {
    case 'top':
      availW = maxX - minX;
      availD = interiorMaxY - maxY;
      centerX = (minX + maxX) / 2;
      centerY = (maxY + interiorMaxY) / 2;
      break;
    case 'bottom':
      availW = maxX - minX;
      availD = minY - interiorMinY;
      centerX = (minX + maxX) / 2;
      centerY = (interiorMinY + minY) / 2;
      break;
    case 'left':
      availW = minX - interiorMinX;
      availD = maxY - minY;
      centerX = (interiorMinX + minX) / 2;
      centerY = (minY + maxY) / 2;
      break;
    case 'right':
      availW = interiorMaxX - maxX;
      availD = maxY - minY;
      centerX = (maxX + interiorMaxX) / 2;
      centerY = (minY + maxY) / 2;
      break;
    default:
      // Defensive: corrupt/hand-edited data could carry a side outside the
      // union, leaving the placement fields unassigned. Bail rather than
      // return garbage.
      return null;
  }
  if (availW <= 0 || availD <= 0) return null;
  return { centerX, centerY, availW, availD };
}
