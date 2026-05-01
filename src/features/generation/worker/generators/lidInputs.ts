/**
 * Resolved lid-geometry inputs derived from BinParams.
 *
 * The lid builder pipeline takes a `LidInputs` value rather than raw
 * `BinParams` so each builder phase only needs the fields it cares about
 * and the conversions (clearance, corner radius, anchor Z) happen once.
 */

import type { BinParams } from '@/shared/types/bin';
import { isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import {
  LID_FIT_CLEARANCE,
  LID_CORNER_RADIUS,
  lidAnchorZ,
  lidWallBottomZ,
  lidTopThickness,
} from './lidConstants';

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
  readonly gridUnitMm: number;
  readonly heightUnitMm: number;
  /** Bin has a label on its back wall — disable click rails on the front/back walls. */
  readonly omitFrontBackRails: boolean;
  /**
   * Per-side click-rail engagement. When all four are `false` the lid
   * is friction-fit (no positive snap). Combined with `omitFrontBackRails`
   * to produce the effective per-side rail set during placement.
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
}

export function resolveLidInputs(params: BinParams): LidInputs {
  const { gridUnitMm, heightUnitMm } = params;
  // Single locked-down clearance — see comment on LID_FIT_CLEARANCE.
  const fitClearance = LID_FIT_CLEARANCE;
  // Floor plate grows when magnets are enabled to fit the pocket plus
  // a thin sealed ceiling above it (LID_MAGNET_CEILING).
  const topThickness = lidTopThickness(params.lid.magnetHoles, params.base.magnetDepth);

  // Lid outer footprint: `bin*42 - 2*Clearance` per side. The lid uses
  // its OWN corner radius (`LID_CORNER_RADIUS = 4mm`), NOT the bin's
  // `BOX_CORNER_RADIUS` (3.75mm) — using the bin value shifts rails,
  // shrinks walls, and breaks lip fit.
  const lidOuterW = params.width * gridUnitMm - 2 * fitClearance;
  const lidOuterD = params.depth * gridUnitMm - 2 * fitClearance;
  // lidCornerR and cavityInset are the same expression: both are the lid's
  // effective corner radius after clearance. `cavityInset` names the semantic
  // role (inner-face distance from outer perimeter); `lidCornerR` is used by
  // geometry helpers. Cavity wall thickness in the lip-mating zone =
  // cavityInset - LIP_BIG_TAPER = 1.85mm.
  const lidCornerR = LID_CORNER_RADIUS - fitClearance;
  const cavityInset = lidCornerR;

  // Polygon path activates when the mask is partially filled. A fully-filled
  // mask is treated as rectangular (matches the bin generator's convention).
  const cellMask = isPartialMask(params.cellMask) ? params.cellMask : undefined;

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
    gridUnitMm,
    heightUnitMm,
    // Label tabs always sit on the back wall (per labelTabBuilder convention).
    // Disable click rails along the bin's depth axis (front/back) so they
    // don't collide with the printed label tab.
    omitFrontBackRails: params.label.enabled,
    clickRails: params.lid.clickRails,
    // Coverage stored as 0–100 percentage on LidConfig; converted to
    // a 0–1 fraction here for direct multiplication against rail lengths.
    clickRailCoverage: params.lid.clickRailCoverage / 100,
    anchorZ: lidAnchorZ(heightUnitMm, fitClearance),
    wallBottomZ: lidWallBottomZ(heightUnitMm, fitClearance),
    cellMask,
  };
}
