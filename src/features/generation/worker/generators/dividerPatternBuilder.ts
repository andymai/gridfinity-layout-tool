/**
 * Compartment divider wall pattern geometry.
 *
 * Carries the outer walls' pattern through the interior divider walls so a
 * patterned bin doesn't read as hollow walls around solid dividers.
 *
 * Every panel is built in the divider's LOCAL frame — u along X, band height
 * along Z (0 = band centre), thickness along Y — and placed with a single
 * rotate-about-Z + translate at the end. Two dividers with the same span and
 * keep-outs therefore produce identical local geometry and share a cache entry
 * regardless of where (or at what tilt) they sit in the bin.
 *
 * Keep-outs are honoured differently per pipeline, deliberately:
 *   - stamp patterns drop whole ELEMENTS whose footprint touches a keep-out,
 *     so no half-hex knife edge is ever emitted and no boolean is needed;
 *   - kumiko lattices are continuous, so their panels are cut by keep-out
 *     boxes after the fact.
 */

import { box, clone, cut, rotate, translate, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { PipelineContext } from './pipeline/types';
import type { WallPatternDescriptor } from './wallPatterns';
import { CUTOUT_BORDER_WIDTH } from './wallPatterns';
import type { PatternCenter, StampPatternCalculator } from './patterns';
import {
  getPatternCalculator,
  isStampCalculator,
  PATTERN_REGISTRY,
  shapeDescriptorKey,
} from './patterns';
import { DEFAULT_PATTERN_SCALE } from '@/shared/types/bin';
import type { BinParams, WallPatternType } from '@/shared/types/bin';
import { buildCacheKey, compactKey, quantize } from './cacheKeyUtils';
import { checkCancelled } from './utils/abort';
import { getFeatureCache, setFeatureCache } from './shapeCache';
import { buildWallPatternCompound } from './wallPatternCompound';
import { buildShapeTemplate } from './wallPatternBuilder';
import {
  buildFlatSlabCutter,
  flatWindows,
  resolveKumikoCalculator,
  resolveKumikoPerimeter,
} from './kumikoWrapBuilder';
import type { FlatSlab } from './kumikoWrapBuilder';
import { fuseAllOrNull } from './utils/shapeOps';
import { planDividerPatterns } from './dividerPatterns';
import type { DividerKeepOut, DividerPatternTarget, PatternPanelSpec } from './dividerPatterns';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';

/** Cache name for local (unplaced) divider pattern panels. */
const DIVIDER_PATTERN_CACHE = 'dividerPattern';

/**
 * Overshoot past each divider face, per side (mm).
 *
 * Deliberately much smaller than the outer walls' `wallThickness * 4`: a
 * divider's cut prism sits in open cavity on both sides, and the narrowest
 * legal compartment is only `2 x thickness` wide, so a deep prism could reach
 * across and perforate the NEXT divider at meaningless positions.
 */
const DIVIDER_CUT_OVERSHOOT = 1;

/** Whether an element of radius `r` centred at (u, z) touches a keep-out. */
function touchesKeepOut(
  u: number,
  z: number,
  radius: number,
  keepOuts: readonly DividerKeepOut[]
): boolean {
  for (const k of keepOuts) {
    if (u + radius <= k.uMin) continue;
    if (u - radius >= k.uMax) continue;
    if (z + radius <= k.zMin) continue;
    if (z - radius >= k.zMax) continue;
    return true;
  }
  return false;
}

/** Local-frame descriptor: geometry at the origin, placed by the caller. */
function localDescriptor(
  centers: readonly [PatternCenter, ...PatternCenter[]],
  span: number
): WallPatternDescriptor {
  return {
    side: 'front',
    centers,
    translateX: 0,
    translateY: 0,
    translateZ: 0,
    wallSpan: span,
    allowClip: false,
  };
}

/** Move a finished local panel onto its divider. Consumes `panel`. */
function placePanel(panel: Shape3D, target: DividerPatternTarget, bandCenterZ: number): Shape3D {
  let placed = panel;
  if (target.rotateZ !== 0) {
    const rotated = rotate(placed, target.rotateZ, { axis: [0, 0, 1] });
    placed.delete();
    placed = rotated;
  }
  const positioned = translate(placed, [target.x, target.y, bandCenterZ]);
  placed.delete();
  return positioned;
}

/** Best-effort dispose; swallow double-free / corrupt-handle errors. */
function disposeQuiet(s: Shape3D): void {
  try {
    s.delete();
  } catch {
    /* already cleaned */
  }
}

/** Keep-out cutter boxes in the local panel frame. Caller owns the results. */
function buildKeepOutBoxes(
  keepOuts: readonly DividerKeepOut[],
  bandCenterZ: number,
  depth: number
): Shape3D[] {
  const out: Shape3D[] = [];
  for (const k of keepOuts) {
    const w = k.uMax - k.uMin;
    const h = k.zMax - k.zMin;
    if (w <= 0 || h <= 0) continue;
    out.push(
      box(w, depth, h, {
        at: [(k.uMin + k.uMax) / 2, 0, (k.zMin + k.zMax) / 2 - bandCenterZ],
      })
    );
  }
  return out;
}

/** Cut every keep-out box out of a kumiko panel. Consumes `panel`. */
function applyKeepOutCuts(
  panel: Shape3D,
  keepOuts: readonly DividerKeepOut[],
  bandCenterZ: number,
  depth: number
): Shape3D | null {
  const boxes = buildKeepOutBoxes(keepOuts, bandCenterZ, depth);
  if (boxes.length === 0) return panel;

  // `unwrap(fuseAll(...))` throws on degenerate input, so the fuse has to sit
  // inside the guard — otherwise the boxes leak their WASM handles on exactly
  // the path where the worker can least afford it (same reason
  // `wallPatternClips.applyWallPatternClips` wraps its own fuse).
  let tool: Shape3D | null;
  try {
    tool = fuseAllOrNull(boxes);
  } catch {
    for (const b of boxes) disposeQuiet(b);
    return panel;
  }
  if (!tool) {
    for (const b of boxes) disposeQuiet(b);
    return panel;
  }
  try {
    const carved = unwrap(cut(panel, tool));
    panel.delete();
    return carved;
  } catch {
    // A degenerate keep-out box must not poison the whole generation; the
    // panel is still valid geometry, just less conservatively cleared.
    return panel;
  } finally {
    // fuseAllOrNull hands back boxes[0] itself when there is only one, so the
    // tool dispose below already covers that case.
    if (boxes.length > 1) {
      for (const b of boxes) disposeQuiet(b);
    }
    disposeQuiet(tool);
  }
}

/** Build one stamp-pattern panel in the divider's local frame. */
function buildStampPanel(
  calculator: StampPatternCalculator,
  target: PatternPanelSpec,
  bandZ0: number,
  bandHeight: number,
  cutDepth: number
): Shape3D | null {
  const radius = calculator.getShapeRadius();
  const bandCenterZ = bandZ0 + bandHeight / 2;
  const centers = calculator
    .calculateCenters({ fillW: target.patternSpan, fillH: bandHeight })
    .filter((c) => !touchesKeepOut(c.x, bandCenterZ + c.y, radius, target.keepOuts));
  if (centers.length === 0) return null;

  const descriptor = calculator.getShapeDescriptor({ fillW: 0, fillH: bandHeight });
  const template = buildShapeTemplate(descriptor, cutDepth);
  try {
    const [first, ...rest] = centers;
    return buildWallPatternCompound(
      template,
      localDescriptor([first, ...rest], target.patternSpan),
      cutDepth / 2
    );
  } finally {
    template.delete();
  }
}

/** Build one kumiko lattice panel in the divider's local frame. */
function buildKumikoPanel(
  latticePerimeter: number,
  lattice: Parameters<typeof buildFlatSlabCutter>[1],
  target: PatternPanelSpec,
  bandZ0: number,
  bandHeight: number,
  cutDepth: number
): Shape3D | null {
  const half = target.patternSpan / 2;
  const slab: FlatSlab = {
    kind: 'flat',
    side: 'front',
    u0: -half,
    u1: half,
    wallAngleDeg: 0,
    anchorX: 0,
    anchorY: 0,
  };
  // The lattice is u-periodic, so any window of it is a valid panel — and
  // because it was quantized against the OUTER perimeter, its triangles are
  // exactly the size the outer walls carry.
  const windows = flatWindows(slab, lattice);
  const parts: Shape3D[] = [];
  try {
    for (const [uA, uB] of windows) {
      const part = buildFlatSlabCutter(
        slab,
        lattice,
        bandZ0,
        bandHeight,
        cutDepth,
        0,
        latticePerimeter,
        uA,
        uB
      );
      if (part) parts.push(part);
    }
  } catch (err) {
    for (const p of parts) p.delete();
    throw err;
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  // The fuse itself can throw on degenerate input, so it sits inside the
  // guard: the window pieces are disposed whether it returns, returns null,
  // or throws. Leaking WASM handles on the error path is what wedges the
  // worker heap.
  try {
    return fuseAllOrNull(parts);
  } catch {
    return null;
  } finally {
    for (const p of parts) disposeQuiet(p);
  }
}

/** Cache-key fragment describing a divider's local panel geometry. */
function panelKey(
  patternType: string,
  variantKey: string,
  scale: number,
  target: PatternPanelSpec,
  bandZ0: number,
  bandHeight: number,
  cutDepth: number
): string {
  return compactKey(
    buildCacheKey(
      'divpat-v1',
      patternType,
      variantKey,
      // Scale is folded in explicitly: it moves the element web as well as the
      // radius, and only the radius reaches `variantKey` via the descriptor.
      quantize(scale),
      quantize(target.patternSpan),
      quantize(bandZ0),
      quantize(bandHeight),
      quantize(cutDepth),
      target.keepOuts
        .map(
          (k) => `${quantize(k.uMin)}:${quantize(k.uMax)}:${quantize(k.zMin)}:${quantize(k.zMax)}`
        )
        .join(',')
    )
  );
}

/**
 * Builds cached local-frame panels for one bin's pattern.
 *
 * Shared by the integrated dividers and the removable slotted pieces: both
 * need the same 2D panel and differ only in the rigid transform that places
 * it, so the caching, keep-out handling and kumiko/stamp dispatch live here
 * once rather than in each caller.
 */
export interface PanelFactory {
  /** Shortest band that fits one element row. */
  readonly minPatternHeight: number;
  /** Solid margin callers should hold around obstructions. */
  readonly border: number;
  /**
   * Build an owned local panel for this spec, or null when nothing fits.
   * The panel spans `patternSpan` in X, the band in Z (0 = band centre), and
   * `cutDepth` in Y.
   */
  build(
    spec: PatternPanelSpec,
    bandZ0: number,
    bandHeight: number,
    cutDepth: number
  ): Shape3D | null;
  /**
   * The cache key `build` would use for this spec, without building the panel.
   * It fully identifies the local panel geometry (pattern variant, span,
   * keep-outs, band, cut depth), so a caller can fold it into a resume key that
   * lets the boolean stage skip the whole cut when nothing changed.
   */
  keyFor(spec: PatternPanelSpec, bandZ0: number, bandHeight: number, cutDepth: number): string;
}

/** Which pattern a factory should build. Defaults to the bin's wall pattern. */
export interface PanelPatternSource {
  readonly pattern: WallPatternType;
  readonly scale: number;
}

/**
 * Resolve the panel factory for a pattern, or null when no pattern pipeline
 * applies. `innerW`/`innerD` only feed the kumiko perimeter, which fixes the
 * lattice metrics so divider triangles match the outer walls.
 *
 * `source` selects the pattern; it defaults to the bin's wall pattern, and the
 * floor pattern passes its own. Panel cache keys already carry the
 * pattern type and scale, so two sources can't collide.
 */
export function resolvePanelFactory(
  params: BinParams,
  innerW: number,
  innerD: number,
  source?: PanelPatternSource
): PanelFactory | null {
  const resolved: PanelPatternSource = source ?? {
    pattern: params.wallPattern.pattern,
    scale: params.wallPattern.scale ?? DEFAULT_PATTERN_SCALE,
  };
  if (!(resolved.pattern in PATTERN_REGISTRY)) return null;
  const scale = resolved.scale;
  const calculator = getPatternCalculator(resolved.pattern, params.height, scale);
  const stamp = isStampCalculator(calculator) ? calculator : null;
  const kumiko = stamp ? null : resolveKumikoCalculator(params);
  if (!stamp && !kumiko) return null;

  const latticePerimeter = kumiko
    ? resolveKumikoPerimeter(innerW, innerD, params.wallThickness)
    : 0;
  if (kumiko && latticePerimeter === null) return null;

  const patternType = calculator.getPatternType();
  // Lattices depend only on band height (the perimeter is fixed), so a bin
  // whose pieces share a height resolves one lattice for all of them.
  const latticeByBand = new Map<number, Parameters<typeof buildFlatSlabCutter>[1]>();

  // Resolve (and memoize) the kumiko lattice for a band height; null for stamp
  // patterns, which have no lattice.
  const latticeFor = (bandHeight: number): Parameters<typeof buildFlatSlabCutter>[1] | null => {
    if (!kumiko) return null;
    const cached = latticeByBand.get(bandHeight);
    if (cached) return cached;
    const lattice = kumiko.getLattice({ perimeter: latticePerimeter ?? 0, bandHeight });
    latticeByBand.set(bandHeight, lattice);
    return lattice;
  };

  // The cache key for a panel, shared by `build` and `keyFor` so the two never
  // drift.
  const computeKey = (
    spec: PatternPanelSpec,
    bandZ0: number,
    bandHeight: number,
    cutDepth: number
  ): string => {
    const lattice = latticeFor(bandHeight);
    const variantKey = stamp
      ? shapeDescriptorKey(stamp.getShapeDescriptor({ fillW: 0, fillH: bandHeight }))
      : buildCacheKey(
          'kumiko',
          quantize(latticePerimeter ?? 0),
          quantize(lattice?.columnPitch ?? 0),
          quantize(lattice?.strutWidth ?? 0)
        );
    return panelKey(patternType, variantKey, scale, spec, bandZ0, bandHeight, cutDepth);
  };

  return {
    minPatternHeight: calculator.getMinPatternHeight(),
    border: Math.max(CUTOUT_BORDER_WIDTH, calculator.getShapeRadius()),

    build(spec, bandZ0, bandHeight, cutDepth) {
      const lattice = latticeFor(bandHeight);
      if (kumiko && (!lattice || lattice.segments.length === 0)) return null;

      const key = computeKey(spec, bandZ0, bandHeight, cutDepth);
      const cachedPanel = getFeatureCache(DIVIDER_PATTERN_CACHE, key);
      if (cachedPanel) return cachedPanel;

      let built = stamp
        ? buildStampPanel(stamp, spec, bandZ0, bandHeight, cutDepth)
        : lattice
          ? buildKumikoPanel(latticePerimeter ?? 0, lattice, spec, bandZ0, bandHeight, cutDepth)
          : null;
      // Stamp panels already exclude blocked elements by construction; only
      // the continuous kumiko lattice needs the boxes cut out of it.
      if (built && kumiko) {
        built = applyKeepOutCuts(built, spec.keepOuts, bandZ0 + bandHeight / 2, cutDepth + 2);
      }
      if (!built) return null;
      setFeatureCache(DIVIDER_PATTERN_CACHE, key, built);
      return unwrap(clone(built));
    },

    keyFor(spec, bandZ0, bandHeight, cutDepth) {
      return computeKey(spec, bandZ0, bandHeight, cutDepth);
    },
  };
}

/**
 * Divider pattern cut targets plus the geometry identity of the whole set.
 *
 * `key` is empty when no divider cut applies, and otherwise identifies every
 * placed panel: the factory's local-panel key (motif variant, span, keep-outs,
 * band, cut depth) composed with each target's rigid placement and the interior
 * offset. The resume cache in `booleanStage` keys on this so a divider-patterned
 * bin can skip the whole boolean stage when the cut set is unchanged.
 */
export interface DividerPatternResult {
  readonly shapes: Shape3D[];
  readonly key: string;
}

/**
 * Build the divider pattern cut targets for a bin.
 *
 * `shapes` is empty (and `key` blank) whenever the feature is off, unavailable
 * for this bin, or no divider offers a band large enough for a single element.
 * Each returned shape is owned by the caller.
 */
export function buildDividerPatterns(ctx: PipelineContext): DividerPatternResult {
  const { params, dimensions: dim, signal, originToTag, perfCollector } = ctx;
  const NONE: DividerPatternResult = { shapes: [], key: '' };

  const factory = resolvePanelFactory(params, dim.innerW, dim.innerD);
  if (!factory) return NONE;

  const plan = planDividerPatterns(params, dim, factory.border);
  if (!plan) return NONE;
  if (plan.bandHeight < factory.minPatternHeight) return NONE;

  const cutDepth = plan.thickness + 2 * DIVIDER_CUT_OVERSHOOT;
  const bandCenterZ = plan.bandZ0 + plan.bandHeight / 2;

  const start = perfCollector ? performance.now() : 0;
  const shapes: Shape3D[] = [];
  const keyParts: string[] = [];
  for (const target of plan.targets) {
    checkCancelled(signal);
    const panel = factory.build(target, plan.bandZ0, plan.bandHeight, cutDepth);
    if (!panel) continue;

    // Identity of this placed cut: the factory's local-panel key plus the rigid
    // placement (position, in-plane rotation, span) and the interior offset
    // applied after the local cache.
    keyParts.push(
      compactKey(
        buildCacheKey(
          factory.keyFor(target, plan.bandZ0, plan.bandHeight, cutDepth),
          quantize(target.x),
          quantize(target.y),
          quantize(target.rotateZ),
          quantize(target.wallLen),
          quantize(bandCenterZ),
          quantize(dim.innerOffsetX),
          quantize(dim.innerOffsetY)
        )
      )
    );

    let placed = placePanel(panel, target, bandCenterZ);
    if (dim.innerOffsetX !== 0 || dim.innerOffsetY !== 0) {
      const old = placed;
      placed = translate(old, [dim.innerOffsetX, dim.innerOffsetY, 0]);
      old.delete();
    }
    collectOrigins(placed, FeatureTag.WALL_PATTERN, originToTag);
    shapes.push(placed);
  }

  if (perfCollector && shapes.length > 0) {
    perfCollector.recordWallPatternSubstep(
      'divider_panels',
      performance.now() - start,
      shapes.length
    );
  }

  if (shapes.length === 0) return NONE;
  return { shapes, key: compactKey(buildCacheKey('divider-v1', ...keyParts)) };
}
