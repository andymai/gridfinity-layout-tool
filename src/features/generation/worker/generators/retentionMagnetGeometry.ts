/**
 * Shared geometry for lid-retention magnets.
 *
 * A magnetic lid holds onto the bin via four press-fit magnets: one in a
 * corner post rising from the bin's interior floor, and a mating one in a
 * corner boss hanging from the lid's floor down to meet it. They mate INSIDE
 * the bin mouth, below the lid's own mating skirt — not at the lip-top plane
 * (see {@link retentionInterfaceZ}, and for what happens when they try).
 * The seating transform is pinned to the lid's local `anchorZ`, which the
 * export assembly lands on the bin's lip top (`exportHandler` lifts the lid by
 * `lipTopZ - anchorZ`).
 *
 * The bin and the lid MUST place their magnets at the SAME XY or they won't
 * mate, so both callers derive positions from this single helper (the same
 * discipline `baseplateMagnets.magnetPositionsForCell` uses for stack magnets).
 * Positions ignore the per-part clearance so the bin's slightly-larger body and
 * the lid's slightly-smaller cavity still line up, but they DO follow the
 * overhang-expanded footprint — the magnets hug the stacking lip, and
 * overhang moves it. Unlike the stack sockets, which stay on the nominal grid
 * because they mate with a neighbouring bin's base rather than with this lip.
 */

import type { BinParams } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import type { OverhangExpansion } from './overhang';
import {
  LID_MAGNET_BOSS_WALL,
  LID_MAGNET_LIP_CLEARANCE,
  LID_MAGNET_SEAT_GAP,
  lidRetentionInterfaceZ,
} from './lidConstants';
import { resolveLidInputs } from './lidInputs';
import type { LidInputs } from './lidInputs';

/** Radial material kept around the magnet in its post/boss (mm). */
export function retentionBossRadius(magnetDiameter: number): number {
  return magnetDiameter / 2 + LID_MAGNET_BOSS_WALL;
}

/**
 * Distance (mm) from the nominal footprint edge to the magnet centre.
 *
 * Set so the lid's boss (radius {@link retentionBossRadius}) sits fully INBOARD
 * of the bin's stacking lip: `inset - bossRadius = LID_MAGNET_LIP_CLEARANCE`, so
 * the boss can hang into the mouth without fouling the lip as the lid seats. The
 * bin's corner gusset then reaches back OUT to the interior walls to anchor
 * itself. Both parts use this same inset so their magnets stay coaxial.
 */
export function retentionMagnetInset(magnetDiameter: number): number {
  return LID_MAGNET_LIP_CLEARANCE + retentionBossRadius(magnetDiameter);
}

/**
 * A single retention magnet's XY position plus how its bin-side pad anchors.
 * The lid side ignores `anchor` (its bosses just hang from the floor); the bin
 * side reads it to pick the pad shape.
 */
export interface RetentionMagnetPlacement {
  readonly x: number;
  readonly y: number;
  /**
   * - `corner`: the classic gusset welded into the two adjacent interior walls.
   * - `y`: mid-span on a front/back wall (constant Y); its pad welds into that
   *   single Y-normal wall and cantilevers inward along Y.
   * - `x`: mid-span on a left/right wall (constant X); pad welds into that
   *   single X-normal wall and cantilevers inward along X.
   */
  readonly anchor: 'corner' | 'x' | 'y';
}

/** Along-edge clearance (mm) added to the boss diameter when deciding how many
 *  edge magnets fit, so neighbouring bosses can't fuse on a tiny custom grid. */
const EDGE_MAGNET_BOSS_GAP = 4;

/**
 * Evenly-spaced offsets (centre coords, symmetric about 0) for `requested`
 * magnets between two endpoints `span` apart, reduced to as many as keep every
 * gap — including the two gaps to the endpoints (the corner magnets) — at least
 * `minSpacing`. Empty when none fit, so a short edge yields no edge magnets even
 * when the user asks for some.
 */
function edgeMagnetOffsets(span: number, requested: number, minSpacing: number): number[] {
  if (requested < 1 || span <= 0) return [];
  // k interior points split the span into k+1 gaps; keep each gap >= minSpacing.
  const maxFit = Math.floor(span / minSpacing) - 1;
  const k = Math.min(requested, maxFit);
  if (k < 1) return [];
  const offsets: number[] = [];
  for (let i = 1; i <= k; i++) {
    offsets.push(-span / 2 + (span * i) / (k + 1));
  }
  return offsets;
}

/**
 * Magnet XY positions, inset from the footprint corner by
 * {@link retentionMagnetInset}. Nominal (not per-part) so the bin's
 * slightly-larger body and the lid's slightly-smaller cavity keep the magnets
 * coaxial.
 *
 * `expansion` is the bin's overhang footprint growth/shift. The magnets hug the
 * stacking lip, and overhang moves the lip, so they have to move with it
 * — otherwise a one-sided overhang leaves the magnets `overhang`mm inboard of
 * the corner on the overhung side, stranding the bin's corner gusset away from
 * the interior wall it welds into. Omit it for the un-overhung footprint.
 *
 * Always the four corners; plus, when `edgeMagnets >= 1`, that many magnets
 * spread along each edge long enough to space them clear of the corners (issue
 * Anti-sag reinforcement for large lids). `bossRadius` sizes the
 * min-spacing floor; it's unused when `edgeMagnets` is 0.
 */
export function retentionMagnetPositions(
  width: number,
  depth: number,
  gridUnitMmX: number,
  gridUnitMmY: number,
  inset: number,
  edgeMagnets = 0,
  bossRadius = 0,
  expansion?: OverhangExpansion | null
): ReadonlyArray<RetentionMagnetPlacement> {
  const cx = expansion?.offsetX ?? 0;
  const cy = expansion?.offsetY ?? 0;
  const halfW = (width * gridUnitMmX + (expansion?.addW ?? 0)) / 2;
  const halfD = (depth * gridUnitMmY + (expansion?.addD ?? 0)) / 2;
  const x = halfW - inset;
  const y = halfD - inset;
  // Local (footprint-centred) coords translated onto the overhang-shifted
  // centre, so every placement below reads as if the footprint were centred.
  const at = (
    lx: number,
    ly: number,
    anchor: RetentionMagnetPlacement['anchor']
  ): RetentionMagnetPlacement => ({ x: lx + cx, y: ly + cy, anchor });

  const placements: RetentionMagnetPlacement[] = [
    at(-x, -y, 'corner'),
    at(x, -y, 'corner'),
    at(-x, y, 'corner'),
    at(x, y, 'corner'),
  ];
  if (edgeMagnets >= 1) {
    // Space edge magnets at least one grid pitch apart (and never closer than
    // the boss diameter plus a small gap). `span` is the corner-magnet-to-
    // corner-magnet distance, so the same spacing check keeps them clear of the
    // corners too.
    const minGap = 2 * bossRadius + EDGE_MAGNET_BOSS_GAP;
    const minSpacingX = Math.max(gridUnitMmX, minGap);
    const minSpacingY = Math.max(gridUnitMmY, minGap);
    // Front/back walls (constant Y = ±y) run along X → distribute along X.
    for (const ox of edgeMagnetOffsets(2 * x, edgeMagnets, minSpacingX)) {
      placements.push(at(ox, -y, 'y'), at(ox, y, 'y'));
    }
    // Left/right walls (constant X = ±x) run along Y → distribute along Y.
    for (const oy of edgeMagnetOffsets(2 * y, edgeMagnets, minSpacingY)) {
      placements.push(at(-x, oy, 'x'), at(x, oy, 'x'));
    }
  }
  return placements;
}

/**
 * True when the design's lid uses magnetic retention and the geometry is
 * supported (has a stacking lip, rectangular footprint). Polygon (cellMask)
 * bins are excluded for now — corner placement on an arbitrary outline is
 * ambiguous; `checkLidCompatibility` surfaces that to the user.
 *
 * Independent of whether the lid is being exported in the same action: the
 * physical BIN always needs its magnet posts once a magnetic lid is designed
 * for it, so the bin's retention stage keys off this too.
 */
export function usesMagneticLid(params: BinParams): boolean {
  return (
    params.lid.enabled &&
    params.lid.attachment === 'magnetic' &&
    params.base.stackingLip &&
    !isPartialMask(params.cellMask)
  );
}

/**
 * {@link lidRetentionInterfaceZ} in the worker's `LidInputs` terms — the magnet
 * mating plane in lid-local Z, one {@link LID_MAGNET_SEAT_GAP} above the bin
 * pad's face.
 *
 * The formula itself lives in the shared lid module: `trayBottomSkirtDepth`
 * needs it on the main thread to know how far a magnetic tray's bosses hang,
 * and a second copy here is precisely how the two sides of this joint have gone
 * wrong before. This adapter exists only so the two worker
 * callers can pass the resolved inputs they already hold.
 */
export function retentionInterfaceZ(
  inputs: Pick<LidInputs, 'retentionMagnetDepth' | 'cavityExtraMm' | 'heightUnitMm'>
): number {
  return lidRetentionInterfaceZ(
    inputs.heightUnitMm,
    inputs.cavityExtraMm,
    inputs.retentionMagnetDepth
  );
}

/**
 * The two magnet faces that mate when the lid is seated, in BIN-WORLD Z.
 *
 * Same discipline as {@link retentionMagnetPositions} for XY: the bin's pad and
 * the lid's boss are built by different passes, so both must derive their
 * mating plane from {@link retentionInterfaceZ} or the pair drifts apart in Z
 * and the magnets never touch.
 *
 * - `lidFaceZ` — the lid boss's downward magnet face, lifted by the seating
 *   transform (`lipTopZ - anchorZ`) that `exportHandler` applies to the lid.
 * - `binFaceZ` — the bin pad's upward magnet face, one {@link LID_MAGNET_SEAT_GAP}
 *   below, so the pads can't bottom out and hold the lid off its lip.
 *
 * Their separation is `LID_MAGNET_SEAT_GAP` by construction; the scenario suite
 * asserts it so a change to either side's derivation can't silently close it.
 */
export function retentionSeatPlanes(
  params: BinParams,
  lipTopZ: number
): { readonly lidFaceZ: number; readonly binFaceZ: number } {
  const lidInputs = resolveLidInputs(params);
  const lidFaceZ = retentionInterfaceZ(lidInputs) + (lipTopZ - lidInputs.anchorZ);
  return { lidFaceZ, binFaceZ: lidFaceZ - LID_MAGNET_SEAT_GAP };
}
