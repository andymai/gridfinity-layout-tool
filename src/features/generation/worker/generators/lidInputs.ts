/**
 * Resolved lid-geometry inputs derived from BinParams.
 *
 * The lid builder pipeline takes a `LidInputs` value rather than raw
 * `BinParams` so each builder phase only needs the fields it cares about
 * and the conversions (clearance, corner radius, anchor Z) happen once.
 */

import type { BinParams, LidCompatibilitySide } from '@/shared/types/bin';
import { checkLidCompatibility, computeDisabledRails } from '@/shared/types/bin';
import { isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import {
  LID_FIT_CLEARANCE,
  LID_CORNER_RADIUS,
  lidAnchorZ,
  lidWallBottomZ,
  lidTopThickness,
} from './lidConstants';
import { resolveOverhang, overhangExpansion, hasOverhang } from './overhang';

/** Geometric inputs derived from BinParams. */
export interface LidInputs {
  readonly lidOuterW: number;
  readonly lidOuterD: number;
  readonly lidCornerR: number;
  readonly fitClearance: number;
  readonly topThickness: number;
  /**
   * Cavity inner-face inset from the lid's outer perimeter. The wall in
   * the lip-mating zone is `cavityInset - LIP_BIG_TAPER = LID_WALL_THICKNESS`
   * (= 1.85mm); above the lip the chamfer hasn't kicked in yet so the
   * wall reads as the full `cavityInset` (= 3.75mm).
   */
  readonly cavityInset: number;
  readonly stackableTop: boolean;
  readonly magnetHoles: boolean;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  readonly cellsX: number;
  readonly cellsY: number;
  /**
   * Which side the half-unit cell sits on for fractional bins. Mirrors the
   * bin's base-socket placement so the lid's magnet holes line up with the
   * feet of the bin stacked on top. See {@link BinParams.fractionalEdgeX}.
   */
  readonly fractionalEdgeX: 'start' | 'end';
  readonly fractionalEdgeY: 'start' | 'end';
  readonly gridUnitMm: number;
  /** Y-axis grid pitch (mm). Equals gridUnitMm for a square grid. */
  readonly gridUnitMmY: number;
  readonly heightUnitMm: number;
  /**
   * Per-side rail engagement overrides driven by feature conflicts.
   * Aggregated from `computeDisabledRails(params)` so the lid builder
   * shares one source of truth with the LidSection panel. Any side in
   * this set is skipped during click-rail placement regardless of the
   * user's persisted `clickRails[side]` flag.
   *
   * Replaces the older `omitFrontBackRails` boolean — the granular
   * `Set<side>` lets label tabs disable only the BACK rail (instead of
   * symmetrically skipping front+back), and lets wall cutouts/handles
   * skip only the affected sides.
   */
  readonly disabledRails: ReadonlySet<LidCompatibilitySide>;
  /**
   * Per-side click-rail engagement. When all four are `false` the lid
   * is friction-fit (no positive snap). Combined with `disabledRails`
   * to produce the effective per-side rail set during placement — a
   * side gets a rail only when its `clickRails[side]` flag is true AND
   * it's not in `disabledRails`.
   */
  readonly clickRails: {
    readonly front: boolean;
    readonly back: boolean;
    readonly left: boolean;
    readonly right: boolean;
  };
  /**
   * Click-rail coverage as a fraction (0..1) of each wall's edge length.
   * Rails are always centered; a value of 1 keeps the historical
   * edge-to-edge behavior, lower values shrink the rail toward the
   * midpoint to save filament. Ignored when `clickRails === false`.
   */
  readonly clickRailCoverage: number;
  /** Z of the bin's lip top in lid-local coords when snapped (the "anchor" line). */
  readonly anchorZ: number;
  /** Z of the bottom of the mating wall (where the wall ends and rails begin). */
  readonly wallBottomZ: number;
  /** Custom-shape mask if the bin has one. Undefined = rectangular. */
  readonly cellMask: CellMask | undefined;
  /**
   * Outer-perimeter shift (mm) caused by asymmetric overhang. The lid's
   * perimeter, mating shell, floor, and click rails translate by this amount
   * so they wrap the bin's overhang-shifted outer body, while the stack grid
   * and magnet holes stay on the nominal socket grid (origin) to keep mating
   * with the bin's base sockets. Zero for symmetric/absent overhang and for
   * polygon bins (which suppress overhang, mirroring the box builder).
   */
  readonly outerOffsetX: number;
  readonly outerOffsetY: number;
}

export function resolveLidInputs(params: BinParams): LidInputs {
  const { gridUnitMm, heightUnitMm } = params;
  // Y axis uses gridUnitMmY when set (non-square grid); equals X for square.
  const gridUnitMmY = params.gridUnitMmY ?? gridUnitMm;
  // Single locked-down clearance — see comment on LID_FIT_CLEARANCE.
  const fitClearance = LID_FIT_CLEARANCE;
  // Floor plate grows when magnets are enabled to fit the pocket plus
  // a thin sealed ceiling above it (LID_MAGNET_CEILING).
  const topThickness = lidTopThickness(params.lid.magnetHoles, params.base.magnetDepth);

  // Polygon path activates when the mask is partially filled. A fully-filled
  // mask is treated as rectangular (matches the bin generator's convention).
  const cellMask = isPartialMask(params.cellMask) ? params.cellMask : undefined;

  // Overhang grows the bin's outer body + stacking lip outward (and shifts it
  // when the two opposite sides differ). The lid wraps that expanded body, so
  // its outer footprint must grow in lockstep — otherwise the lid is sized to
  // the nominal footprint and won't seat over the overhang. Polygon bins
  // suppress overhang (matching boxBuilder), so the lid does too.
  const overhang = resolveOverhang(params.overhang);
  const expansion = !cellMask && hasOverhang(overhang) ? overhangExpansion(overhang) : null;
  const addW = expansion?.addW ?? 0;
  const addD = expansion?.addD ?? 0;
  const outerOffsetX = expansion?.offsetX ?? 0;
  const outerOffsetY = expansion?.offsetY ?? 0;

  // Lid outer footprint: `bin*42 - 2*Clearance` per side, plus the overhang
  // expansion. The lid uses its OWN corner radius (`LID_CORNER_RADIUS = 4mm`),
  // NOT the bin's `BOX_CORNER_RADIUS` (3.75mm) — using the bin value shifts
  // rails, shrinks walls, and breaks lip fit.
  const lidOuterW = params.width * gridUnitMm - 2 * fitClearance + addW;
  const lidOuterD = params.depth * gridUnitMmY - 2 * fitClearance + addD;
  // lidCornerR and cavityInset are the same expression: both are the lid's
  // effective corner radius after clearance. `cavityInset` names the semantic
  // role (inner-face distance from outer perimeter); `lidCornerR` is used by
  // geometry helpers. Cavity wall thickness in the lip-mating zone =
  // cavityInset - LIP_BIG_TAPER = 1.85mm.
  const lidCornerR = LID_CORNER_RADIUS - fitClearance;
  const cavityInset = lidCornerR;

  return {
    lidOuterW,
    lidOuterD,
    lidCornerR,
    fitClearance,
    topThickness,
    cavityInset,
    stackableTop: params.lid.stackableTop,
    // Magnets only have a stack-grid neighbour to mate with when
    // `stackableTop` is on. Off ⇒ skip the pockets even if the user
    // last toggled magnets on.
    magnetHoles: params.lid.magnetHoles && params.lid.stackableTop,
    magnetDiameter: params.base.magnetDiameter,
    magnetDepth: params.base.magnetDepth,
    cellsX: params.width,
    cellsY: params.depth,
    fractionalEdgeX: params.fractionalEdgeX,
    fractionalEdgeY: params.fractionalEdgeY,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    // Per-side rail skips derived from feature conflicts (label tabs,
    // wall cutouts on specific sides, handles intruding into the lip
    // Z range). Centralised in `lidCompatibility.computeDisabledRails`
    // so the UI rail-summary and the worker placement code stay in sync.
    disabledRails: computeDisabledRails(checkLidCompatibility(params)),
    clickRails: params.lid.clickRails,
    // Coverage stored as 0–100 percentage on LidConfig; converted to
    // a 0–1 fraction here for direct multiplication against rail lengths.
    clickRailCoverage: params.lid.clickRailCoverage / 100,
    anchorZ: lidAnchorZ(heightUnitMm, fitClearance),
    wallBottomZ: lidWallBottomZ(heightUnitMm, fitClearance),
    cellMask,
    outerOffsetX,
    outerOffsetY,
  };
}
