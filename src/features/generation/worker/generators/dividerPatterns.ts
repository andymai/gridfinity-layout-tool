/**
 * Compartment divider wall pattern placement.
 *
 * Pure data module — resolves which interior dividers carry a wall pattern,
 * the band each one offers, and the keep-out zones where it must stay solid.
 * No brepjs imports; `dividerPatternBuilder` turns this into geometry.
 *
 * Each divider is described in its OWN frame: `u` runs along the wall with
 * u = 0 at its midpoint, `z` is height above the interior floor. The builder
 * emits geometry in that frame and applies one rigid placement transform at
 * the end, so a straight and a tilted divider of the same span share geometry
 * (and therefore a cache entry).
 *
 * Keep-outs are resolved by projecting each intruding feature's world-space
 * footprint onto the divider centerline, which handles tilted dividers with
 * the same code path as straight ones.
 */

import type { BinParams } from '@/shared/types/bin';
import { compartmentHasTiltedEdge, isRectangularCompartment } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import {
  computeInteriorHeight,
  scoopFrameHeights,
  computeLipOffset,
  resolveScoopProfile,
} from '@/shared/utils/scoopCalculations';
import { labelLipReservationMm, resolveLabelShelfTopMm } from '@/shared/constants/labelPlates';
import { labelShelfKeepoutMm } from '@/shared/utils/lidInteriorRelief';
import { findCompartmentBounds, interiorDividerSegments } from './compartmentBuilder';
import type { InteriorDividerSegment } from './compartmentBuilder';
import { BOTTOM_SOLID_SKIRT, CUTOUT_BORDER_WIDTH, TOP_KEEP_OUT } from './wallPatterns';
import { LIP_SMALL_TAPER, LIP_TAPER_WIDTH } from './generatorConstants';
import type { BinDimensions } from './pipeline/types';

/**
 * Below this (mm) a divider is treated as parallel to a keep-out box edge.
 * Sized well above trig dust (~1e-15 at bin scale) and far below any real
 * divider extent, so it can only ever catch the degenerate case.
 */
const PARALLEL_EPSILON = 1e-9;

/** A rectangle in a divider's local (u, z) frame that must stay solid. */
export interface DividerKeepOut {
  readonly uMin: number;
  readonly uMax: number;
  readonly zMin: number;
  readonly zMax: number;
}

/**
 * The minimum a panel builder needs: how much span it may fill and where it
 * must stay solid. Shared with the removable-piece path (`dividerPiecePatterns`),
 * which has the same 2D problem in a different print frame.
 */
export interface PatternPanelSpec {
  /** Span the pattern may occupy, centred on the panel. */
  readonly patternSpan: number;
  readonly keepOuts: readonly DividerKeepOut[];
}

/** One patternable divider: placement, usable span, and its keep-outs. */
export interface DividerPatternTarget extends PatternPanelSpec {
  /** Centerline midpoint in bin-centered mm. */
  readonly x: number;
  readonly y: number;
  /** In-plane rotation (deg) aligned to the wall — 90 for column dividers. */
  readonly rotateZ: number;
  /** True length along the (possibly tilted) wall. */
  readonly wallLen: number;
}

/** Resolved divider-pattern layout for a bin. */
export interface DividerPatternPlan {
  readonly targets: readonly DividerPatternTarget[];
  /** Bottom of the pattern band, above the interior floor (mm). */
  readonly bandZ0: number;
  readonly bandHeight: number;
  /** Divider wall thickness (mm) — the depth the pattern cuts through. */
  readonly thickness: number;
}

/** A world-space axis-aligned keep-out volume contributed by a feature. */
export interface WorldKeepOut {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly zMin: number;
  readonly zMax: number;
}

/**
 * Whether the divider-pattern feature applies at all. Slotted bins take the
 * removable-piece path (their dividers aren't part of the bin body) and
 * polygon footprints have dividers filtered out of the feature pipeline.
 */
export function dividerPatternsApply(params: BinParams, dim: BinDimensions): boolean {
  const wallPattern = params.wallPattern as typeof params.wallPattern | undefined;
  if (!wallPattern?.enabled || wallPattern.dividers !== true) return false;
  if (dim.solid || dim.isSlotted) return false;
  if (isPartialMask(params.cellMask)) return false;
  return params.compartments.thickness > 0;
}

/**
 * Clip a divider centerline against a world-space box footprint, returning the
 * covered range in the divider's local u coordinate (null when disjoint).
 *
 * Liang-Barsky against the box's XY rect: the divider is parameterised as
 * `p(t) = mid + (t − 0.5)·len·dir` for t ∈ [0, 1].
 */
function projectFootprint(
  seg: DividerPatternTarget | InteriorDividerSegment,
  box: WorldKeepOut
): { uMin: number; uMax: number } | null {
  const rad = (seg.rotateZ * Math.PI) / 180;
  const dx = Math.cos(rad) * seg.wallLen;
  const dy = Math.sin(rad) * seg.wallLen;
  const x0 = seg.x - dx / 2;
  const y0 = seg.y - dy / 2;

  let t0 = 0;
  let t1 = 1;
  const edges: ReadonlyArray<readonly [number, number]> = [
    [-dx, x0 - box.xMin],
    [dx, box.xMax - x0],
    [-dy, y0 - box.yMin],
    [dy, box.yMax - y0],
  ];
  for (const [p, q] of edges) {
    // Epsilon, not `p === 0`: every divider is axis-aligned in practice, and
    // `Math.cos(90°)` is 6.1e-17 rather than 0, so the parallel branch would
    // never be taken. Dividing by that dust turns a coincident box edge (a
    // scoop footprint starts exactly ON the compartment boundary, i.e. on the
    // divider line) into a garbage finite ratio that truncates the keep-out.
    if (Math.abs(p) < PARALLEL_EPSILON) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  if (t1 <= t0) return null;
  return { uMin: (t0 - 0.5) * seg.wallLen, uMax: (t1 - 0.5) * seg.wallLen };
}

/**
 * Scoop ramp footprints in world space.
 *
 * Mirrors `scoopRampBuilder`: one ramp per compartment, spanning the
 * compartment's full width at its front edge, reaching `lipOffset + run` back
 * from that edge and rising to the profile height.
 *
 * Coordinates are in the INTERIOR frame (centred on the cavity), so a caller
 * working in bin coordinates must add `innerOffsetX/Y`. Shared with the floor
 * pattern, whose holes must not undercut a ramp's foot either.
 */
export function scoopKeepOuts(params: BinParams, dim: BinDimensions): WorldKeepOut[] {
  if (!params.scoop.enabled) return [];
  const { innerW, innerD, wallHeight, hasLip, floorThickness } = dim;
  const { cols, rows, cells } = params.compartments;
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const frame = scoopFrameHeights(
    wallHeight,
    computeInteriorHeight(wallHeight, hasLip, LIP_SMALL_TAPER),
    floorThickness
  );

  const out: WorldKeepOut[] = [];
  const seen = new Set<number>();
  for (const compId of cells) {
    if (seen.has(compId)) continue;
    seen.add(compId);
    if (compartmentHasTiltedEdge(params.compartments, compId)) continue;
    // Same two gates the ramp builder applies, or this reserves space for a
    // scoop that is never built.
    if (!isRectangularCompartment(params.compartments, compId)) continue;
    const bounds = findCompartmentBounds(compId, cols, rows, cells);
    if (!bounds) continue;
    const { minCol, maxCol, minRow } = bounds;
    const compW = (maxCol - minCol + 1) * cellW;
    const compD = (bounds.maxRow - minRow + 1) * cellD;
    const isMinRow = minRow === 0;
    const lipOffset = computeLipOffset(hasLip, isMinRow, LIP_TAPER_WIDTH, params.wallThickness);
    const profile = resolveScoopProfile(
      params.scoop,
      compW,
      compD,
      isMinRow,
      hasLip,
      frame.wallHeight,
      frame.interiorHeight,
      lipOffset
    );
    if (!profile) continue;
    const centerX = -innerW / 2 + (minCol + (maxCol - minCol + 1) / 2) * cellW;
    const frontY = -innerD / 2 + minRow * cellD;
    out.push({
      xMin: centerX - compW / 2,
      xMax: centerX + compW / 2,
      yMin: frontY,
      yMax: frontY + lipOffset + profile.run,
      zMin: floorThickness,
      zMax: floorThickness + profile.height,
    });
  }
  return out;
}

/**
 * Label tab footprints in world space.
 *
 * X is deliberately the compartment's FULL width rather than the tab's placed
 * span: clearing more pattern than the tab occupies is the safe direction,
 * since a shelf or gusset landing on a perforated divider has nothing to bond
 * to. Y is NOT approximated — it has to track `inset` and the anchor edge, or
 * the box misses the tab body entirely and the feature does nothing.
 */
function labelTabKeepOuts(params: BinParams, dim: BinDimensions): WorldKeepOut[] {
  if (!params.label.enabled) return [];
  const { innerW, innerD, interiorHeight } = dim;
  const tabDepth = params.label.depth;
  if (tabDepth <= 0 || tabDepth >= innerD) return [];
  const shelfTopZ = resolveLabelShelfTopMm(
    interiorHeight,
    params.base.stackingLip,
    params.label,
    labelShelfKeepoutMm(params)
  );
  const zMin = shelfTopZ - tabDepth;
  if (zMin <= 0 || shelfTopZ > interiorHeight) return [];
  // The lip rises above the shelf, so the keep-out must reach the rim
  // top or a perforated divider could punch a hole into the lip's Z band.
  const zMax = shelfTopZ + labelLipReservationMm(params.label);

  const { cols, rows, cells } = params.compartments;
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const edges = params.label.edges ?? 'back';
  const wantBack = edges === 'back' || edges === 'both';
  const wantFront = edges === 'front' || edges === 'both';
  // Slides the body inward from its anchor wall. Without it the box
  // stays pinned to the wall while the tab has moved off it.
  const inset = params.label.inset ?? 0;

  const out: WorldKeepOut[] = [];
  const seen = new Set<number>();
  for (const compId of cells) {
    if (seen.has(compId)) continue;
    seen.add(compId);
    const bounds = findCompartmentBounds(compId, cols, rows, cells);
    if (!bounds) continue;
    const { minCol, maxCol, minRow, maxRow } = bounds;
    const xMin = -innerW / 2 + minCol * cellW;
    const xMax = -innerW / 2 + (maxCol + 1) * cellW;
    if (wantBack) {
      const backY = -innerD / 2 + (maxRow + 1) * cellD - inset;
      out.push({ xMin, xMax, yMin: backY - tabDepth, yMax: backY, zMin, zMax });
    }
    if (wantFront) {
      const frontY = -innerD / 2 + minRow * cellD + inset;
      out.push({ xMin, xMax, yMin: frontY, yMax: frontY + tabDepth, zMin, zMax });
    }
  }
  return out;
}

/** Where a divider crosses another divider, expanded by the solid border. */
function crossingKeepOuts(
  seg: InteriorDividerSegment,
  others: readonly InteriorDividerSegment[],
  thickness: number,
  border: number,
  bandTop: number
): DividerKeepOut[] {
  const half = thickness / 2 + border;
  const out: DividerKeepOut[] = [];
  for (const other of others) {
    if (other === seg) continue;
    const box = footprintOf(other, thickness);
    const hit = projectFootprint(seg, box);
    if (!hit) continue;
    out.push({
      uMin: hit.uMin - half,
      uMax: hit.uMax + half,
      zMin: 0,
      zMax: bandTop,
    });
  }
  return out;
}

/** World-space AABB of a divider wall, used to detect crossings. */
function footprintOf(seg: InteriorDividerSegment, thickness: number): WorldKeepOut {
  const rad = (seg.rotateZ * Math.PI) / 180;
  const halfX =
    Math.abs(Math.cos(rad)) * (seg.wallLen / 2) + Math.abs(Math.sin(rad)) * (thickness / 2);
  const halfY =
    Math.abs(Math.sin(rad)) * (seg.wallLen / 2) + Math.abs(Math.cos(rad)) * (thickness / 2);
  return {
    xMin: seg.x - halfX,
    xMax: seg.x + halfX,
    yMin: seg.y - halfY,
    yMax: seg.y + halfY,
    zMin: 0,
    zMax: Number.POSITIVE_INFINITY,
  };
}

/**
 * Resolve the divider pattern layout, or null when nothing can be patterned.
 *
 * `border` is the solid margin held around every junction and intruding
 * feature. Callers pass `max(CUTOUT_BORDER_WIDTH, patternShapeRadius)` so a
 * bold element can't bleed past its keep-out — the same rule the outer walls
 * use for divider junction zones.
 */
export function planDividerPatterns(
  params: BinParams,
  dim: BinDimensions,
  border: number = CUTOUT_BORDER_WIDTH
): DividerPatternPlan | null {
  if (!dividerPatternsApply(params, dim)) return null;

  const { innerW, innerD, interiorHeight } = dim;
  if (innerW <= 0 || innerD <= 0) return null;

  const thickness = params.compartments.thickness;
  const dividerHeight = resolveCompartmentDividerHeight(
    params.compartments.dividerHeight,
    interiorHeight
  );

  // Same band rule as the outer walls: one wallThickness clears the floor slab
  // and BOTTOM_SOLID_SKIRT is the band the lowest element row anchors to.
  // Re-fitted to the divider's own height, so a shortened divider keeps whole
  // elements instead of a sliced top row.
  const bandZ0 = params.wallThickness + BOTTOM_SOLID_SKIRT;
  const bandHeight = dividerHeight - TOP_KEEP_OUT - bandZ0;
  if (bandHeight <= 0) return null;
  const bandTop = bandZ0 + bandHeight;

  const segments = interiorDividerSegments(params, innerW, innerD, dividerHeight).filter(
    // A pattern is cut into the wall FACE, which a lean turns into a
    // non-vertical plane the cutter cannot follow.
    (seg) => seg.leanDeg === 0
  );
  if (segments.length === 0) return null;

  const worldKeepOuts = [...scoopKeepOuts(params, dim), ...labelTabKeepOuts(params, dim)];
  const interiorCutout =
    params.walls.enabled && params.walls.interior.enabled ? params.walls.interior : null;
  const interiorCutHeight = dim.wallHeight - params.wallThickness;

  const targets: DividerPatternTarget[] = [];
  for (const seg of segments) {
    const patternSpan = seg.wallLen - 2 * border;
    if (patternSpan <= 0) continue;

    const keepOuts: DividerKeepOut[] = crossingKeepOuts(seg, segments, thickness, border, bandTop);

    for (const box of worldKeepOuts) {
      const hit = projectFootprint(seg, box);
      if (!hit) continue;
      keepOuts.push({
        uMin: hit.uMin - border,
        uMax: hit.uMax + border,
        zMin: box.zMin - border,
        zMax: box.zMax + border,
      });
    }

    // Interior divider cutouts open from the divider's top edge; clear the
    // window plus its border so no element straddles the cut boundary.
    if (interiorCutout) {
      const cutW =
        interiorCutout.widthMm !== null
          ? Math.min(interiorCutout.widthMm, seg.wallLen)
          : seg.wallLen * (interiorCutout.width / 100);
      const cutH = interiorCutHeight * (interiorCutout.depth / 100);
      if (cutW >= 0.1 && cutH >= 0.1) {
        const centerOffset = computeCutoutCenter(
          seg.wallLen,
          cutW,
          params.wallThickness,
          interiorCutout.alignment,
          interiorCutout.offset
        );
        keepOuts.push({
          uMin: centerOffset - cutW / 2 - border,
          uMax: centerOffset + cutW / 2 + border,
          zMin: bandTop - cutH - border,
          zMax: bandTop,
        });
      }
    }

    targets.push({
      x: seg.x,
      y: seg.y,
      rotateZ: seg.rotateZ,
      wallLen: seg.wallLen,
      patternSpan,
      keepOuts,
    });
  }

  return targets.length > 0 ? { targets, bandZ0, bandHeight, thickness } : null;
}

/**
 * Widest clear run left on a divider after its keep-outs, at the band's
 * mid-height. Drives the UI's "some dividers are too small" note without
 * duplicating the element-fitting math — the caller compares it against the
 * pattern's minimum element footprint.
 */
export function widestClearRun(
  target: DividerPatternTarget,
  bandZ0: number,
  bandHeight: number
): number {
  const midZ = bandZ0 + bandHeight / 2;
  const half = target.patternSpan / 2;
  const blocking = target.keepOuts
    .filter((k) => k.zMin <= midZ && k.zMax >= midZ)
    .map((k) => ({ uMin: Math.max(k.uMin, -half), uMax: Math.min(k.uMax, half) }))
    .filter((k) => k.uMax > k.uMin)
    .sort((a, b) => a.uMin - b.uMin);

  let widest = 0;
  let cursor = -half;
  for (const k of blocking) {
    if (k.uMin > cursor) widest = Math.max(widest, k.uMin - cursor);
    cursor = Math.max(cursor, k.uMax);
  }
  return Math.max(widest, half - cursor);
}
