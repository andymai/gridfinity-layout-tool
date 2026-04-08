/**
 * Shell stage — assembles base socket + box body + stacking lip.
 *
 * Result is cached by shellKey for reuse across feature-only changes.
 * On cache hit, the cached shape is returned directly (BREP boolean ops
 * create new shapes and do not mutate their inputs, so the cache is safe).
 * On cache miss, the freshly-built shell is cached and then cloned so the
 * context holds a mutable copy.
 */

import { unwrap, fuse, clone, translate, withScope } from 'brepjs';
import type { DisposalScope } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { checkCancelled, isAbortError } from '../../utils/abort';
import { buildBaseSocket } from '../../socketBuilder';
import { buildBinBox, buildTopShape } from '../../boxBuilder';
import { getShellCache, setShellCache } from '../../shapeCache';
import { LIP_OVERLAP } from '../../generatorConstants';
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

    const bin = withScope((scope: DisposalScope) => {
      const binBody = buildBinBox(
        params.width,
        params.depth,
        dim.wallHeight,
        params.wallThickness,
        dim.solid,
        cutoutTopOffset,
        params.gridUnitMm
      );
      collectOrigins(binBody, FeatureTag.BASE, originToTag);

      if (dim.isFlat) {
        checkCancelled(signal);
        onProgress?.('features', 0.4);
        if (dim.hasLip) {
          try {
            // buildTopShape returns a cache-owned clone — register it so
            // the scope disposes that intermediate after translate produces
            // the positioned copy.
            const lipBase = scope.register(
              buildTopShape(params.width, params.depth, true, params.gridUnitMm)
            );
            const top = scope.register(translate(lipBase, [0, 0, dim.wallHeight - LIP_OVERLAP]));
            collectOrigins(top, FeatureTag.LIP, originToTag);
            scope.register(binBody); // consumed by fuse
            return unwrap(
              fuse(
                binBody,
                top /* no commonFace: box (3.75mm corners) and socket/lip profiles differ */
              )
            );
          } catch (e: unknown) {
            if (isAbortError(e)) throw e;
            return binBody; // fuse failed — withScope exempts returned value from disposal
          }
        }
        return binBody; // no lip — binBody is the result (NOT registered)
      }

      // Socket style: build base socket and fuse with box.
      // Register binBody eagerly — all socket paths consume it via fuse.
      // Box uses BOX_CORNER_RADIUS (3.75mm) while socket uses SOCKET_CORNER_RADIUS
      // (4mm), so they do NOT share a common face at Z=0 — full boolean required.
      scope.register(binBody);
      const base = scope.register(
        buildBaseSocket(
          params.width,
          params.depth,
          dim.withMagnet,
          dim.withScrew,
          params.base.magnetDiameter / 2,
          params.base.magnetDepth,
          params.base.screwDiameter / 2,
          true, // Always use full 5-section socket profile (OCCT v8 is fast enough)
          dim.halfSockets,
          params.gridUnitMm
        )
      );
      collectOrigins(base, FeatureTag.SOCKET, originToTag);

      checkCancelled(signal);
      onProgress?.('features', 0.4);
      if (dim.hasLip) {
        try {
          // buildTopShape returns a cache-owned clone — register it so
          // the scope disposes that intermediate after translate produces
          // the positioned copy.
          const lipBase = scope.register(
            buildTopShape(params.width, params.depth, true, params.gridUnitMm)
          );
          const top = scope.register(translate(lipBase, [0, 0, dim.wallHeight - LIP_OVERLAP]));
          collectOrigins(top, FeatureTag.LIP, originToTag);
          const baseAndBody = scope.register(unwrap(fuse(base, binBody)));
          return unwrap(
            fuse(
              baseAndBody,
              top /* no commonFace: box (3.75mm corners) and socket/lip profiles differ */
            )
          );
        } catch (e: unknown) {
          if (isAbortError(e)) throw e;
          return unwrap(fuse(base, binBody));
        }
      }

      return unwrap(fuse(base, binBody));
    });

    setShellCache(dim.shellKey, bin);

    return { ...ctx, solid: unwrap(clone(bin)) };
  },
};
