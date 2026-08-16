/**
 * How far a placed bin's body extends beyond its grid footprint.
 *
 * Two sources feed this. A baseplate fills the gap between an integral grid and
 * the physical drawer with per-side padding (mm), stored on the layout as
 * `baseplateParams`; a bin that opts in (`bin.extendToMargin`) extends its walls
 * into that padding on every drawer edge it abuts, derived live so it tracks
 * later padding edits. Separately, a bin may carry an explicit
 * `bin.overhang` authored by "Expand to Fit", which lets several bins tile a
 * span that isn't a whole number of grid units while sharing one linked design.
 *
 * `resolveBinOverhang` is the chokepoint that reconciles the two; everything
 * downstream (2D grid, isometric preview, export) goes through it. The
 * `binMarginSides`/`binCanExtendToMargin` pair stays padding-only, because the
 * inspector toggle's visibility must depend on padding alone — an authored
 * flare widens the resolved overhang but must not make the control appear.
 */

import type { OverhangConfig, StoredBaseplateParams, WallTaperProfile } from '@/core/types';

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
function abuttingEdges(bin: BinRect, drawer: DrawerSize): Record<keyof MarginSides, boolean> {
  return {
    left: bin.x <= EPS,
    front: bin.y <= EPS,
    right: Math.abs(bin.x + bin.width - drawer.width) <= EPS,
    back: Math.abs(bin.y + bin.depth - drawer.depth) <= EPS,
  };
}

export function binMarginSides(
  bin: BinRect,
  drawer: DrawerSize,
  baseplate: StoredBaseplateParams | undefined
): MarginSides {
  if (!baseplate) return ZERO_SIDES;
  const abuts = abuttingEdges(bin, drawer);
  return {
    left: abuts.left ? Math.max(0, baseplate.paddingLeft) : 0,
    right: abuts.right ? Math.max(0, baseplate.paddingRight) : 0,
    front: abuts.front ? Math.max(0, baseplate.paddingFront) : 0,
    back: abuts.back ? Math.max(0, baseplate.paddingBack) : 0,
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
  bin: Pick<OverhangSource, 'x' | 'y' | 'width' | 'depth' | 'extendToMargin' | 'marginTaper'>,
  drawer: DrawerSize,
  baseplate: StoredBaseplateParams | undefined
): OverhangConfig | null {
  if (!bin.extendToMargin) return null;
  const sides = binMarginSides(bin, drawer, baseplate);
  if (sidesTotal(sides) <= EPS) return null;
  const feet = baseplate?.overTile ?? false;
  // Flare widens the wall *above* the padding so the bin can reach into
  // a drawer's curved sides, which the flat baseplate padding can't describe.
  // The stored overhang is the width at the rim, so each abutting edge carries
  // padding + flare there and the taper insets by the flare to leave the base at
  // the padding. Composes with over-tile feet: those are framed from the base,
  // which the flare never narrows.
  const mt = bin.marginTaper?.enabled === true ? bin.marginTaper : undefined;
  const flare = Math.max(0, mt?.flare ?? 0);
  const abuts = abuttingEdges(bin, drawer);
  const flareOf = (side: keyof MarginSides): number => (abuts[side] ? flare : 0);
  // A zero flare is no taper at all under the additive model, so drop the
  // config rather than hand downstream an all-zero inset to resolve away.
  const taper =
    mt && flare > EPS
      ? {
          enabled: true,
          profile: mt.profile,
          bandHeight: mt.bandHeight,
          left: flareOf('left'),
          right: flareOf('right'),
          front: flareOf('front'),
          back: flareOf('back'),
        }
      : undefined;
  return {
    enabled: true,
    left: sides.left + flareOf('left'),
    right: sides.right + flareOf('right'),
    front: sides.front + flareOf('front'),
    back: sides.back + flareOf('back'),
    feet,
    ...(taper ? { taper } : {}),
  };
}

/**
 * Everything the overhang resolution needs from a bin. Extends the plain-number
 * `BinRect` for the same reason it exists: the isometric preview passes
 * scene-space numbers, not branded `GridUnits`. A real `Bin` is structurally
 * assignable.
 */
export interface OverhangSource extends BinRect {
  readonly extendToMargin?: boolean;
  readonly overhang?: OverhangConfig;
  readonly marginTaper?: {
    readonly profile: WallTaperProfile;
    readonly bandHeight: number;
    readonly enabled?: boolean;
    /**
     * Extra width (mm) at the rim beyond the drawer padding, on every abutting
     * edge. A single value rather than per-side, matching `profile`/`bandHeight`
     * — the per-side reach here is derived from the baseplate, not authored.
     */
    readonly flare?: number;
  };
}

/** A bin's own overhang, if it carries an enabled, non-trivial one. */
function explicitBinOverhang(bin: Pick<OverhangSource, 'overhang'>): OverhangConfig | null {
  const o = bin.overhang;
  if (!o) return null;
  if (o.enabled === false) return null;
  if (o.left + o.right + o.front + o.back <= EPS) return null;
  return o;
}

/**
 * The single chokepoint every consumer (2D grid, isometric preview, export)
 * uses to decide how far a placed bin's body extends beyond its footprint.
 *
 * Precedence:
 *  1. `bin.overhang` — explicit, authored by "Expand to Fit".
 *  2. `bin.extendToMargin` — derived live from the baseplate's drawer padding.
 *  3. `null` — the caller keeps whatever the linked design specifies in
 *     `params.overhang`.
 *
 * Tier 3 is deliberately *absence* rather than a third branch: the design's
 * params are only reachable where designs are loaded (export), and a signature
 * that took them would force `grid-editor` to import `bin-designer`, which the
 * module boundaries forbid. Returning `null` lets each caller apply its own
 * fallback — and matches the established rule that a resolved placement
 * overhang REPLACES the design's own rather than adding to it.
 */
export function resolveBinOverhang(
  bin: OverhangSource,
  drawer: DrawerSize,
  baseplate: StoredBaseplateParams | undefined
): OverhangConfig | null {
  return explicitBinOverhang(bin) ?? resolveBinMarginOverhang(bin, drawer, baseplate);
}

/**
 * Per-side mm a placed bin's body extends past its footprint, for renderers
 * that want plain numbers rather than an `OverhangConfig`. Zero on every side
 * when the bin has no resolved overhang.
 */
export function binOverhangSides(
  bin: OverhangSource,
  drawer: DrawerSize,
  baseplate: StoredBaseplateParams | undefined
): MarginSides {
  const o = resolveBinOverhang(bin, drawer, baseplate);
  if (!o) return ZERO_SIDES;
  return {
    left: Math.max(0, o.left),
    right: Math.max(0, o.right),
    front: Math.max(0, o.front),
    back: Math.max(0, o.back),
  };
}
