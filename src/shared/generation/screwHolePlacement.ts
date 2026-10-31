/**
 * Mount-down screw placement: a piece's params in, absolute hole positions
 * out. Kernel-free, so the BREP build, the direct-mesh draft and the
 * plate-level pad decision on the main thread all run this one planner and
 * cannot put a screw in different places for the same plate. The cutters
 * live in the worker's `baseplateScrews`.
 *
 * Floor sites snap to `magnetPositionsForCell`, which is also what the
 * magnets, the lightweight pads and the bin base use. One source for those
 * positions is what keeps a screw concentric with its magnet instead of 0.3mm
 * off it.
 */

import type { MagnetAnchor } from '@/core/types';
import { DEFAULT_MAGNET_ANCHOR } from '@/core/types';
import { SCREW_PAD_MIN_RETAIN_MM } from '@/core/baseplateDefaults';
import type { ScrewCellCorner, ScrewHoleParams } from '@/core/types/baseplate';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { baseplateFloorDepthBeforeScrews } from '@/shared/printSettings/baseplateHeight';
import { plateProfileHeightMm, socketHeightMm } from '@/shared/printSettings/gridfinityGeometry';
import {
  effectiveMarginBands,
  nearestWithLean,
  planPieceScrews,
  resolveScrewHeadDiameter,
  screwHeadRecessDepth,
  screwSnapPreference,
  type ScrewJunctionSite,
  type ScrewSite,
  type ScrewSlot,
} from './screwHolePlan';
import { forEachCell } from './cellDecomposition';
import type { CellInfo, ForEachCellOptions } from './cellDecomposition';
import { resolvePitch, type GridPitch, type GridUnitInput } from './gridPitch';
import {
  cellHostsAttachmentHoles,
  floorReliefReachesCorners,
  magnetPositionsForCell,
} from './magnetPositions';
import { baseplateCellClassifier, plateCornerRadii, plateFootprintMm } from './baseplateFrame';
import { screwJunctions } from './screwJunctionPlan';

export interface ResolvedScrewHole {
  readonly x: number;
  readonly y: number;
  readonly site: ScrewSite;
  /** Head seat depth below the top face, junction holes only. */
  readonly seatBelowTopMm?: number;
}

/**
 * A floor position and the centre of the cell it sits in. Every cell's magnet
 * set is point-symmetric about that centre, so reflecting through it always
 * lands on another candidate of the same cell.
 */
export type ScrewFloorCandidate = readonly [x: number, y: number, cellX: number, cellY: number];

/**
 * Candidate floor positions for a piece: every magnet position on a full cell.
 *
 * Sized with the LARGEST cutter that will sit at the position, per
 * `magnetPositionsForCell`'s contract. A ø8 countersink is wider than a ø6.5
 * magnet, so passing the magnet radius alone would let the placement clamp a
 * position closer to a wall than the cone can actually fit.
 *
 * Cell eligibility comes from `cellHostsAttachmentHoles`, matching
 * `buildMagnetHoles`: a screw sits on the same pad a magnet would, so a cell too
 * small to hold one holds neither, and a corner over it snaps inward to the
 * nearest cell that does.
 */
export function screwFloorCandidates(
  gridW: number,
  gridD: number,
  holeRadius: number,
  cellOpts: ForEachCellOptions & { gridUnitMm: GridUnitInput },
  cellFilter?: (cell: CellInfo) => boolean,
  anchor: MagnetAnchor = DEFAULT_MAGNET_ANCHOR
): ScrewFloorCandidate[] {
  const { x: pitchX, y: pitchY } = resolvePitch(cellOpts.gridUnitMm);
  const out: ScrewFloorCandidate[] = [];
  forEachCell(
    gridW,
    gridD,
    (cell) => {
      if (!cellHostsAttachmentHoles(cell, holeRadius, pitchX, pitchY)) return;
      if (cellFilter !== undefined && !cellFilter(cell)) return;
      for (const [x, y] of magnetPositionsForCell(cell, holeRadius, pitchX, pitchY, anchor)) {
        out.push([x, y, cell.centerX, cell.centerY]);
      }
    },
    cellOpts
  );
  return out;
}

/**
 * Turn planned slots into absolute positions.
 *
 * A margin or junction slot already carries its exact centre. A floor slot
 * carries only an ideal target, and is snapped to the nearest candidate (ties
 * by {@link screwSnapPreference}): the single rule that stops each layer
 * inventing its own notion of "the corner cell".
 *
 * Candidates are consumed as they are taken. Without that, every anchor on a
 * piece small enough to offer one magnet position would snap to the SAME point
 * and stack coincident holes there; a slot with nothing left is dropped.
 *
 * `'inner'` snaps on each candidate's reflection through its cell centre and
 * takes the candidate itself, so a slot gets the position opposite the one
 * `'outer'` would pick, in the same cell. Done this way rather than as a second
 * hop from the outer pick, it consumes candidates exactly as `'outer'` does and
 * keeps the half-turn symmetry, since the reflection commutes with the turn.
 */
export function resolveScrewHoles(
  slots: readonly ScrewSlot[],
  candidates: readonly ScrewFloorCandidate[],
  cellCorner: ScrewCellCorner = 'outer'
): ResolvedScrewHole[] {
  const available = [...candidates];
  const snapPoints = available.map(([x, y, cx, cy]) =>
    cellCorner === 'inner' ? ([2 * cx - x, 2 * cy - y] as const) : ([x, y] as const)
  );
  const holes: ResolvedScrewHole[] = [];

  for (const slot of slots) {
    if (slot.site === 'margin') {
      holes.push({ x: slot.target[0], y: slot.target[1], site: 'margin' });
      continue;
    }
    if (slot.site === 'junction') {
      holes.push({
        x: slot.target[0],
        y: slot.target[1],
        site: 'junction',
        seatBelowTopMm: slot.seatBelowTopMm ?? 0,
      });
      continue;
    }

    const bestIndex = nearestWithLean(slot.target, screwSnapPreference(slot.anchor), snapPoints);
    if (bestIndex < 0) continue;

    const [x, y] = available[bestIndex];
    available.splice(bestIndex, 1);
    snapPoints.splice(bestIndex, 1);
    holes.push({ x, y, site: 'floor' });
  }

  return holes;
}

/** Everything a piece contributes to its own screw placement. */
export interface ScrewPlacementInput {
  /** Padded printed footprint of the piece in mm. */
  readonly totalWidthMm: number;
  readonly totalDepthMm: number;
  /**
   * The radii the rounding cut will actually use — `resolveCornerRadii`'s
   * output, never the raw `params.cornerRadii` (absent in the linked mode, so
   * the containment test would treat every uniform radius as square corners
   * and site a margin screw in material the arc cuts away).
   */
  readonly resolvedCornerRadii: { tl: number; tr: number; bl: number; br: number };
  /** Grid extent in units, which is what the floor candidate lattice spans. */
  readonly gridW: number;
  readonly gridD: number;
  readonly pitch: GridPitch;
  readonly cellOpts: ForEachCellOptions;
  readonly magnetRadius: number;
  readonly magnetAnchor?: MagnetAnchor;
  /**
   * Restricts floor candidates and junctions to the cells a shaped plate
   * actually keeps and the edge inset allows.
   */
  readonly cellFilter?: (cell: CellInfo) => boolean;
  /** Junctions whose post holds the head; see {@link screwPlacementFor}. */
  readonly junctions?: readonly ScrewJunctionSite[];
}

/**
 * Largest cutter radius that will sit at a magnet position once screws are on.
 *
 * The lightweight floor cutter sizes each kept pad from the radius it is handed,
 * so a ø8 countersink concentric with a ø6.5 magnet would otherwise have its
 * cone breach the pad edge into the cross cutout. Callers pass this in place of
 * the bare magnet radius whenever a plate carries both.
 */
export function screwAwareHoleRadius(
  magnetRadius: number,
  screwParams: ScrewHoleParams | undefined
): number {
  if (screwParams === undefined || !screwParams.enabled) return magnetRadius;
  const headRadius = resolveScrewHeadDiameter(screwParams.headStyle, screwParams.headDiameter) / 2;
  return Math.max(magnetRadius, headRadius);
}

/** Slack so a cell exactly on the inset boundary counts as inside it. */
const INSET_EPSILON_MM = 1e-6;

/**
 * Cells lying wholly `insetCells` grid units or more inside every edge of a
 * piece's grid, or undefined when there is no inset. Measured from the grid,
 * not the padded footprint: the inset counts cells, and padding holds none.
 *
 * Junctions go through the same filter, and one survives only when all four of
 * its cells do, so a junction on the inset boundary is dropped with the ring it
 * touches. The test is symmetric about the grid centre, which is what keeps it
 * invariant under the half-turn a rotated identical piece is built with.
 */
export function screwInsetCellFilter(
  insetCells: number,
  gridW: number,
  gridD: number,
  pitch: GridPitch
): ((cell: CellInfo) => boolean) | undefined {
  if (insetCells <= 0) return undefined;
  const limitX = (gridW / 2 - insetCells) * pitch.x + INSET_EPSILON_MM;
  const limitY = (gridD / 2 - insetCells) * pitch.y + INSET_EPSILON_MM;
  return (cell) =>
    Math.abs(cell.centerX) + (cell.widthUnits * pitch.x) / 2 <= limitX &&
    Math.abs(cell.centerY) + (cell.depthUnits * pitch.y) / 2 <= limitY;
}

/**
 * Everything {@link planBaseplateScrewHoles} needs, derived from a piece's own
 * params. The BREP build, the draft mesh and the plate-level pad decision all
 * plan through this, so none can site a screw from inputs the others lack.
 *
 * Junctions are fit-checked at the height the plate has WITHOUT its screw pad.
 * A pad under pockets with no floor of their own leaves the feet resting on the
 * tapers, lower than the drawer would hold them, so the heads seat lower; the
 * pad decision plans unpadded, where the drawer stops the feet. Their corner
 * relief ignores floor screws: a cell holding one hosts magnet pads, which is
 * exactly when the relief stays clear of its corners.
 */
export function screwPlacementFor(
  screwParams: ScrewHoleParams,
  params: ResolvedBaseplateParams
): ScrewPlacementInput {
  const pitch = { x: params.gridUnitMm, y: params.gridUnitMmY ?? params.gridUnitMm };
  const cellOpts = {
    fractionalEdgeX: params.fractionalEdgeX,
    fractionalEdgeY: params.fractionalEdgeY,
    gridUnitMm: pitch,
  };
  const { widthMm, depthMm } = plateFootprintMm(params);
  const classify = baseplateCellClassifier(params);
  const outlineFilter =
    params.outline !== undefined
      ? (cell: CellInfo): boolean => classify(cell) === 'inside'
      : undefined;
  const insetFilter = screwInsetCellFilter(
    screwParams.edgeInsetCells ?? 0,
    params.width,
    params.depth,
    pitch
  );
  const cellFilter =
    outlineFilter !== undefined && insetFilter !== undefined
      ? (cell: CellInfo): boolean => outlineFilter(cell) && insetFilter(cell)
      : (outlineFilter ?? insetFilter);
  const profileHeight = plateProfileHeightMm(params.lowProfileBase);
  const floorBeforeScrews = baseplateFloorDepthBeforeScrews(params);
  const reliefRadius = screwAwareHoleRadius(params.magnetDiameter / 2, screwParams);
  return {
    totalWidthMm: widthMm,
    totalDepthMm: depthMm,
    resolvedCornerRadii: plateCornerRadii(params),
    gridW: params.width,
    gridD: params.depth,
    pitch,
    cellOpts,
    magnetRadius: params.magnetDiameter / 2,
    magnetAnchor: params.magnetAnchor,
    cellFilter,
    junctions: screwJunctions(
      screwParams,
      params.width,
      params.depth,
      profileHeight + floorBeforeScrews,
      profileHeight,
      socketHeightMm(params.lowProfileBase),
      cellOpts,
      cellFilter,
      (cell) =>
        floorReliefReachesCorners(params, cell, reliefRadius, pitch.x, pitch.y, () => false),
      (params.screwPadThicknessMm ?? 0) > 0 && floorBeforeScrews <= 0
    ),
  };
}

/**
 * Plan and resolve a piece's screw holes.
 *
 * `floorPadProvisioned` is always true: `buildFullParams` provisions the pad
 * whenever any piece of the plate has a screw that falls back to the floor, so a
 * floor site always has material to cut into. A piece may not second-guess
 * that. Pieces of one plate share a slab height, and one that decided for itself
 * would cut screws into a slab the others never grew.
 */
export function planBaseplateScrewHoles(
  screwParams: ScrewHoleParams,
  params: ResolvedBaseplateParams,
  input: ScrewPlacementInput
): ResolvedScrewHole[] {
  return resolveScrewHoles(
    planPieceScrews(screwParams, {
      widthMm: input.totalWidthMm,
      depthMm: input.totalDepthMm,
      bands: effectiveMarginBands(params),
      cornerRadii: input.resolvedCornerRadii,
      junctions: input.junctions,
      floorPadProvisioned: true,
    }),
    screwFloorCandidates(
      input.gridW,
      input.gridD,
      screwAwareHoleRadius(input.magnetRadius, screwParams),
      { ...input.cellOpts, gridUnitMm: input.pitch },
      input.cellFilter,
      input.magnetAnchor
    ),
    screwParams.cellCorner
  );
}

/**
 * Whether a piece obliges the whole plate to carry the pad: a screw falls back
 * to the pocket floor, or a margin screw's recess would leave less than
 * `SCREW_PAD_MIN_RETAIN_MM` under it in the plate WITHOUT the pad. A margin is
 * chosen by its width alone, so a deep counterbore can ride a wide band and
 * still need the height. Junction sites are already checked against the
 * unpadded plate. Plans exactly as the build does, so the pad is provisioned
 * for precisely the screws that use it.
 */
export function pieceScrewsNeedPad(params: ResolvedBaseplateParams): boolean {
  const screwParams = params.screwHoles;
  if (screwParams?.enabled !== true) return false;
  const unpaddedHeight =
    plateProfileHeightMm(params.lowProfileBase) + baseplateFloorDepthBeforeScrews(params);
  const marginRetained =
    unpaddedHeight - screwHeadRecessDepth(screwParams) >= SCREW_PAD_MIN_RETAIN_MM - 1e-9;
  const unpadded = { ...params, screwPadThicknessMm: 0 };
  return planBaseplateScrewHoles(
    screwParams,
    unpadded,
    screwPlacementFor(screwParams, unpadded)
  ).some((hole) => hole.site === 'floor' || (hole.site === 'margin' && !marginRetained));
}

/** True when a floor-sited screw lands inside this cell, so it keeps a floor. */
export function cellHoldsFloorScrew(
  holes: readonly ResolvedScrewHole[],
  cell: CellInfo,
  pitch: GridPitch
): boolean {
  const halfW = (cell.widthUnits * pitch.x) / 2;
  const halfD = (cell.depthUnits * pitch.y) / 2;
  return holes.some(
    (h) =>
      h.site === 'floor' &&
      Math.abs(h.x - cell.centerX) <= halfW &&
      Math.abs(h.y - cell.centerY) <= halfD
  );
}
