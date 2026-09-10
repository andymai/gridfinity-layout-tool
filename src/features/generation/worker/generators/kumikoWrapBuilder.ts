/**
 * Kumiko wrapped-lattice wall pattern builder.
 *
 * Kumiko patterns are authored in unrolled (u, z) coordinates — u is arc
 * length along the OUTER wall perimeter (a closed loop), z is height within
 * the pattern band — and mapped back onto the bin as one continuous lattice
 * that bends around the rounded corners:
 *
 *   - Flat wall spans: 2D cut region (slab − stroked struts) extruded through
 *     the wall, placed with the stamp-pattern transform chain.
 *   - Corner arcs (exact kernels only): annular wedge minus strut solids —
 *     vertical struts as small-angle revolves, near-horizontal struts as thin
 *     partial revolves, rising diagonals swept along a helix (a straight
 *     line in unrolled space IS a helix on the corner cylinder), falling
 *     diagonals as chord-box chains (see the falling-diagonal branch).
 *
 * Mesh kernels (Manifold drafts) can't sweep along a helix, so the corner
 * cutters are skipped there: drafts show the phase-aligned flat panels with
 * solid corners, and the exact OCCT result replaces them. Exports always run
 * the exact path.
 *
 * PR-1 scope: rectangular bins only. Polygon (cellMask) footprints and
 * slotted bins render solid walls for kumiko patterns; the stamp patterns
 * still cover those — tracked as a follow-up.
 */

import { translate, unwrap, clone, getKernelCapabilities } from 'brepjs';
import type { Shape3D } from 'brepjs';

import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_PATTERN_SCALE } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { resolveWallLabelSlots } from '@/shared/utils/wallLabelSlotPlan';
import type { PipelineContext } from './pipeline/types';
import type { WallPatternDescriptor } from './wallPatterns';
import { getSlotFreeWalls, TOP_KEEP_OUT, BOTTOM_SOLID_SKIRT } from './wallPatterns';
import { resolveWallPatternSides } from '@/shared/utils/wallPatternSides';
import { getPatternCalculator, isWrappedLatticeCalculator, PATTERN_REGISTRY } from './patterns';
import type { WrappedLatticeCalculator } from './patterns';
import { BOX_CORNER_RADIUS } from './generatorConstants';
import { buildCacheKey, quantize, compactKey } from './cacheKeyUtils';
import { checkCancelled } from './utils/abort';
import { getFeatureCache, setFeatureCache } from './shapeCache';
import { applyWallPatternClips } from './wallPatternClips';
import { computeWallClipContext, computeWallClips } from './wallPatternBuilder';
import { KUMIKO_WRAP_BASE_CACHE, KUMIKO_WRAP_CLIPPED_CACHE } from './wallPatternTypes';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import { computePerimeterLayout } from './kumikoPerimeter';
import type { WallSide, PerimeterSlab } from './kumikoPerimeter';
export { resolveKumikoPerimeter } from './kumikoPerimeter';
export type { FlatSlab } from './kumikoPerimeter';
export { strokeFootprint, partitionDisjoint } from './kumikoSegments';
export type { FootprintBox, BoxedTool } from './kumikoSegments';
import { buildFlatSlabCutter, flatWindows } from './kumikoFlatSlab';
export { buildFlatSlabCutter, flatWindows } from './kumikoFlatSlab';
import { buildCornerSlabCutter } from './kumikoCornerSlab';

/**
 * Build one flat wall slab's cutter: slab box minus fused strut prisms,
 * placed with the stamp transform chain.
 *
 * The subtraction happens in 3D (OCCT) rather than via Drawing 2D booleans:
 * lattice struts share vertices, and the resulting exact vertex-on-edge
 * coincidences reliably break the JS blueprint boolean path
 * (POINT_NOT_ON_CURVE). OCCT's fuzzy-tolerance booleans absorb them.
 *
 * Returns null when the slab has no struts at all — an empty lattice must
 * degrade to solid walls, not cut the whole wall away.
 */
/**
 * Build one flat wall slab's cutter: slab box minus strut prisms, placed with
 * the stamp transform chain.
 *
 * The subtraction happens in 3D (OCCT) rather than via Drawing 2D booleans:
 * lattice struts share vertices, and the resulting exact vertex-on-edge
 * coincidences reliably break the JS blueprint boolean path
 * (POINT_NOT_ON_CURVE). OCCT's fuzzy-tolerance booleans absorb them.
 *
 * Returns null when the slab has no struts at all — an empty lattice must
 * degrade to solid walls, not cut the whole wall away.
 */

/** Stamp-convention wall descriptor used to position clip boxes. */
function clipDescriptorFor(
  side: WallSide,
  innerW: number,
  innerD: number,
  patternCenterZ: number
): WallPatternDescriptor {
  const table: Record<WallSide, { tx: number; ty: number; rot?: number; span: number }> = {
    front: { tx: 0, ty: -innerD / 2, span: innerW },
    back: { tx: 0, ty: innerD / 2, rot: 180, span: innerW },
    left: { tx: -innerW / 2, ty: 0, rot: 90, span: innerD },
    right: { tx: innerW / 2, ty: 0, rot: -90, span: innerD },
  };
  const t = table[side];
  return {
    side,
    centers: [{ x: 0, y: 0 }],
    translateX: t.tx,
    translateY: t.ty,
    translateZ: patternCenterZ,
    zRotation: t.rot,
    wallSpan: t.span,
    allowClip: true,
  };
}

/** Resolve the wrapped-lattice calculator for the current params, if any. */
export function resolveKumikoCalculator(params: BinParams): WrappedLatticeCalculator | null {
  const wallPattern = params.wallPattern as typeof params.wallPattern | undefined;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for old saved data
  if (!wallPattern?.enabled || wallPattern.pattern === undefined) return null;
  if (!(wallPattern.pattern in PATTERN_REGISTRY)) return null;
  const scale = wallPattern.scale ?? DEFAULT_PATTERN_SCALE;
  const calculator = getPatternCalculator(wallPattern.pattern, params.height, scale);
  return isWrappedLatticeCalculator(calculator) ? calculator : null;
}

/**
 * Wrapped kumiko cut targets plus the geometry identity of the whole set.
 *
 * `key` is empty when no kumiko cut applies, and otherwise fully identifies the
 * returned shapes: it composes the per-wall cache key the cutters are stored
 * under (which already captures the lattice, perimeter, selected sides and every
 * wall clip) with the post-cache interior offset. The resume cache in
 * `booleanStage` keys on this so a patterned bin can skip the whole boolean
 * stage on an edit that leaves the cut set unchanged.
 */
export interface KumikoWallPatternResult {
  readonly shapes: Shape3D[];
  readonly key: string;
}

/**
 * Build the wrapped kumiko pattern cut targets for the whole perimeter.
 * `shapes` is empty (and `key` blank) when no wrapped-lattice pattern applies
 * (stamp patterns and solid walls take the other paths).
 */
export function buildKumikoWallPatterns(ctx: PipelineContext): KumikoWallPatternResult {
  const { params, dimensions: dim, signal, originToTag, perfCollector } = ctx;
  const { innerW, innerD, innerOffsetX, innerOffsetY } = dim;
  const NONE: KumikoWallPatternResult = { shapes: [], key: '' };

  const calculator = resolveKumikoCalculator(params);
  if (!calculator) return NONE;

  // PR-1 scope: the wrap needs the rectangular perimeter; polygon footprints
  // and slotted walls fall back to solid walls for kumiko patterns.
  if (isPartialMask(params.cellMask)) return NONE;
  const slotFree = getSlotFreeWalls(params);
  if (!slotFree.front || !slotFree.back || !slotFree.left || !slotFree.right) return NONE;
  // The slot keep-out reaches the corner slabs, whose curved cutters do not
  // survive the box cut as closed solids; the stamp patterns take it instead.
  if (resolveWallLabelSlots(params).enabled) return NONE;

  const wallThickness = params.wallThickness;
  const bottomKeepOut = wallThickness + BOTTOM_SOLID_SKIRT;
  const patternHeight = dim.interiorHeight - TOP_KEEP_OUT - bottomKeepOut;
  if (patternHeight < calculator.getMinPatternHeight()) return NONE;

  const outerW = innerW + 2 * wallThickness;
  const outerD = innerD + 2 * wallThickness;
  const cornerRadius = Math.min(BOX_CORNER_RADIUS, Math.min(outerW, outerD) / 2 - 0.1);
  if (cornerRadius <= 0.2) return NONE;

  const layout = computePerimeterLayout(outerW, outerD, innerW, innerD, cornerRadius);
  const lattice = calculator.getLattice({
    perimeter: layout.perimeter,
    bandHeight: patternHeight,
  });
  if (lattice.segments.length === 0) return NONE;

  const bandZ0 = bottomKeepOut;
  const patternCenterZ = bottomKeepOut + patternHeight / 2;
  const cutDepth = wallThickness * 4;
  const exact = getKernelCapabilities().exact;
  const patternType = calculator.getPatternType();
  const shapeRadius = calculator.getShapeRadius();

  const wallSides: readonly WallSide[] = ['front', 'right', 'back', 'left'];

  // Per-side selection. The lattice itself still spans the whole
  // perimeter — only which slabs get cut changes — so an unselected wall does
  // not shift the columns on the walls that stay patterned.
  const chosen = resolveWallPatternSides(params.wallPattern);
  const sideMask = wallSides.map((s) => (chosen[s] ? '1' : '0')).join('');

  const baseKey = compactKey(
    buildCacheKey(
      'kumiko-v1',
      patternType,
      sideMask,
      quantize(layout.perimeter),
      quantize(patternHeight),
      quantize(lattice.columnPitch),
      quantize(lattice.strutWidth),
      quantize(wallThickness),
      quantize(cornerRadius),
      quantize(outerW),
      quantize(outerD),
      quantize(patternCenterZ),
      exact ? 'wrap' : 'flat'
    )
  );

  const clipCtx = computeWallClipContext(params, dim, cutDepth);
  const wallClips = wallSides.map((side) => ({
    side,
    descriptor: clipDescriptorFor(side, innerW, innerD, patternCenterZ),
    clips: computeWallClips(
      params,
      dim,
      clipCtx,
      { side, wallSpan: side === 'front' || side === 'back' ? innerW : innerD, allowClip: true },
      shapeRadius
    ),
  }));

  const clippedKey = compactKey(
    buildCacheKey('v1', baseKey, ...wallClips.map((wc) => wc.clips.keyPart))
  );

  // Resume identity for the whole cut set: the per-wall cache key (lattice +
  // sides + clips) plus the interior offset applied after the cache. The cutter
  // count is deterministic from the layout the cache key already captures, so
  // this key changes whenever the emitted shapes would.
  const resumeKey = compactKey(
    buildCacheKey(clippedKey, 'off', quantize(innerOffsetX), quantize(innerOffsetY))
  );

  // The cutters stay SEPARATE all the way into the final pattern-cut boolean:
  // handing OCCT one whole-perimeter compound forces it to treat the tool set
  // as a single operand, defeating its per-tool bounding-box pruning (measured
  // 2.5× slower on the final cut). Cutter count is deterministic from the
  // layout, so both caches store one entry per slab index.
  // A corner needs BOTH its walls selected: cutting it while one neighbour
  // stays solid would leave the arc's struts landing on solid wall with nothing
  // to continue into. Leaving it solid is the same shape the draft kernel
  // already produces (corners are exact-only), so it's a proven-safe omission.
  const slabSelected = (s: PerimeterSlab): boolean =>
    s.kind === 'flat' ? chosen[s.side] : chosen[s.prevSide] && chosen[s.nextSide];
  const activeSlabs = layout.slabs.filter((s) => (s.kind === 'flat' || exact) && slabSelected(s));
  if (activeSlabs.length === 0) return NONE;
  // One planned cutter per flat window / corner — the plan is deterministic
  // from layout + lattice, so cache entries index it directly.
  const plan: Array<{ slab: PerimeterSlab; windowA: number; windowB: number }> = [];
  for (const slab of activeSlabs) {
    if (slab.kind === 'flat') {
      for (const [wa, wb] of flatWindows(slab, lattice)) {
        plan.push({ slab, windowA: wa, windowB: wb });
      }
    } else {
      plan.push({ slab, windowA: slab.u0, windowB: slab.u1 });
    }
  }
  const cacheGetAll = (cacheName: string, key: string): Shape3D[] | null => {
    const shapes: Shape3D[] = [];
    for (let i = 0; i < plan.length; i++) {
      const hit = getFeatureCache(cacheName, `${key}#${i}`);
      if (!hit) {
        for (const s of shapes) s.delete();
        return null;
      }
      shapes.push(hit);
    }
    return shapes;
  };
  const cacheSetAll = (cacheName: string, key: string, shapes: Shape3D[]): Shape3D[] => {
    return shapes.map((s, i) => {
      setFeatureCache(cacheName, `${key}#${i}`, s);
      return unwrap(clone(s));
    });
  };

  // Which walls' clip boxes can reach each slab: a flat sees its own wall's
  // clips; a corner sees both adjacent walls' (a full-width cutout border can
  // spill past the wall end into the corner region).
  const clipSidesFor = (slab: PerimeterSlab): readonly WallSide[] =>
    slab.kind === 'flat' ? [slab.side] : [slab.prevSide, slab.nextSide];
  const hasClips = (side: WallSide): boolean => {
    const wc = wallClips.find((w) => w.side === side);
    return (
      !!wc &&
      (wc.clips.clip !== null ||
        wc.clips.handleClip !== null ||
        wc.clips.rampClip !== null ||
        wc.clips.textClip !== null ||
        // Without this a bin whose ONLY clip is the sliding-tray keep-out
        // skips the clipping pass altogether and the pattern eats the rail.
        wc.clips.slideClip !== null)
    );
  };
  const anyClips = wallSides.some(hasClips);

  const buildStart = perfCollector ? performance.now() : 0;
  let shapes = anyClips ? cacheGetAll(KUMIKO_WRAP_CLIPPED_CACHE, clippedKey) : null;
  const cacheHit = shapes !== null;
  if (!shapes) {
    let baseShapes = cacheGetAll(KUMIKO_WRAP_BASE_CACHE, baseKey);
    if (!baseShapes) {
      const cutters: Shape3D[] = [];
      for (const entry of plan) {
        checkCancelled(signal);
        const slabStart = perfCollector ? performance.now() : 0;
        if (entry.slab.kind === 'flat') {
          const cutter = buildFlatSlabCutter(
            entry.slab,
            lattice,
            bandZ0,
            patternHeight,
            cutDepth,
            patternCenterZ,
            layout.perimeter,
            entry.windowA,
            entry.windowB
          );
          if (!cutter) {
            for (const c of cutters) c.delete();
            return NONE;
          }
          cutters.push(cutter);
          if (perfCollector) {
            perfCollector.recordWallPatternSubstep(
              `kumiko_flat_${entry.slab.side}`,
              performance.now() - slabStart
            );
          }
        } else {
          cutters.push(
            buildCornerSlabCutter(
              entry.slab,
              lattice,
              bandZ0,
              patternHeight,
              layout.cornerRadius,
              wallThickness,
              layout.perimeter,
              perfCollector
            )
          );
          if (perfCollector) {
            perfCollector.recordWallPatternSubstep('kumiko_corner', performance.now() - slabStart);
          }
        }
      }
      baseShapes = cacheSetAll(KUMIKO_WRAP_BASE_CACHE, baseKey, cutters);
    }

    // Route each wall's clip boxes to the cutters they can reach. Clip boxes
    // are positioned in world space, so applyWallPatternClips works per
    // cutter; slabs out of a box's reach cost one cheap disjoint-bbox cut.
    shapes = baseShapes;
    if (anyClips) {
      const clipped: Shape3D[] = [];
      let failed = false;
      for (let i = 0; i < baseShapes.length; i++) {
        let current: Shape3D | null = baseShapes[i];
        for (const side of clipSidesFor(plan[i].slab)) {
          if (!current || !hasClips(side)) continue;
          checkCancelled(signal);
          const wc = wallClips.find((w) => w.side === side);
          if (!wc) continue;
          current = applyWallPatternClips(
            current,
            wc.descriptor,
            wc.clips.clip,
            wc.clips.handleClip,
            wc.clips.rampClip,
            wc.clips.textClip,
            wc.clips.slideClip,
            wc.clips.labelSlotClip
          );
        }
        if (!current) {
          failed = true;
          break;
        }
        clipped.push(current);
      }
      if (failed) {
        for (const s of clipped) s.delete();
        return NONE;
      }
      shapes = cacheSetAll(KUMIKO_WRAP_CLIPPED_CACHE, clippedKey, clipped);
    }
  }
  if (perfCollector) {
    perfCollector.recordWallPatternSubstep(
      cacheHit ? 'kumiko_hit' : 'kumiko_build',
      performance.now() - buildStart,
      lattice.segments.length
    );
    perfCollector.setPatternCutToolCount(shapes.length);
  }

  const placedShapes = shapes.map((cutter) => {
    let placed = cutter;
    if (innerOffsetX !== 0 || innerOffsetY !== 0) {
      const old = placed;
      placed = translate(old, [innerOffsetX, innerOffsetY, 0]);
      old.delete();
    }
    collectOrigins(placed, FeatureTag.WALL_PATTERN, originToTag);
    return placed;
  });
  return { shapes: placedShapes, key: resumeKey };
}
