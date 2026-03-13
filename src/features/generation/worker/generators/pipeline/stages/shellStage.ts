/**
 * Shell stage — assembles base socket + box body + stacking lip.
 *
 * Result is cached by shellKey for reuse across feature-only changes.
 * On cache hit, the cached shape is returned directly (BREP boolean ops
 * create new shapes and do not mutate their inputs, so the cache is safe).
 * On cache miss, the freshly-built shell is cached and then cloned so the
 * context holds a mutable copy.
 */

import { unwrap, fuse, clone, translate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { checkCancelled } from '../../meshUtils';
import { buildBaseSocket } from '../../socketBuilder';
import { buildBinBox, buildTopShape } from '../../boxBuilder';
import { getShellCache, setShellCache } from '../../shapeCache';
import { FeatureTag } from '../../featureTags';
import { collectOrigins } from '../collectOrigins';

export const shellStage: PipelineStage = {
  name: 'base',
  progressValue: 0.1,

  shouldRun(): boolean {
    return true;
  },

  execute(ctx: PipelineContext): PipelineContext {
    const { params, dimensions: dim, signal, onProgress, originToTag } = ctx;

    // Check cache first
    const cachedShell = getShellCache(dim.shellKey);
    if (cachedShell) {
      return { ...ctx, solid: cachedShell };
    }

    checkCancelled(signal);
    onProgress?.('shell', 0.3);

    const cutoutTopOffset = dim.solid ? params.cutoutConfig.topOffset : 0;
    const binBody = buildBinBox(
      params.width,
      params.depth,
      dim.wallHeight,
      params.wallThickness,
      dim.solid,
      cutoutTopOffset
    );
    collectOrigins(binBody, FeatureTag.BASE, originToTag);

    let bin: Shape3D;

    if (dim.isFlat) {
      checkCancelled(signal);
      onProgress?.('features', 0.4);
      if (dim.hasLip) {
        try {
          const top = translate(buildTopShape(params.width, params.depth, true), [
            0,
            0,
            dim.wallHeight,
          ]);
          collectOrigins(top, FeatureTag.LIP, originToTag);
          bin = unwrap(fuse(binBody, top, { optimisation: 'commonFace' }));
        } catch (e: unknown) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
          bin = binBody;
        }
      } else {
        bin = binBody;
      }
    } else {
      // Socket style: build base socket and fuse with box
      const base = buildBaseSocket(
        params.width,
        params.depth,
        dim.withMagnet,
        dim.withScrew,
        params.base.magnetDiameter / 2,
        params.base.magnetDepth,
        params.base.screwDiameter / 2,
        dim.useHighQuality,
        dim.halfSockets
      );
      collectOrigins(base, FeatureTag.SOCKET, originToTag);

      checkCancelled(signal);
      onProgress?.('features', 0.4);
      if (dim.hasLip) {
        try {
          const top = translate(buildTopShape(params.width, params.depth, true), [
            0,
            0,
            dim.wallHeight,
          ]);
          collectOrigins(top, FeatureTag.LIP, originToTag);
          bin = unwrap(
            fuse(unwrap(fuse(base, binBody, { optimisation: 'commonFace' })), top, {
              optimisation: 'commonFace',
            })
          );
        } catch (e: unknown) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
          bin = unwrap(fuse(base, binBody, { optimisation: 'commonFace' }));
        }
      } else {
        bin = unwrap(fuse(base, binBody, { optimisation: 'commonFace' }));
      }
    }

    setShellCache(dim.shellKey, bin);
    bin = clone(bin);

    return { ...ctx, solid: bin };
  },
};
