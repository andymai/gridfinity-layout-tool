/**
 * Shell stage — assembles base socket + box body + stacking lip.
 *
 * Result is cached by shellKey for reuse across feature-only changes.
 * On cache hit, the cached shape is returned directly (BREP boolean ops
 * create new shapes and do not mutate their inputs, so the cache is safe).
 * On cache miss, the freshly-built shell is cached and then cloned so the
 * context holds a mutable copy.
 */

import { unwrap, fuse, translate, withScope } from 'brepjs';
import type { DisposalScope } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { checkCancelled, isAbortError } from '../../utils/abort';
import { buildBaseSocket, buildOverhangFeet } from '../../socketBuilder';
import { buildBinBox, buildTopShape } from '../../boxBuilder';
import { hasOverhang } from '../../overhang';
import {
  buildCompartmentCavityDrawings,
  buildCompartmentsCacheKey,
} from '../../compartmentBuilder';
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

    // `getShellCache` returns a metadata-preserving clone so face-origin
    // tags survive the cache hit (see `getShellCache` for the mechanism).
    const cachedShell = getShellCache(dim.shellKey);
    if (cachedShell) {
      return { ...ctx, solid: cachedShell };
    }

    checkCancelled(signal);
    onProgress?.('shell', 0.3);

    const cutoutTopOffset = dim.solid ? params.cutoutConfig.topOffset : 0;

    // Compute per-compartment cavity drawings only when the multi-cavity cut
    // path will be taken (rectangular bin + non-solid + rectangular comps).
    // The cache key in `dim.shellKey` already discriminates on the comp grid
    // so we can safely pass `undefined` for the default path.
    const compartmentCavityDrawings = dim.compartmentsBakedIntoShell
      ? buildCompartmentCavityDrawings(params, dim.innerW, dim.innerD)
      : undefined;
    const compartmentCavityKey = dim.compartmentsBakedIntoShell
      ? buildCompartmentsCacheKey(params)
      : undefined;

    const bin = withScope((scope: DisposalScope) => {
      const binBody = buildBinBox(
        params.width,
        params.depth,
        dim.wallHeight,
        params.wallThickness,
        dim.solid,
        cutoutTopOffset,
        params.gridUnitMm,
        params.cellMask,
        compartmentCavityDrawings,
        compartmentCavityKey,
        dim.overhang
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
              buildTopShape(
                params.width,
                params.depth,
                true,
                params.gridUnitMm,
                params.cellMask,
                dim.overhang
              )
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
      let base = scope.register(
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
          params.gridUnitMm,
          params.cellMask
        )
      );
      // Optional grid-aligned feet under the overhang region (flat bottom otherwise).
      if (dim.overhang.feet && hasOverhang(dim.overhang)) {
        const feet = buildOverhangFeet(
          params.width,
          params.depth,
          dim.overhang,
          params.gridUnitMm,
          true
        );
        if (feet) {
          base = scope.register(unwrap(fuse(base, scope.register(feet))));
        }
      }
      collectOrigins(base, FeatureTag.SOCKET, originToTag);

      checkCancelled(signal);
      onProgress?.('features', 0.4);
      if (dim.hasLip) {
        try {
          // buildTopShape returns a cache-owned clone — register it so
          // the scope disposes that intermediate after translate produces
          // the positioned copy.
          const lipBase = scope.register(
            buildTopShape(
              params.width,
              params.depth,
              true,
              params.gridUnitMm,
              params.cellMask,
              dim.overhang
            )
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

    // Mirror the cache-hit path: a zero-vector translate is the cheapest
    // brepjs op that preserves face-origin metadata through a copy. Plain
    // `clone()` would drop the WeakMap and break multi-color on first render.
    return { ...ctx, solid: translate(bin, [0, 0, 0]) };
  },
};
