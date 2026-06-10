/**
 * Shell stage — assembles the bin body (box + stacking lip) and the base socket.
 *
 * The BODY (box + lip) is cached by shellKey and is what features cut. The base
 * socket is built separately (its own cache) and left OUT of `solid` on BOTH
 * paths — carried in `deferredSolid` so feature fuses/cuts run on the simpler
 * socket-less body. The tessellate stage then resolves it: PREVIEW meshes the
 * body and socket separately and concatenates (skips the ≈80%-of-cold-shell
 * socket↔body fuse), while EXPORT fuses the socket into the featured body for a
 * single watertight solid. Deferring past features — not just past the body —
 * also keeps additive feature fuses off the socket-laden body, which otherwise
 * went non-manifold (GH #2085); see the socket-deferral note below.
 */

import { unwrap, fuse, translate, withScope, getKernelCapabilities } from 'brepjs';
import type { DisposalScope, Shape3D } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { checkCancelled, isAbortError } from '../../utils/abort';
import { buildBaseSocket, buildOverhangFeet } from '../../socketBuilder';
import { buildBinBox, buildTopShape } from '../../boxBuilder';
import { buildBinBoxWithLip } from '../../integratedLipBuilder';
import { maskHasHoles } from '../../maskPolygon';
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

    // ── BODY (box + optional lip) — cached by shellKey. ──────────────────────
    // `getShellCache` returns a metadata-preserving clone so BASE/LIP face-origin
    // tags survive the cache hit (the metadata rides on the shape, not on the
    // fresh per-generation `originToTag` map). For flat bins the body is the
    // whole shell; for socket bins the socket is added separately below.
    let body = getShellCache(dim.shellKey);
    if (!body) {
      checkCancelled(signal);
      onProgress?.('shell', 0.3);

      const cutoutTopOffset = dim.solid ? params.cutoutConfig.topOffset : 0;
      // Per-compartment cavity drawings only for the multi-cavity cut path
      // (rectangular bin + non-solid + rectangular comps). shellKey already
      // discriminates on the comp grid so `undefined` is safe otherwise.
      const rawCavityDrawings = dim.compartmentsBakedIntoShell
        ? buildCompartmentCavityDrawings(params, dim.innerW, dim.innerD)
        : undefined;
      const compartmentCavityDrawings =
        rawCavityDrawings && (dim.innerOffsetX !== 0 || dim.innerOffsetY !== 0)
          ? rawCavityDrawings.map((d) => d.translate(dim.innerOffsetX, dim.innerOffsetY))
          : rawCavityDrawings;
      const compartmentCavityKey = dim.compartmentsBakedIntoShell
        ? buildCompartmentsCacheKey(params)
        : undefined;

      // Mesh kernels (the Manifold draft) leave the body↔lip fuse's coincident
      // outer-wall faces undissolved → z-fighting at the rounded corners (#2074).
      // Build the body+lip as a single fuse-free solid instead, but only for the
      // common case the integrated builder covers; everything else keeps the
      // exact-faithful fuse below. Draft-only: the export path is an exact kernel.
      const integratedLip =
        dim.hasLip &&
        !dim.solid &&
        !dim.compartmentsBakedIntoShell &&
        getKernelCapabilities().tessellationModel === 'build-time' &&
        !(params.cellMask && maskHasHoles(params.cellMask));

      const built = withScope((scope: DisposalScope) => {
        if (integratedLip) {
          try {
            const integrated = buildBinBoxWithLip(
              params.width,
              params.depth,
              dim.wallHeight,
              params.wallThickness,
              params.gridUnitMm,
              params.cellMask,
              dim.overhang
            );
            // One solid: the lip is not a separable origin here, so the whole
            // body carries the BASE tag (the exact path preserves the LIP tag).
            collectOrigins(integrated, FeatureTag.BASE, originToTag);
            return integrated;
          } catch (e: unknown) {
            if (isAbortError(e)) throw e;
            // Integrated build failed — fall through to the fuse path.
          }
        }

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

        if (dim.hasLip) {
          try {
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
              fuse(binBody, top /* no commonFace: box (3.75mm corners) and lip profile differ */)
            );
          } catch (e: unknown) {
            if (isAbortError(e)) throw e;
            return binBody; // fuse failed — withScope exempts returned value from disposal
          }
        }
        return binBody; // no lip
      });

      setShellCache(dim.shellKey, built);
      // Metadata-preserving clone for the context (cache keeps `built`).
      body = translate(built, [0, 0, 0]);
    }

    // Flat bins have no base socket — the body IS the whole shell.
    if (dim.isFlat) {
      return { ...ctx, solid: body, deferredSolid: null };
    }

    // ── BASE SOCKET — built separately (its own cache), optionally + feet. ───
    checkCancelled(signal);
    onProgress?.('features', 0.4);
    let socket = buildBaseSocket(
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
    );
    // `withScope` can't wrap this section (it must yield TWO survivors — body
    // and socket — on the preview path), so dispose manually on any throw to
    // match the exception-safety the scoped code had: a failed OCCT fuse must
    // not leak the body/socket/feet WASM handles.
    let feet: Shape3D | null = null;
    try {
      if (dim.overhang.feet && hasOverhang(dim.overhang)) {
        feet = buildOverhangFeet(params.width, params.depth, dim.overhang, params.gridUnitMm, true);
        if (feet) {
          const withFeet = unwrap(fuse(socket, feet));
          socket.delete();
          feet.delete();
          feet = null;
          socket = withFeet;
        }
      }
      collectOrigins(socket, FeatureTag.SOCKET, originToTag);

      // Defer the socket on BOTH paths. Preview meshes it separately (skips the
      // fuse); export fuses it in at the tessellate stage, AFTER features.
      //
      // Fusing the socket here (before features) made additive feature fuses —
      // the label-bracket especially — go non-manifold: OCCT's fuse of the
      // bracket onto a socket-laden body left T-junction (faces=3) edges far
      // from the interface, so the exported STL was not watertight (GH #2085).
      // The same bracket fuses cleanly onto the socket-less body, so deferring
      // the socket to last keeps every feature fuse on a simpler solid and the
      // final socket fuse (onto the featured body) stays manifold. The socket is
      // never feature-cut — it only meets the body at the hidden floor interface
      // — so order is geometrically equivalent, just numerically robust.
      return { ...ctx, solid: body, deferredSolid: socket };
    } catch (e: unknown) {
      socket.delete();
      body.delete();
      feet?.delete();
      throw e;
    }
  },
};
