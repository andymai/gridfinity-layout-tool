/**
 * Shell stage — assembles base socket + box body + stacking lip.
 *
 * Result is cached by shellKey for reuse across feature-only changes.
 * On cache hit, the cached shape is returned directly (BREP boolean ops
 * create new shapes and do not mutate their inputs, so the cache is safe).
 * On cache miss, the freshly-built shell is cached and then cloned so the
 * context holds a mutable copy.
 */

import { unwrap, isOk, fuse, clone, translate, simplify, withScope } from 'brepjs';
import type { DisposalScope } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { checkCancelled, isAbortError } from '../../utils/abort';
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
            const top = scope.register(
              translate(buildTopShape(params.width, params.depth, true, params.gridUnitMm), [
                0,
                0,
                dim.wallHeight,
              ])
            );
            collectOrigins(top, FeatureTag.LIP, originToTag);
            const fused = unwrap(
              fuse(
                binBody,
                top /* no commonFace: box (3.75mm corners) and socket/lip profiles differ */
              )
            );
            // Register binBody only after fuse succeeds — if fuse throws,
            // the catch block returns binBody which must not be disposed.
            scope.register(binBody);
            // Merge coplanar/co-cylindrical faces at the lip–wall junction
            // so the exterior wall flows seamlessly into the lip.
            return unwrap(simplify(fused));
          } catch (e: unknown) {
            if (isAbortError(e)) throw e;
            return binBody; // fuse failed — binBody is NOT registered, safe to return
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
          const top = scope.register(
            translate(buildTopShape(params.width, params.depth, true, params.gridUnitMm), [
              0,
              0,
              dim.wallHeight,
            ])
          );
          collectOrigins(top, FeatureTag.LIP, originToTag);
          const baseAndBody = scope.register(unwrap(fuse(base, binBody)));
          const withLip = unwrap(
            fuse(
              baseAndBody,
              top /* no commonFace: box (3.75mm corners) and socket/lip profiles differ */
            )
          );
          // Merge coplanar/co-cylindrical faces at the lip–wall junction.
          return unwrap(simplify(withLip));
        } catch (e: unknown) {
          if (isAbortError(e)) throw e;
          return unwrap(fuse(base, binBody));
        }
      }

      return unwrap(fuse(base, binBody));
    });

    // Clone for the pipeline; cache the original.
    // brepjs v15: clone() returns Result<T> — handle Err gracefully.
    const cloneResult = clone(bin);
    if (isOk(cloneResult)) {
      setShellCache(dim.shellKey, bin);
      return { ...ctx, solid: cloneResult.value };
    }
    // Clone failed — skip caching, use original directly.
    return { ...ctx, solid: bin };
  },
};
