/**
 * Drawer-fit margin ("extend into drawer margin") resolution for placed bins
 * (#2462).
 *
 * A baseplate fills the gap between an integral grid and the physical drawer
 * with per-side padding (mm), stored on the layout as `baseplateParams`. A bin
 * that opts in (`bin.extendToMargin`) extends its walls into that padding on
 * every drawer edge it abuts. The overhang is derived live from the current
 * padding — never stored on the bin — so it tracks later padding edits, and its
 * feet match the baseplate's over-tile margin so the extension seats.
 */

import type { Bin, StoredBaseplateParams } from '@/core/types';
import type { OverhangConfig } from '@/shared/types/bin';

/** Per-side padding (mm) a bin could claim on each drawer edge it abuts. */
export interface MarginSides {
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
}

const ZERO_SIDES: MarginSides = { left: 0, right: 0, front: 0, back: 0 };

/** Grid-unit slack for edge-abutment comparisons (fractional drawers/bins). */
const EPS = 1e-6;

// Plain-number shapes (branded GridUnits are assignable) so both the layout
// planner and the 3D preview can call in with unbranded values. NOTE: x/y/width/
// depth are always in drawer GRID UNITS (the preview keeps bin X/Y in grid units,
// not world/mm) — the abutment math below compares them against the drawer size.
interface BinRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
}
interface DrawerSize {
  readonly width: number;
  readonly depth: number;
}

/**
 * The baseplate padding (mm) available on each drawer edge the bin abuts; 0 on
 * edges it doesn't touch or that have no padding. Origin is bottom-left, so
 * `front` = -Y (bottom), `back` = +Y (top). Fractional edges don't change which
 * physical side the padding sits on, so the mapping is direct.
 */
export function binMarginSides(
  bin: BinRect,
  drawer: DrawerSize,
  baseplate: StoredBaseplateParams | undefined
): MarginSides {
  if (!baseplate) return ZERO_SIDES;
  const abutsLeft = bin.x <= EPS;
  const abutsFront = bin.y <= EPS;
  const abutsRight = Math.abs(bin.x + bin.width - drawer.width) <= EPS;
  const abutsBack = Math.abs(bin.y + bin.depth - drawer.depth) <= EPS;
  return {
    left: abutsLeft ? Math.max(0, baseplate.paddingLeft) : 0,
    right: abutsRight ? Math.max(0, baseplate.paddingRight) : 0,
    front: abutsFront ? Math.max(0, baseplate.paddingFront) : 0,
    back: abutsBack ? Math.max(0, baseplate.paddingBack) : 0,
  };
}

/** Total claimable margin (mm) across all abutting edges. */
function sidesTotal(s: MarginSides): number {
  return s.left + s.right + s.front + s.back;
}

/**
 * Whether the bin is eligible to extend into the drawer margin — it abuts at
 * least one padded drawer edge. Drives the inspector toggle's visibility; does
 * NOT require the bin to be opted in.
 */
export function binCanExtendToMargin(
  bin: BinRect,
  drawer: DrawerSize,
  baseplate: StoredBaseplateParams | undefined
): boolean {
  return sidesTotal(binMarginSides(bin, drawer, baseplate)) > EPS;
}

/**
 * The live {@link OverhangConfig} for a bin that has opted into extending, or
 * `null` when it hasn't opted in or abuts no padded edge (dormant). mm come
 * from the current padding; `feet` matches the baseplate's over-tile margin.
 */
export function resolveBinMarginOverhang(
  bin: Pick<Bin, 'x' | 'y' | 'width' | 'depth' | 'extendToMargin'>,
  drawer: DrawerSize,
  baseplate: StoredBaseplateParams | undefined
): OverhangConfig | null {
  if (!bin.extendToMargin) return null;
  const sides = binMarginSides(bin, drawer, baseplate);
  if (sidesTotal(sides) <= EPS) return null;
  return {
    enabled: true,
    left: sides.left,
    right: sides.right,
    front: sides.front,
    back: sides.back,
    feet: baseplate?.overTile ?? false,
  };
}
