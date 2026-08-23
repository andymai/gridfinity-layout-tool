/**
 * Mount-down screw hole geometry for the baseplate.
 *
 * Splits into two halves so the draft mesh and the BREP build can share the
 * decisions without sharing a kernel:
 *   - {@link planBaseplateScrewHoles} and {@link resolveScrewHoles}: pure. Turn
 *     a piece's params into absolute XY positions, snapping each floor target to
 *     a real magnet position. No brepjs, so `baseplateDirectMesh` calls them too.
 *   - {@link buildScrewCutters}: the BREP cutters, built as one template per
 *     site and cloned per position, the same way magnets and pockets are.
 *
 * The floor snap is why this lives beside `baseplateMagnets` rather than in
 * shared: it consumes `magnetPositionsForCell`, which is also what the magnets,
 * the lightweight pads and the bin base use. One source for those positions is
 * what keeps a screw concentric with its magnet instead of 0.3mm off it.
 */

import { cylinder, drawCircle, unwrap, clone, translate, fuse } from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import type { MagnetAnchor } from '@/core/types';
import { DEFAULT_MAGNET_ANCHOR } from '@/core/types';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import {
  effectiveMarginBands,
  planPieceScrews,
  resolveScrewHeadDiameter,
  screwCutDepths,
  screwSnapPreference,
  type ScrewSite,
  type ScrewSlot,
} from '@/shared/generation/screwHolePlan';
import { SOCKET_HEIGHT, COPLANAR_MARGIN, forEachCell } from './generatorTypes';
import type { ForEachCellOptions, CellInfo } from './generatorTypes';
import { cellHostsAttachmentHoles, magnetPositionsForCell } from './baseplateMagnets';
import { resolvePitch, type GridPitch, type GridUnitInput } from './gridPitch';

export interface ResolvedScrewHole {
  readonly x: number;
  readonly y: number;
  readonly site: ScrewSite;
}

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
): Array<readonly [number, number]> {
  const { x: pitchX, y: pitchY } = resolvePitch(cellOpts.gridUnitMm);
  const out: Array<readonly [number, number]> = [];
  forEachCell(
    gridW,
    gridD,
    (cell) => {
      if (!cellHostsAttachmentHoles(cell, holeRadius, pitchX, pitchY)) return;
      if (cellFilter !== undefined && !cellFilter(cell)) return;
      out.push(...magnetPositionsForCell(cell, holeRadius, pitchX, pitchY, anchor));
    },
    cellOpts
  );
  return out;
}

/**
 * Squared-mm slack within which two candidates count as EQUIDISTANT, so the
 * lean decides between them rather than arrival order. Detecting the tie is the
 * point: the two magnets flanking a centreline are equidistant by construction,
 * so a strict `<` never reaches the lean at all.
 *
 * Compared against a SQUARED distance, so the slack it admits is `eps / 2r`,
 * not `sqrt(eps)`: ~0.04nm at an edge anchor's ~128mm², far under the lattice.
 */
const SNAP_TIE_EPSILON_MM2 = 1e-6;

/**
 * Turn planned slots into absolute positions.
 *
 * A margin slot already carries its exact centre. A floor slot carries only an
 * ideal target, and is snapped to the nearest candidate: the single rule that
 * stops each layer inventing its own notion of "the corner cell".
 *
 * Nearest alone is ambiguous: an edge-midpoint anchor ties exactly between the
 * two magnets flanking it, and taking the first leans every edge screw toward
 * one corner (#3698). Ties go to {@link screwSnapPreference}.
 *
 * Candidates are consumed as they are taken. Without that, every anchor on a
 * piece small enough to offer one magnet position would snap to the SAME point
 * and stack coincident holes there; a slot with nothing left is dropped.
 */
export function resolveScrewHoles(
  slots: readonly ScrewSlot[],
  candidates: ReadonlyArray<readonly [number, number]>
): ResolvedScrewHole[] {
  const available = [...candidates];
  const holes: ResolvedScrewHole[] = [];

  for (const slot of slots) {
    if (slot.site === 'margin') {
      holes.push({ x: slot.target[0], y: slot.target[1], site: 'margin' });
      continue;
    }

    const [leanX, leanY] = screwSnapPreference(slot.anchor);
    let bestIndex = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    let bestLean = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < available.length; i++) {
      const dx = available[i][0] - slot.target[0];
      const dy = available[i][1] - slot.target[1];
      const d = dx * dx + dy * dy;
      if (d > bestDist + SNAP_TIE_EPSILON_MM2) continue;

      const lean = dx * leanX + dy * leanY;
      if (d < bestDist - SNAP_TIE_EPSILON_MM2 || lean > bestLean) {
        bestDist = Math.min(bestDist, d);
        bestLean = lean;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) continue;

    const [x, y] = available[bestIndex];
    available.splice(bestIndex, 1);
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
  /** Restricts floor candidates to the cells a shaped plate actually keeps. */
  readonly cellFilter?: (cell: CellInfo) => boolean;
}

/**
 * Plan and resolve a piece's screw holes.
 *
 * The BREP build and the direct-mesh draft both go through here so they cannot
 * put a hole in different places for the same plate.
 *
 * `floorPadProvisioned` is always true: `buildFullParams` provisions the pad
 * whenever screws are enabled, so a floor site always has material to cut into.
 * A piece may not second-guess that. Pieces of one plate share a slab height,
 * and one that decided for itself would cut screws into a slab the others never
 * grew.
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
      floorPadProvisioned: true,
    }),
    screwFloorCandidates(
      input.gridW,
      input.gridD,
      screwAwareHoleRadius(input.magnetRadius, screwParams),
      { ...input.cellOpts, gridUnitMm: input.pitch },
      input.cellFilter,
      input.magnetAnchor
    )
  );
}

/**
 * One cutter template for a site, centred on the origin in XY.
 *
 * Z follows the BREP build's convention (top face at 0, growing downward), which
 * `screwCutDepths` converts to from its top-face datum.
 *
 * The recess is lofted rather than built from a cone primitive so the profile is
 * explicit: full head width AT the entry plane, narrowing to the shaft over
 * exactly `recessDepth`. It is extended `COPLANAR_MARGIN` above the entry plane
 * at full width, which cuts only air and keeps the boolean off a coplanar face.
 */
function buildScrewTemplate(
  params: ScrewHoleParams,
  site: ScrewSite,
  totalHeightMm: number
): Shape3D {
  const { entryBelowTop, recessDepth, throughDepth } = screwCutDepths(
    params,
    site,
    SOCKET_HEIGHT,
    totalHeightMm
  );
  const entryZ = -entryBelowTop;
  const shaftRadius = params.diameter / 2;
  const headRadius = resolveScrewHeadDiameter(params.headStyle, params.headDiameter) / 2;

  // Shaft runs from just above the entry plane clear through the underside.
  const shaft = cylinder(shaftRadius, throughDepth + 2 * COPLANAR_MARGIN, {
    at: [0, 0, entryZ + COPLANAR_MARGIN],
    axis: [0, 0, -1],
  });

  // No recess to cut when the head is no wider than the shaft: a countersink
  // would loft between coincident sections and a counterbore would be a pocket
  // narrower than the hole through it. Both kernels happen to tolerate the
  // degenerate loft today, which is not something to depend on. Reachable from
  // the UI, where the shaft tops out at the countersink head's default width.
  if (headRadius <= shaftRadius || recessDepth <= 0) {
    return shaft;
  }

  let recess: Shape3D;
  try {
    if (params.headStyle === 'counterbore') {
      recess = cylinder(headRadius, recessDepth + COPLANAR_MARGIN, {
        at: [0, 0, entryZ + COPLANAR_MARGIN],
        axis: [0, 0, -1],
      });
    } else {
      const section = (r: number, z: number): Sketch =>
        drawCircle(r).sketchOnPlane('XY', z) as Sketch;
      const start = section(headRadius, entryZ + COPLANAR_MARGIN);
      try {
        recess = start.loftWith(
          [section(headRadius, entryZ), section(shaftRadius, entryZ - recessDepth)],
          { ruled: true }
        );
      } finally {
        start.delete();
      }
    }
  } catch (e) {
    shaft.delete();
    throw e;
  }

  try {
    return unwrap(fuse(shaft, recess));
  } finally {
    shaft.delete();
    recess.delete();
  }
}

/**
 * Build cutters for every resolved hole. Templates are built once per site and
 * cloned, matching how magnets and pockets amortise their construction.
 */
export function buildScrewCutters(
  holes: readonly ResolvedScrewHole[],
  params: ScrewHoleParams,
  totalHeightMm: number
): Shape3D[] {
  if (holes.length === 0) return [];

  const templates = new Map<ScrewSite, Shape3D>();
  const cutters: Shape3D[] = [];

  try {
    for (const hole of holes) {
      let template = templates.get(hole.site);
      if (template === undefined) {
        template = buildScrewTemplate(params, hole.site, totalHeightMm);
        templates.set(hole.site, template);
      }
      const cloned = unwrap(clone(template));
      try {
        cutters.push(translate(cloned, [hole.x, hole.y, 0]));
      } finally {
        cloned.delete();
      }
    }
  } catch (e) {
    for (const c of cutters) c.delete();
    throw e;
  } finally {
    for (const t of templates.values()) t.delete();
  }

  return cutters;
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
