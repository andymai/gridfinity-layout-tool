/**
 * Where a lid cutout may go, and how deep it cuts — resolved once.
 *
 * Four layers consume this and none of them may disagree: the worker stage that
 * cuts the holes, the editor that draws the drawable area, the validator that
 * rejects a crafted payload, and the panel advisory that explains why a shape is
 * refused. Two of those cannot import brepjs, which is why the whole plan is
 * pure arithmetic over `BinParams` — the same reason `labelTabPlan` and
 * `dividerRailPlan` live outside the worker.
 *
 * The three facts it owns:
 *
 * 1. WHETHER the lid can take cutouts at all ({@link lidCutoutsAllowed}). This
 *    mirrors the gate on `inputs.text` exactly, because a hole and a glyph want
 *    the same thing — a flat face on the lid's top. A FULL stack grid leaves
 *    none; the lip-only variant does (its recessed floor is one clear face), and
 *    a polygon lid is excluded from both for the same auto-fit reason.
 *
 * 2. WHERE ({@link lidCutoutWindow}). NOT the lid's outer plate: a hole out
 *    there would sit directly over the mating shell's wall and take the top off
 *    it, and the shell is what grips the bin's lip. The window is the mating
 *    cavity's own footprint, so every hole opens into the cavity — which is open
 *    to the bin below, which is the whole point of a dispensing slot.
 *
 * 3. HOW DEEP ({@link lidCutoutHostFace}). Always the full remaining plate,
 *    measured from whichever surface is actually on top: the plate on a plain
 *    lid, the recessed floor under a tray. Same datum `resolveTextHostFace`
 *    picks, and for the same reason — the recess owns the visible surface once
 *    it exists.
 */

import type { BinParams } from '@/shared/types/bin';
import {
  LID_CORNER_RADIUS,
  resolveLidFootprintClearance,
  resolveLidPlateThickness,
  retentionBossRadius,
  retentionMagnetInset,
} from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { overhangExpansion, resolveOverhang } from '@/shared/utils/overhang';
import type { OverhangExpansion } from '@/shared/utils/overhang';
import { retentionMagnetPositions } from '@/shared/utils/retentionMagnetPlacement';

/**
 * Margin (mm) held between a cutout and the mating cavity's wall.
 *
 * The window is already the cavity footprint, so this is not what keeps a hole
 * off the shell — it is the printability band. A slot landing exactly on the
 * cavity face leaves a knife edge where the plate meets the wall; one bead of
 * material keeps the top of the shell a wall the slicer can actually lay down.
 */
export const LID_CUTOUT_WALL_MARGIN_MM = 0.8;

/**
 * Extra radius (mm) added to a retention boss when it is subtracted from a
 * cutout, so the hole leaves the boss its own perimeter rather than shaving it
 * tangentially.
 */
export const LID_CUTOUT_BOSS_MARGIN_MM = 0.6;

/** A circular region inside the window that a cutout must not open. */
export interface LidCutoutKeepout {
  /** Centre X in the window frame (mm from its left edge). */
  readonly x: number;
  /** Centre Y in the window frame (mm from its front edge). */
  readonly y: number;
  /** Radius in mm, margin already folded in. */
  readonly r: number;
}

/**
 * The drawable area for lid cutouts, in its own frame.
 *
 * Coordinates run `[0, spanW] × [0, spanD]` from the window's front-left
 * corner, matching how a bin cutout's `x`/`y` are read against its interior. It
 * is deliberately a SEPARATE frame from the bin's: the cavity footprint is
 * neither the bin's interior nor the lid's plate, and a shared origin would be
 * one more frame relationship to keep true (CLAUDE.md gotchas #7 and #8). The
 * editor draws the bin's interior as a ghost underlay instead, so alignment
 * stays an eye job rather than an arithmetic one.
 */
export interface LidCutoutWindow {
  readonly spanW: number;
  readonly spanD: number;
  /**
   * Model-space offset (mm) of the window's centre from the lid's own centre.
   * Non-zero only under asymmetric overhang, which shifts the lid's perimeter
   * to keep it over the bin's grown lip. The worker needs it to place the
   * cutters; the flat editor works in the offset-free window frame.
   */
  readonly offsetX: number;
  readonly offsetY: number;
  /** Corner radius (mm) of the window outline. */
  readonly cornerRadius: number;
  /** Regions a cutout must leave intact — retention magnet bosses. */
  readonly keepouts: readonly LidCutoutKeepout[];
}

/** The surface a lid cutout is measured from, and the material under it. */
export interface LidCutoutHostFace {
  /** Lid-local Z of the surface the cut starts at. 0 on a plain lid. */
  readonly topZ: number;
  /** Material (mm) below {@link topZ} — the full depth a cutout removes. */
  readonly thickness: number;
}

/**
 * Whether this design's lid can host cutouts.
 *
 * Mirrors the `inputs.text` gate in `resolveLidInputs`. Deliberately does NOT
 * consult `shouldGenerateLid`: `checkLidCompatibility` reaches the lid gate
 * through several planners already, and taking that route from here is how the
 * interior-relief gate ended up recursing (CLAUDE.md gotcha #18).
 */
export function lidCutoutsAllowed(params: BinParams): boolean {
  if (!params.lid.enabled) return false;
  // A lid needs a lip to grip.
  if (!params.base.stackingLip) return false;
  // A full stack grid owns the top face; the lip-only variant leaves the
  // recessed floor inside the lip, which is one clear face.
  if (params.lid.stackableTop && !params.lid.stackLipOnly) return false;
  // Polygon lids are excluded exactly as lid text is — the window would have to
  // follow the mask outline rather than a rounded rectangle.
  if (isPartialMask(params.cellMask)) return false;
  return true;
}

/**
 * The surface a cutout starts from and the plate under it.
 *
 * `resolveLidPlateThickness` already folds a tray recess into the plate
 * (`depth + max(topThicknessMm, LID_TRAY_FLOOR)`), so subtracting the recess
 * leaves exactly the tray's own floor — the thickness the user set, and the
 * material a hole through the tray actually has to clear.
 */
export function lidCutoutHostFace(params: BinParams): LidCutoutHostFace {
  const plate = resolveLidPlateThickness(params);
  const tray = params.lid.tray;
  if (tray.enabled && !params.lid.stackableTop) {
    return { topZ: -tray.depthMm, thickness: plate - tray.depthMm };
  }
  return { topZ: 0, thickness: plate };
}

/**
 * The drawable window, or null when {@link lidCutoutsAllowed} refuses.
 *
 * The lid's outer footprint is `width * pitch - 2 * fitClearance` plus the
 * overhang expansion, and its mating cavity sits a constant `LID_CORNER_RADIUS -
 * fitClearance` inside that (`buildMatingShell` holds the inner face at
 * `cavityInset` for every Z). The window is that cavity, pulled in one more
 * {@link LID_CUTOUT_WALL_MARGIN_MM} so the shell keeps a printable top.
 */
export function lidCutoutWindow(params: BinParams): LidCutoutWindow | null {
  if (!lidCutoutsAllowed(params)) return null;

  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  const fitClearance = resolveLidFootprintClearance(params);
  const cavityInset = LID_CORNER_RADIUS - fitClearance;
  const inset = cavityInset + LID_CUTOUT_WALL_MARGIN_MM;

  // Overhang grows the bin's body and lip outward and shifts them when opposite
  // sides differ; the lid wraps that, so the window travels with it. Resolved
  // through the shared helpers `resolveLidInputs` itself uses — re-deriving the
  // clamps here would be a second copy that can disagree about a negative side
  // or a disabled config. The polygon suppression the worker applies alongside
  // is unnecessary: `lidCutoutsAllowed` has already refused a masked lid.
  const expansion = overhangExpansion(resolveOverhang(params.overhang));

  const outerW = params.width * params.gridUnitMm - 2 * fitClearance + expansion.addW;
  const outerD = params.depth * gridUnitMmY - 2 * fitClearance + expansion.addD;

  const spanW = outerW - 2 * inset;
  const spanD = outerD - 2 * inset;
  // A 1x1 lid is ~32mm of window, so this only trips on a pathological pitch.
  if (spanW <= 0 || spanD <= 0) return null;

  return {
    spanW,
    spanD,
    offsetX: expansion.offsetX,
    offsetY: expansion.offsetY,
    cornerRadius: Math.max(cavityInset - LID_CUTOUT_WALL_MARGIN_MM, 0),
    keepouts: resolveKeepouts(params, spanW, spanD, expansion),
  };
}

/**
 * Retention-magnet bosses, expressed in the window frame.
 *
 * A magnetic lid hangs a boss from the floor plate at each corner (plus any
 * mid-edge magnets), and those bosses reach well inside the cavity — the inset
 * is `LID_MAGNET_LIP_CLEARANCE + bossRadius`, so the boss's inboard edge sits
 * roughly `2 * bossRadius` past the cavity face. A hole over one opens its
 * magnet pocket, which is invisible to any check on the lid alone: the solid
 * stays watertight, it just stops holding the bin.
 *
 * Positions mirror `retentionMagnetPositions` on the NOMINAL footprint plus the
 * overhang shift, because the bin and the lid must place magnets at the same XY
 * or they cannot mate.
 */
function resolveKeepouts(
  params: BinParams,
  spanW: number,
  spanD: number,
  expansion: OverhangExpansion
): readonly LidCutoutKeepout[] {
  // Same geometric predicate `resolveLidFootprintClearance` uses: a magnetic
  // lid on a lip-less or polygon bin gets no bosses at all.
  if (params.lid.attachment !== 'magnetic') return [];
  if (!params.base.stackingLip) return [];

  const magnet = params.lid.retentionMagnet;
  const bossR = retentionBossRadius(magnet.diameter);
  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;

  // The real placement function, not a second copy of it: edge magnets only land
  // on edges long enough to space them clear of the corners, and re-deriving that
  // rule here is how a keep-out set ends up describing bosses the lid does not
  // have (or missing ones it does).
  //
  // `expansion` is threaded through rather than re-resolved, so the window and
  // its keep-outs travel together under asymmetric overhang.
  const placements = retentionMagnetPositions(
    params.width,
    params.depth,
    params.gridUnitMm,
    gridUnitMmY,
    retentionMagnetInset(magnet.diameter),
    magnet.edgeMagnets,
    bossR,
    expansion
  );

  // The window spans [offset - span/2, offset + span/2] in model space, so
  // subtracting its left/front edge lands a centre in [0, span].
  const originX = expansion.offsetX - spanW / 2;
  const originY = expansion.offsetY - spanD / 2;
  return placements.map((p) => ({
    x: p.x - originX,
    y: p.y - originY,
    r: bossR + LID_CUTOUT_BOSS_MARGIN_MM,
  }));
}

// Placement checks — shared by the editor's advisory and the validator, so a
// shape the UI flags is the same shape the server refuses. The worker does not
// consult them: it clips geometrically instead, which is exact for any outline
// the pen tool can draw.

/** Axis-aligned bounds a cutout occupies in the window frame. */
export interface LidCutoutBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
}

/** True when the bounds fall entirely inside the window's span. */
export function lidCutoutInWindow(bounds: LidCutoutBounds, window: LidCutoutWindow): boolean {
  return (
    bounds.x >= 0 &&
    bounds.y >= 0 &&
    bounds.x + bounds.width <= window.spanW &&
    bounds.y + bounds.depth <= window.spanD
  );
}

/**
 * True when the bounds overlap a keepout. Tested against the bounding box rather
 * than the drawn outline: a shape whose box clears every boss certainly clears
 * the bosses, and one whose box overlaps is worth flagging even if its outline
 * happens to miss — the advisory errs toward warning, and the worker's clip is
 * what decides the geometry.
 */
export function lidCutoutHitsKeepout(bounds: LidCutoutBounds, window: LidCutoutWindow): boolean {
  return window.keepouts.some((k) => {
    const nearestX = Math.max(bounds.x, Math.min(k.x, bounds.x + bounds.width));
    const nearestY = Math.max(bounds.y, Math.min(k.y, bounds.y + bounds.depth));
    const dx = k.x - nearestX;
    const dy = k.y - nearestY;
    return dx * dx + dy * dy < k.r * k.r;
  });
}
