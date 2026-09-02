/**
 * Sliding-tray rail: the track fused onto the bin, and the companion tray.
 *
 * All placement comes from `resolveSlideGeometry`, which is pure and tested
 * without a kernel. This file only turns those boxes into solids, so the rail
 * on the bin and the tray that rides it can never disagree about where the
 * bearing surfaces are.
 */

import { draw, translate, withScope, clone, unwrap, fuse, cut } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { isPartialMask } from '@/shared/utils/cellMask';
import { resolveSlideGeometry } from '@/shared/utils/slideGeometry';
import type { SlideRailSection, SlideGeometryInput } from '@/shared/utils/slideGeometry';

/**
 * Sweep a rail's YZ cross-section along X.
 *
 * Sketched on YZ and extruded along +X, then translated to the section's start.
 * A box path would not do: a shelf's underside is chamfered, which is what
 * keeps it off the support-material list.
 */
function railSolid(scope: DisposalScope, bar: SlideRailSection): Shape3D {
  const [first, ...rest] = bar.section;
  let pen = draw([first[0], first[1]]);
  for (const [y, z] of rest) pen = pen.lineTo([y, z]);
  const extruded = scope.register(sketch(pen.close(), 'YZ').extrude(bar.xMax - bar.xMin));
  return scope.register(translate(extruded, [bar.xMin, 0, 0]));
}

/** Axis-aligned box as a solid, from bin-centred mm bounds. */
function boxSolid(
  scope: DisposalScope,
  b: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number }
): Shape3D {
  const profile = draw([b.xMin, b.yMin])
    .lineTo([b.xMax, b.yMin])
    .lineTo([b.xMax, b.yMax])
    .lineTo([b.xMin, b.yMax])
    .close();
  const extruded = scope.register(sketch(profile, 'XY').extrude(b.zMax - b.zMin));
  return scope.register(translate(extruded, [0, 0, b.zMin]));
}

/** Build the rail bars for a bin, or null when the config produces none. */
export function buildSlideRails(input: SlideGeometryInput): Shape3D | null {
  const geometry = resolveSlideGeometry(input);
  if (geometry.rails.length === 0) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const bars = geometry.rails.map((bar) => railSolid(scope, bar));
    if (bars.length === 0) return null;
    // Pairwise: the n-way fuse leaves sealed inner shells where bars overlap
    // end to end, which the export then has to collapse away.
    let fused = bars[0];
    for (const bar of bars.slice(1)) {
      fused = scope.register(unwrap(fuse(fused as ValidSolid, bar as ValidSolid)));
    }
    return unwrap(clone(fused));
  });
}

/**
 * Build the companion tray: an open-topped box sized to run in this bin's
 * track. Returned at the origin with its floor on Z=0, which is the print
 * orientation; the caller places it.
 */
export function buildSlideTray(input: SlideGeometryInput): Shape3D | null {
  const { tray } = resolveSlideGeometry(input);
  if (!tray) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const outer = boxSolid(scope, {
      xMin: -tray.widthMm / 2,
      xMax: tray.widthMm / 2,
      yMin: -tray.depthMm / 2,
      yMax: tray.depthMm / 2,
      zMin: 0,
      zMax: tray.heightMm,
    });
    const innerW = tray.widthMm - 2 * tray.wallMm;
    const innerD = tray.depthMm - 2 * tray.wallMm;
    if (innerW <= 0 || innerD <= 0) return unwrap(clone(outer));

    // Cavity runs past the top so the boolean leaves no skin over the opening.
    const cavity = boxSolid(scope, {
      xMin: -innerW / 2,
      xMax: innerW / 2,
      yMin: -innerD / 2,
      yMax: innerD / 2,
      zMin: tray.wallMm,
      zMax: tray.heightMm + 1,
    });
    const hollow = cut(outer as ValidSolid, cavity as ValidSolid);
    if (!hollow.ok) return unwrap(clone(outer));
    return unwrap(clone(scope.register(hollow.value)));
  });
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';
import type { PipelineContext } from './pipeline/types';

/** Resolver input from a pipeline context, so the feature and the export agree. */
export function slideInputFromContext(ctx: PipelineContext): SlideGeometryInput {
  const { params, dimensions: dim } = ctx;
  return {
    slide: params.slide,
    isSlotted: dim.isSlotted,
    isSolid: dim.solid,
    isPolygon: isPartialMask(params.cellMask),
    innerW: dim.innerW,
    innerD: dim.innerD,
    outerW: dim.outerW,
    outerD: dim.outerD,
    wallThickness: params.wallThickness,
    wallHeight: dim.wallHeight,
    collarHeight: dim.collarHeight,
    hasLip: dim.hasLip,
    gridUnitMmX: dim.gridUnitMmX,
  };
}

export const slideRailsFeature: FeatureBuilder = {
  name: 'slideRails',
  tag: FeatureTag.SLIDE_RAIL,
  target: 'fuse',
  shouldBuild: (ctx: PipelineContext) =>
    ctx.params.slide.enabled && !ctx.dimensions.isSlotted && !ctx.dimensions.solid,
  cacheKey: (ctx: PipelineContext) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        'slideRails-v1',
        stableSerialize(params.slide),
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.outerW),
        quantize(dim.outerD),
        quantize(dim.wallHeight),
        quantize(dim.collarHeight),
        quantize(params.wallThickness),
        quantize(dim.gridUnitMmX),
        dim.hasLip ? 'lip' : 'nolip'
      )
    );
  },
  build: (ctx: PipelineContext) => {
    const rails = buildSlideRails(slideInputFromContext(ctx));
    return rails ? [rails] : null;
  },
};

/** Re-exported so callers outside the pipeline can resolve the same geometry. */
export type { SlideGeometryInput } from '@/shared/utils/slideGeometry';
export { resolveSlideGeometry } from '@/shared/utils/slideGeometry';

/** Convenience for callers holding raw params rather than a pipeline context. */
export function slideInputFromParams(
  params: BinParams,
  dims: Omit<SlideGeometryInput, 'slide' | 'wallThickness'>
): SlideGeometryInput {
  return { ...dims, slide: params.slide, wallThickness: params.wallThickness };
}
