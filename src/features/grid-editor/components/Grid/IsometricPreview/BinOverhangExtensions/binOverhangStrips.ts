/**
 * Pure geometry for the 3D overhang extension of a bin.
 *
 * A bin grows outward either into the drawer margin on edges it abuts or
 * by an explicit per-placement overhang from "Expand to Fit"; both arrive here
 * already reconciled by `resolveBinOverhang`. Rather than rebuild the merged bin
 * geometry, the extension is drawn as up to four solid strips filling the space
 * around the bin — left/right strips span the full (extended) depth so they also
 * cover the corners, and front/back strips fill only the bin's width. Strips
 * overlap the bin body by a hair so their inner faces sit inside the solid (no
 * coincident-face flicker).
 *
 * The generator grows only the body, so a strip hangs from the body's underside
 * (`bodyBase`), above the feet and clear of the baseplate margin beneath it. The
 * exception is an overhang with `feet`, whose foot lattice fills the over-tiled
 * margin down to the floor.
 *
 * All axes are in the preview's grid-unit scene space: X/Y match the bin
 * positions, and Z/height are height-units already scaled into that space by
 * `heightToGridScale`. Overhang is converted mm → grid units per axis, via
 * `gridUnitMm` across and `gridUnitMmY` in depth.
 */

import { resolveBinOverhang } from '@/shared/utils/drawerMargin';
import type { OverhangConfig, StoredBaseplateParams } from '@/core/types';
import type { ItemKind } from '@/shared/types/item';

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
  /**
   * Height of the drawn body's underside above `z`, scene space: the top of a
   * socketed bin's feet, 0 for a body that stands on the floor. Omitted = 0.
   */
  readonly bodyBase?: number;
  readonly extendToMargin?: boolean;
  readonly overhang?: OverhangConfig;
  /** Kind of the linked design; absent = parametric bin or unlinked. */
  readonly linkedKind?: ItemKind;
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
  gridUnitMm: number,
  /** Y-axis cell pitch (mm). Defaults to `gridUnitMm` for a square grid. */
  gridUnitMmY: number = gridUnitMm
): OverhangStrip[] {
  if (gridUnitMm <= 0 || gridUnitMmY <= 0) return [];
  const overhang = resolveBinOverhang(
    {
      x: bin.x,
      y: bin.y,
      width: bin.width,
      depth: bin.depth,
      extendToMargin: bin.extendToMargin,
      overhang: bin.overhang,
    },
    { width: drawerWidth, depth: drawerDepth },
    baseplate,
    bin.linkedKind
  );
  if (!overhang) return [];
  // Scene space is grid units on both axes, so each axis divides by its own
  // pitch: on a 42×21 grid the same mm of depth overhang is twice the fraction
  // of a cell that it would be across the width.
  const left = Math.max(0, overhang.left) / gridUnitMm;
  const right = Math.max(0, overhang.right) / gridUnitMm;
  const front = Math.max(0, overhang.front) / gridUnitMmY;
  const back = Math.max(0, overhang.back) / gridUnitMmY;
  if (left + right + front + back <= 0) return [];

  const { x, y, width, depth } = bin;
  const lift = overhang.feet === true ? 0 : Math.max(0, bin.bodyBase ?? 0);
  const height = bin.height - lift;
  if (height <= 0) return [];
  const zc = bin.z + lift + height / 2;
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
