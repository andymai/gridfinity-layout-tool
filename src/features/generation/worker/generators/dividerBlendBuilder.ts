/**
 * Divider-cutout blend builder for Gridfinity bins.
 *
 * Produces cut solids that trim compartment divider walls where they meet
 * outer-wall cutouts, creating aesthetically pleasing transitions:
 *
 * Case 1 — Divider end within cutout span: trim to match cutout profile
 * Case 2 — Divider end adjacent to cutout: straight-slope ramp (~45°)
 * Case 3 — Parallel divider visible through cutout: flat horizontal trim
 *
 * Standard (fused wall) bin style only — slotted bins are skipped.
 *
 * Sub-modules:
 *   - `dividerBlendTypes`     — interfaces, predicates, ramp-zone descriptor
 *   - `dividerBlendResolvers` — pure resolveOuterCutouts / collectDividers
 *   - `dividerBlendCuts`      — buildEndTrimCut / buildRampCut / buildParallelTrimCut
 */

import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { fuseAllOrNull } from './utils/shapeOps';
import { COPLANAR_MARGIN } from './generatorConstants';
import { interiorFilletCornerMm } from '@/shared/utils/interiorFillet';
import {
  type RampZone,
  MIN_DIM,
  dividerTouchesWall,
  getWallFaceInfo,
  isPerpendicular,
  isRampAdjacent,
  type DividerInfo,
  type OuterWallCutoutInfo,
} from './dividerBlendTypes';
import { collectDividers, resolveOuterCutouts } from './dividerBlendResolvers';
import {
  cutoutFrame,
  planEveryPathCut,
  wallCutoutPathsActive,
  type CutoutFrame,
  type DividerPathCut,
  type OuterSide,
} from './wallCutoutPaths';
import { buildEndTrimCut, buildParallelTrimCut, buildRampCut } from './dividerBlendCuts';
import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';

export type { RampZone } from './dividerBlendTypes';
export { resolveOuterCutouts, collectDividers } from './dividerBlendResolvers';

/**
 * Build all divider-cutout blend cuts.
 *
 * Returns a single fused cut solid (or null if no blending is needed).
 */
export function buildDividerBlends(params: BinParams, frame: CutoutFrame): Shape3D | null {
  if (params.style !== 'standard') return null;
  if (!params.walls.enabled) return null;

  const { innerW, innerD, wallHeight, collarHeight, hasLip } = frame;
  const cutouts = resolveOuterCutouts(params, innerW, innerD, wallHeight);
  if (cutouts.length === 0) return null;

  const dividers = collectDividers(params, innerW, innerD);
  if (dividers.length === 0) return null;

  const cutoutShape = params.walls.shape;
  const paths = wallCutoutPathsActive(params, frame);
  const lowered = paths ? pathLoweredEnds(planEveryPathCut(params, frame)) : [];
  const cuts: Shape3D[] = [];

  for (const divider of dividers) {
    for (const cutout of cutouts) {
      const perp = isPerpendicular(divider, cutout);

      if (paths) {
        // The path cuts every divider inside the span along its whole run.
        // Only a ramp beside the opening is left for the blend to make.
        if (
          perp &&
          dividerTouchesWall(divider, cutout) &&
          !loweredByPath(divider, cutout, lowered)
        ) {
          for (const cut of rampsBesidePath(divider, cutout, wallHeight)) cuts.push(cut);
        }
        continue;
      }

      if (perp && dividerTouchesWall(divider, cutout)) {
        // Divider's wall-local position along the cutout's span axis
        const dividerPos = divider.posAlongPerp;
        const halfThick = divider.thickness / 2;

        // Case 1: Divider fully inside the cutout span — trim the end flush.
        const insideSpan =
          dividerPos + halfThick <= cutout.cutRight + 0.01 &&
          dividerPos - halfThick >= cutout.cutLeft - 0.01;

        if (insideSpan) {
          try {
            const cut = buildEndTrimCut(
              divider,
              cutout,
              cutoutShape,
              wallHeight,
              collarHeight,
              hasLip
            );
            if (cut) cuts.push(cut);
          } catch {
            /* graceful degradation */
          }
        } else {
          // Case 2: Divider adjacent to (but outside) a cutout edge — ramp.
          // Guarded by `else` so that a divider exactly on the boundary (the
          // ±0.01 tolerance above) doesn't trigger BOTH an end-trim AND a
          // ramp cut — their solids overlap and subtracting the fused union
          // yields a different trim profile than either cut alone.
          const distToLeft = cutout.cutLeft - dividerPos;
          const distToRight = dividerPos - cutout.cutRight;

          if (isRampAdjacent(distToLeft, divider.thickness)) {
            try {
              const cut = buildRampCut(divider, cutout, wallHeight);
              if (cut) cuts.push(cut);
            } catch {
              /* graceful degradation */
            }
          }
          if (isRampAdjacent(distToRight, divider.thickness)) {
            try {
              const cut = buildRampCut(divider, cutout, wallHeight);
              if (cut) cuts.push(cut);
            } catch {
              /* graceful degradation */
            }
          }
        }
      } else if (!perp) {
        // Case 3: Parallel divider — flat horizontal trim.
        // Only trim dividers close enough to the wall to be visually exposed
        // through the cutout opening. Use cutout height as proximity threshold.
        const depthFromWall = Math.abs(divider.posAlongPerp - cutout.wallFaceCoord);
        if (depthFromWall < cutout.userCutHeight) {
          try {
            const cut = buildParallelTrimCut(divider, cutout);
            if (cut) cuts.push(cut);
          } catch {
            /* graceful degradation */
          }
        }
      }
    }
  }

  // fuseAllOrNull allocates a new WASM handle for the fused result (when
  // cuts.length > 1) but does not dispose its inputs. Free them explicitly
  // to match the leak-plugging pattern used across the other builders.
  const fused = fuseAllOrNull(cuts);
  if (cuts.length > 1) {
    for (const s of cuts) s.delete();
  }
  return fused;
}

/** A straight divider that a path lowers up to the path's own wall. */
export interface PathLoweredEnd {
  readonly side: OuterSide;
  /** Across the path: x for front and back, y for left and right. */
  readonly pos: number;
}

/**
 * The dividers each path lowers where they meet its wall. A ramp there would
 * cut below the lowered top, down to the opening's floor.
 */
export function pathLoweredEnds(cuts: readonly DividerPathCut[]): PathLoweredEnd[] {
  const out: PathLoweredEnd[] = [];
  for (const cut of cuts) {
    if (cut.kind !== 'lowered') continue;
    const { side } = cut.outer;
    const acrossX = side === 'front' || side === 'back';
    const rad = (cut.segment.rotateZ * Math.PI) / 180;
    const towardPlus = (acrossX ? Math.sin(rad) : Math.cos(rad)) > 0;
    const minEndOnWall = (side === 'front' || side === 'left') === towardPlus;
    if (!(minEndOnWall ? cut.wallAtMin : cut.wallAtMax)) continue;
    out.push({ side, pos: acrossX ? cut.segment.x : cut.segment.y });
  }
  return out;
}

/** Whether a path lowers this divider all the way to the cutout's wall. */
function loweredByPath(
  divider: DividerInfo,
  cutout: OuterWallCutoutInfo,
  lowered: readonly PathLoweredEnd[]
): boolean {
  return lowered.some(
    (end) => end.side === cutout.side && Math.abs(end.pos - divider.posAlongPerp) < 1e-6
  );
}

/**
 * Ramps for a divider that ends beside an opening carried through the bin.
 * A divider centred inside the span is in the path and drops along its whole
 * run, so only one centred outside it keeps its full height and its ramp.
 */
function rampsBesidePath(
  divider: DividerInfo,
  cutout: OuterWallCutoutInfo,
  wallHeight: number
): Shape3D[] {
  const out: Shape3D[] = [];
  for (const dist of [
    cutout.cutLeft - divider.posAlongPerp,
    divider.posAlongPerp - cutout.cutRight,
  ]) {
    if (dist < 0 || !isRampAdjacent(dist, divider.thickness)) continue;
    try {
      const cut = buildRampCut(divider, cutout, wallHeight);
      if (cut) out.push(cut);
    } catch {
      /* graceful degradation */
    }
  }
  return out;
}

// --- Ramp zone data for wall pattern clipping ---

/**
 * Pre-computed inputs shared across the 4 walls so we don't redundantly
 * call `collectDividers` / `resolveOuterCutouts` 8 times per generation.
 * Build once via `computeWallPatternInputs` and pass into the per-wall
 * functions below.
 */
export interface WallPatternInputs {
  readonly dividers: readonly DividerInfo[];
  readonly cutouts: readonly OuterWallCutoutInfo[];
  /** Dividers a path lowers to their wall, which take no ramp. */
  readonly pathLowered: readonly PathLoweredEnd[];
}

export function computeWallPatternInputs(params: BinParams, frame: CutoutFrame): WallPatternInputs {
  const { innerW, innerD, wallHeight } = frame;
  return {
    dividers: collectDividers(params, innerW, innerD),
    cutouts: resolveOuterCutouts(params, innerW, innerD, wallHeight),
    pathLowered: wallCutoutPathsActive(params, frame)
      ? pathLoweredEnds(planEveryPathCut(params, frame))
      : [],
  };
}

/**
 * Compute ramp zones that face a specific wall, for hex pattern clipping.
 *
 * Returns zones where ramp cuts exist on perpendicular dividers that touch
 * this wall. The pattern builder uses these to extend its clip region.
 *
 * Pre-computed `inputs` avoid redundant divider/cutout traversal when
 * called for all 4 walls in the same generation.
 */
export function computeRampZones(
  wallSide: 'front' | 'back' | 'left' | 'right',
  params: BinParams,
  frame: CutoutFrame,
  inputs: WallPatternInputs = computeWallPatternInputs(params, frame)
): RampZone[] {
  if (!params.walls.enabled || params.style !== 'standard') return [];

  const { dividers, cutouts, pathLowered } = inputs;
  if (dividers.length === 0) return [];

  const wallCutout = cutouts.find((c) => c.side === wallSide);
  if (!wallCutout) return [];

  const zones: RampZone[] = [];
  // Mirrors `buildDividerBlends`: a divider in the path has no ramp.
  const minDist = wallCutoutPathsActive(params, frame) ? 0 : -Infinity;

  for (const divider of dividers) {
    if (!isPerpendicular(divider, wallCutout)) continue;
    if (!dividerTouchesWall(divider, wallCutout)) continue;
    if (loweredByPath(divider, wallCutout, pathLowered)) continue;

    const dividerPos = divider.posAlongPerp;
    const distToLeft = wallCutout.cutLeft - dividerPos;
    const distToRight = dividerPos - wallCutout.cutRight;

    // Left-adjacent ramp
    if (distToLeft >= minDist && isRampAdjacent(distToLeft, divider.thickness)) {
      const rampLen = Math.min(wallCutout.userCutHeight, (divider.spanEnd - divider.spanStart) / 2);
      if (rampLen >= MIN_DIM) {
        zones.push({
          offsetAlongWall: dividerPos,
          width: divider.thickness + 2 * COPLANAR_MARGIN,
          height: wallCutout.userCutHeight,
        });
      }
    }

    // Right-adjacent ramp
    if (distToRight >= minDist && isRampAdjacent(distToRight, divider.thickness)) {
      const rampLen = Math.min(wallCutout.userCutHeight, (divider.spanEnd - divider.spanStart) / 2);
      if (rampLen >= MIN_DIM) {
        zones.push({
          offsetAlongWall: dividerPos,
          width: divider.thickness + 2 * COPLANAR_MARGIN,
          height: wallCutout.userCutHeight,
        });
      }
    }
  }

  return zones;
}

/**
 * Compute zones where perpendicular dividers meet a specific outer wall,
 * for blocking honeycomb pattern at the junction (full wall height).
 *
 * Unlike computeRampZones (which only produces zones near cutout edges),
 * this returns a zone for every perpendicular divider touching the wall,
 * regardless of whether a cutout exists. This ensures the hex pattern is
 * cleared where divider walls connect to the outer wall for structural
 * integrity (see).
 *
 * Pre-computed `inputs.dividers` avoids redundant traversal when called
 * for all 4 walls in the same generation.
 */
export function computeDividerJunctionZones(
  wallSide: 'front' | 'back' | 'left' | 'right',
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  inputs?: WallPatternInputs
): RampZone[] {
  // 'solid' intentionally included — junction blocking applies to any fused-wall style
  if (params.style === 'slotted') return [];

  const dividers = inputs?.dividers ?? collectDividers(params, innerW, innerD);
  if (dividers.length === 0) return [];

  const wall = getWallFaceInfo(wallSide, innerW, innerD);
  const zones: RampZone[] = [];

  for (const divider of dividers) {
    if (!isPerpendicular(divider, wall)) continue;
    if (!dividerTouchesWall(divider, wall)) continue;

    zones.push({
      offsetAlongWall: divider.posAlongPerp,
      // An interior fillet rounds the corner either side of the junction.
      width: divider.thickness + 2 * (COPLANAR_MARGIN + interiorFilletCornerMm(params)),
      height: wallHeight,
    });
  }

  return zones;
}

// --- FeatureBuilder protocol ---

export const dividerBlendFeature: FeatureBuilder = {
  name: 'dividerCutoutBlend',
  tag: FeatureTag.DIVIDER,
  target: 'cut',
  shouldBuild: (ctx) =>
    !ctx.dimensions.isSlotted &&
    ctx.params.walls.enabled &&
    new Set(ctx.params.compartments.cells).size > 1,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        // `v2`: with the paths on, the path cuts the dividers in the span.
        'v2',
        dim.shellKey,
        stableSerialize(params.walls),
        params.style,
        params.compartments.cols,
        params.compartments.rows,
        quantize(params.compartments.thickness),
        params.compartments.cells.join(','),
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.wallHeight),
        quantize(dim.collarHeight),
        dim.hasLip,
        // Tilted dividers are excluded from blends, so a tilt change alters
        // which junctions blend and must invalidate the cached cut.
        stableSerialize(params.compartments.dividerOverrides ?? []),
        quantize(interiorFilletCornerMm(params)),
        // Keyed on the solved answer: raised floors, the divider height and
        // the lip all decide which dividers a path lowers.
        wallCutoutPathsActive(params, dim)
          ? stableSerialize(pathLoweredEnds(planEveryPathCut(params, cutoutFrame(params, dim))))
          : 'none'
      )
    );
  },
  build: (ctx) => {
    const result = buildDividerBlends(ctx.params, cutoutFrame(ctx.params, ctx.dimensions));
    return result ? [result] : null;
  },
};
