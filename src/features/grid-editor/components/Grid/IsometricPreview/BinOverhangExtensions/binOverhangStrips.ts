/**
 * Pure geometry for the 3D overhang extension of a bin.
 *
 * A bin grows outward either into the drawer margin on edges it abuts (#2462) or
 * by an explicit per-placement overhang from "Expand to Fit"; both arrive here
 * already reconciled by `binOverhangSides`. Rather than rebuild the merged bin
 * geometry, the extension is drawn as up to four solid strips filling the space
 * around the bin — left/right strips span the full (extended) depth so they also
 * cover the corners, and front/back strips fill only the bin's width. Strips
 * overlap the bin body by a hair so their inner faces sit inside the solid (no
 * coincident-face flicker).
 *
 * All axes are in the preview's grid-unit scene space: X/Y match the bin
 * positions, and Z/height are height-units already scaled into that space by
 * `heightToGridScale`. Padding is converted mm → grid units via `gridUnitMm`.
 */

import { binOverhangSides } from '@/shared/utils/drawerMargin';
import type { OverhangConfig, StoredBaseplateParams } from '@/core/types';

// All coordinates below are in the preview's grid-unit scene space (Z included).
export interface OverhangStripBin {
  readonly id: string;
  /** Bottom-left corner (x, y) and layer base (z), grid-unit scene space. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Grid-unit footprint. */
  readonly width: number;
  readonly depth: number;
  /** Bin height in grid-unit scene space (height-units × heightToGridScale). */
  readonly height: number;
  readonly extendToMargin?: boolean;
  readonly overhang?: OverhangConfig;
}

export interface OverhangStrip {
  readonly key: string;
  /** Box center in grid-unit scene space. */
  readonly position: readonly [number, number, number];
  /** Box size [width, depth, height]. */
  readonly size: readonly [number, number, number];
}

/** Slight inset (grid units) into the bin so strip inner faces aren't coincident. */
const OVERLAP = 0.02;

function box(
  key: string,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  zc: number,
  h: number
): OverhangStrip {
  return {
    key,
    position: [(x0 + x1) / 2, (y0 + y1) / 2, zc],
    size: [x1 - x0, y1 - y0, h],
  };
}

export function buildBinOverhangStrips(
  bin: OverhangStripBin,
  drawerWidth: number,
  drawerDepth: number,
  baseplate: StoredBaseplateParams | undefined,
  gridUnitMm: number
): OverhangStrip[] {
  if (gridUnitMm <= 0) return [];
  const sides = binOverhangSides(
    {
      x: bin.x,
      y: bin.y,
      width: bin.width,
      depth: bin.depth,
      extendToMargin: bin.extendToMargin,
      overhang: bin.overhang,
    },
    { width: drawerWidth, depth: drawerDepth },
    baseplate
  );
  const left = sides.left / gridUnitMm;
  const right = sides.right / gridUnitMm;
  const front = sides.front / gridUnitMm;
  const back = sides.back / gridUnitMm;
  if (left + right + front + back <= 0) return [];

  const { x, y, width, depth, z, height } = bin;
  const zc = z + height / 2;
  // Full extended Y span (incl. any front/back extension) for the side strips.
  const yFull0 = y - front;
  const yFull1 = y + depth + back;

  const strips: OverhangStrip[] = [];
  if (left > 0) strips.push(box(`${bin.id}-l`, x - left, x + OVERLAP, yFull0, yFull1, zc, height));
  if (right > 0)
    strips.push(
      box(`${bin.id}-r`, x + width - OVERLAP, x + width + right, yFull0, yFull1, zc, height)
    );
  // Front/back strips fill only the bin's own width; corners are handled above.
  if (front > 0) strips.push(box(`${bin.id}-f`, x, x + width, y - front, y + OVERLAP, zc, height));
  if (back > 0)
    strips.push(
      box(`${bin.id}-b`, x, x + width, y + depth - OVERLAP, y + depth + back, zc, height)
    );
  return strips;
}
