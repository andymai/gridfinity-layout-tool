/**
 * Floor text: the caption on the interior floor of a hollow bin.
 *
 * Registered as two builders for the reason `wallTextBuilder` gives: a
 * FeatureBuilder has one static boolean target, and an engraving cuts while an
 * emboss or a flat caption fuses.
 */

import { clone, unwrap, withScope } from 'brepjs';
import type { DisposalScope, Shape3D } from 'brepjs';
import { resolveFloorTextStyle } from '@/shared/types/bin';
import type { FeatureBuilder } from './pipeline/featureBuilder';
import type { PipelineContext } from './pipeline/types';
import { FeatureTag } from './featureTags';
import { buildCacheKey, compactKey, quantize, stableSerialize } from './cacheKeyUtils';
import { buildTextSolid, textOpForMode } from './textBuilder';
import { computeFloorTextLayout, floorTextApplies } from './floorTextLayout';

function wantsOp(ctx: PipelineContext, wantFuse: boolean): boolean {
  if (!floorTextApplies(ctx.params, ctx.dimensions)) return false;
  const { mode } = resolveFloorTextStyle(ctx.params.textDefaults, ctx.params.surfaceText);
  return (textOpForMode(mode) === 'fuse') === wantFuse;
}

function buildFloorText(ctx: PipelineContext): readonly Shape3D[] | null {
  const layout = computeFloorTextLayout(ctx.params, ctx.dimensions);
  if (!layout) return null;
  return withScope((scope: DisposalScope) => {
    const result = buildTextSolid(scope, {
      text: layout.text,
      style: layout.style,
      plan: layout.plan,
      availW: layout.availW,
      availD: layout.availD,
      centerX: layout.centerX,
      centerY: layout.centerY,
      topZ: layout.topZ,
      depth: layout.depth,
      hostThickness: layout.hostThickness,
      angleDeg: layout.rotation,
      pivot: 'host',
    });
    return result ? [unwrap(clone(result.solid))] : null;
  });
}

/** Keyed on the solved placement, which already folds in every obstacle. */
function floorTextCacheKey(ctx: PipelineContext): string {
  const layout = computeFloorTextLayout(ctx.params, ctx.dimensions);
  return compactKey(
    buildCacheKey(
      'v1',
      layout
        ? stableSerialize([
            layout.text,
            layout.style,
            layout.rotation,
            quantize(layout.depth),
            quantize(layout.centerX),
            quantize(layout.centerY),
            quantize(layout.availW),
            quantize(layout.availD),
            quantize(layout.plan.fontSize),
            quantize(layout.topZ),
          ])
        : 'none'
    )
  );
}

export const floorTextCutFeature: FeatureBuilder = {
  name: 'floorTextCut',
  tag: FeatureTag.TEXT,
  target: 'cut',
  shouldBuild: (ctx) => wantsOp(ctx, false),
  cacheKey: floorTextCacheKey,
  build: buildFloorText,
};

export const floorTextEmbossFeature: FeatureBuilder = {
  name: 'floorTextEmboss',
  tag: FeatureTag.TEXT,
  target: 'fuse',
  shouldBuild: (ctx) => wantsOp(ctx, true),
  cacheKey: floorTextCacheKey,
  build: buildFloorText,
};
