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

import { unwrap, fuse, cut, translate, withScope, getKernelCapabilities } from 'brepjs';
import type { DisposalScope, Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { checkCancelled, isAbortError } from '../../utils/abort';
import { buildBaseSocket, buildOverhangFeet, baseSocketShapeKey } from '../../socketBuilder';
import { buildLightweightBase } from '../../lightweightBaseBuilder';
import type { LightweightBase, LightweightOpenDirection } from '../../lightweightBaseBuilder';
import { buildBinBox, buildTopShape } from '../../boxBuilder';
import { buildBinBoxWithLip } from '../../integratedLipBuilder';
import { maskHasHoles } from '../../maskPolygon';
import { buildSpanningDividerClipTools, planSpanningDividerClips } from '../../labelTabBuilder';
import { hasOverhang, overhangKey } from '../../overhang';
import {
  buildCompartmentCavityDrawings,
  buildCompartmentsCacheKey,
  compartmentsAreRectangular,
  hasMultipleCompartments,
} from '../../compartmentBuilder';
import { isPartialMask } from '@/shared/utils/cellMask';
import { getShellCache, setShellCache } from '../../shapeCache';
import { LIP_OVERLAP } from '../../generatorConstants';
import { FeatureTag } from '../../featureTags';
import { collectOrigins } from '../collectOrigins';

/**
 * Which way the lite cups open.
 *
 * A spacer (#2869) opens BOTH ends, so each foot becomes a tube and the cell is a
 * clean through-hole; it never carries magnets or screws (`deriveDimensions`
 * suppresses them — a pad inside a through-hole would be free-standing). Solid
 * bins open downward, since their body keeps its floor; everything else opens up
 * into the cavity.
 */
function cupOpenDirection(dim: PipelineContext['dimensions']): LightweightOpenDirection {
  if (dim.isSpacer) return 'through';
  return dim.solid ? 'down' : 'up';
}

export const shellStage: PipelineStage = {
  name: 'base',
  progressValue: 0.1,

  shouldRun(): boolean {
    return true;
  },

  execute(ctx: PipelineContext): PipelineContext {
    const { params, dimensions: dim, signal, onProgress, originToTag } = ctx;
    // Per-axis grid pitch (equal for a square grid). Threaded into every cell-
    // iterating builder so feet/sockets/lip stretch with a non-square grid.
    const pitch = { x: dim.gridUnitMmX, y: dim.gridUnitMmY };

    // ── LIGHTWEIGHT BASE — shelled cups replace the solid socket. ────────────
    // Built up-front because its `floorOpenings` must be cut into the body
    // *before* the body is cached, while its `base` (cups) is the deferred
    // socket used in the socket section below. Solid bins open the cups
    // downward (no floor opening — the solid body keeps its floor).
    let liteBase: LightweightBase | null = null;
    let floorOpenings: Shape3D | null = null;
    if (dim.lightweight && !dim.socketless) {
      // Open-cavity floor for clipping cup recesses away from divider walls, so a
      // divider crossing a cup keeps a solid foot core beneath it (no bridge over
      // the recess). Only for hollow bins with rectangular compartments; tilted/
      // polygon layouts fall back to no clip (best-effort). (Scoops are mutually
      // exclusive with lightweight, so no scoop band to preserve here.)
      const openFloorDrawings =
        !dim.solid &&
        hasMultipleCompartments(params) &&
        compartmentsAreRectangular(params) &&
        !isPartialMask(params.cellMask)
          ? buildCompartmentCavityDrawings(params, dim.innerW, dim.innerD).map((d) =>
              dim.innerOffsetX !== 0 || dim.innerOffsetY !== 0
                ? d.translate(dim.innerOffsetX, dim.innerOffsetY)
                : d
            )
          : undefined;
      liteBase = buildLightweightBase(
        params.width,
        params.depth,
        params.wallThickness,
        dim.withMagnet,
        dim.withScrew,
        params.base.magnetDiameter / 2,
        params.base.magnetDepth,
        params.base.screwDiameter / 2,
        cupOpenDirection(dim),
        true, // full 5-section foot profile, matching buildBaseSocket here
        dim.halfSockets,
        pitch,
        params.cellMask,
        openFloorDrawings,
        { x: params.fractionalEdgeX, y: params.fractionalEdgeY },
        params.magnetAnchor
      );
      floorOpenings = liteBase.floorOpenings;
    }

    // ── BODY (box + optional lip) — cached by shellKey. ──────────────────────
    // `getShellCache` returns a metadata-preserving clone so BASE/LIP face-origin
    // tags survive the cache hit (the metadata rides on the shape, not on the
    // fresh per-generation `originToTag` map). For flat bins the body is the
    // whole shell; for socket bins the socket is added separately below.
    let body = getShellCache(dim.shellKey);
    if (!body) {
      checkCancelled(signal);
      onProgress?.('shell', 0.3);

      // Collar (issue #2500): the outer box + lip extrude to `boxWallHeight`
      // (nominal wall height + collar) while every interior feature stays
      // anchored to nominal `dim.wallHeight`. For solid/cutout bins the collar
      // is folded into `cutoutTopOffset` too, so the solid fill (the plane
      // cutouts carve from) tops out at the ORIGINAL plane and the collar is a
      // pure walled recess above it. Non-solid bins keep offset 0, so their
      // hollow cavity simply extends up into the collar as extra headroom.
      const boxWallHeight = dim.wallHeight + dim.collarHeight;
      const cutoutTopOffset = dim.solid ? params.cutoutConfig.topOffset + dim.collarHeight : 0;
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
        !(params.cellMask && maskHasHoles(params.cellMask)) &&
        // Tapered bins (#2933) take the fuse path on both kernels so the draft
        // preview matches the exact export — the integrated builder has no taper.
        !dim.overhang.taper;

      let built = withScope((scope: DisposalScope) => {
        // Wall-less tray: `boxWallHeight` is 0, and extruding a zero-length
        // vector is a kernel error, not an empty solid. The body is the floor
        // slab and nothing above it — `trayFloorHeight` of solid footprint,
        // exactly what `shell()` leaves under an ordinary bin's cavity.
        //
        // The slab is structural, not a nicety: `buildBaseSocket` sizes each
        // foot `CLEARANCE` narrower than its cell and rounds its corners, so
        // adjacent feet never meet. Without the slab the "floor" is one island
        // per cell with a through-slot along every internal grid line.
        if (dim.isTile) {
          const floor = buildBinBox(
            params.width,
            params.depth,
            dim.trayFloorHeight,
            params.wallThickness,
            true, // solid: a slab has no cavity to shell
            0, // no lowered fill — a tray has no interior to recess
            pitch,
            params.cellMask,
            undefined,
            undefined,
            dim.overhang
          );
          collectOrigins(floor, FeatureTag.BASE, originToTag);
          if (!dim.hasLip) return floor;

          // `includeLip: false` drops the angled support a lip normally hangs
          // BELOW its own base plane (to -LIP_TAPER_WIDTH) to blend into the
          // wall it sits on. A tray has no wall: that support would land inside
          // the foot's taper and back-fill it to full width, leaving a foot that
          // no longer seats in a baseplate. Without it the ring's underside is a
          // flat annulus bearing on the slab — fully supported to print, and the
          // outer face stays flush exactly as a wall's would.
          const lipBase = scope.register(
            buildTopShape(params.width, params.depth, false, pitch, params.cellMask, dim.overhang)
          );
          // Same `-LIP_OVERLAP` drop the fuse path below uses: without it the
          // ring merely TOUCHES the slab, and a coplanar contact fuses into a
          // non-manifold solid instead of a single watertight one.
          const top = scope.register(translate(lipBase, [0, 0, dim.trayFloorHeight - LIP_OVERLAP]));
          collectOrigins(top, FeatureTag.LIP, originToTag);
          scope.register(floor); // consumed by fuse
          return unwrap(fuse(floor, top));
        }

        if (integratedLip) {
          try {
            const integrated = buildBinBoxWithLip(
              params.width,
              params.depth,
              boxWallHeight,
              params.wallThickness,
              pitch,
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
          boxWallHeight,
          params.wallThickness,
          dim.solid,
          cutoutTopOffset,
          pitch,
          params.cellMask,
          compartmentCavityDrawings,
          compartmentCavityKey,
          dim.overhang
        );
        collectOrigins(binBody, FeatureTag.BASE, originToTag);

        if (dim.hasLip) {
          try {
            const lipBase = scope.register(
              buildTopShape(params.width, params.depth, true, pitch, params.cellMask, dim.overhang)
            );
            const top = scope.register(translate(lipBase, [0, 0, boxWallHeight - LIP_OVERLAP]));
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

      // Lightweight (hollow bins): open the body floor so the cavity sees each
      // cup recess. Consumed here on the cache-miss path; the cut result is what
      // gets cached, so a later cache hit already has the openings baked in.
      if (floorOpenings) {
        const opened = unwrap(cut(built as ValidSolid, floorOpenings as ValidSolid));
        if (opened !== built) built.delete();
        built = opened;
        floorOpenings.delete();
        floorOpenings = null;
      }

      // Dividers baked into the shell by the multi-cavity cut still run to the
      // rim, so a wall-to-wall label shelf would be sliced by the ones it
      // passes over (#2897). The cavity drawings are 2D and can't express a
      // partial height, so drop those divider tops here — before featuresStage
      // fuses the shelf, which a later cut pass would otherwise eat into.
      if (dim.compartmentsBakedIntoShell) {
        const clips = planSpanningDividerClips(
          params,
          dim.innerW,
          dim.innerD,
          dim.interiorHeight,
          params.wallThickness
        );
        const tools = buildSpanningDividerClipTools(
          clips,
          boxWallHeight + 1,
          dim.innerOffsetX,
          dim.innerOffsetY
        );
        // Best effort per tool: a divider left standing through the shelf is
        // cosmetically wrong, a failed shell is an unusable bin. Clips that
        // already succeeded stay applied.
        try {
          for (const tool of tools) {
            try {
              const clipped = unwrap(cut(built as ValidSolid, tool as ValidSolid));
              if (clipped !== built) built.delete();
              built = clipped;
            } catch (e: unknown) {
              if (isAbortError(e)) throw e;
            }
          }
        } finally {
          for (const tool of tools) tool.delete();
        }
      }

      setShellCache(dim.shellKey, built);
      // Metadata-preserving clone for the context (cache keeps `built`).
      body = translate(built, [0, 0, 0]);
    }

    // Cache hit already has the floor openings baked in — drop the unused tool.
    if (floorOpenings) {
      floorOpenings.delete();
    }

    // No socket under a flat base or a tray bottom — the body IS the whole
    // shell. A tray bin grows its lid skirt later, in `trayBottomStage`.
    if (dim.socketless) {
      return { ...ctx, solid: body, deferredSolid: null };
    }

    // ── BASE SOCKET — built separately (its own cache), optionally + feet. ───
    checkCancelled(signal);
    onProgress?.('features', 0.4);
    // Lightweight: the shelled cups (built up-front) stand in for the solid
    // socket. They fuse into the body at export and mesh alongside it at
    // preview exactly like the socket — they only meet the body at the floor
    // interface, never feature-cut.
    let socket = liteBase
      ? liteBase.base
      : buildBaseSocket(
          params.width,
          params.depth,
          dim.withMagnet,
          dim.withScrew,
          params.base.magnetDiameter / 2,
          params.base.magnetDepth,
          params.base.screwDiameter / 2,
          true, // Always use full 5-section socket profile (OCCT v8 is fast enough)
          dim.halfSockets,
          pitch,
          params.cellMask,
          { x: params.fractionalEdgeX, y: params.fractionalEdgeY },
          params.magnetAnchor
        );
    // `withScope` can't wrap this section (it must yield TWO survivors — body
    // and socket — on the preview path), so dispose manually on any throw to
    // match the exception-safety the scoped code had: a failed OCCT fuse must
    // not leak the body/socket/feet WASM handles.
    let feet: Shape3D | null = null;
    let feetFused = false;
    try {
      if (dim.overhang.feet && hasOverhang(dim.overhang)) {
        // Overhang feet are gap-fill tiling around the nominal grid (they don't
        // mate with baseplate sockets), so they keep the default 'end'
        // decomposition regardless of fractionalEdge — only the seam tiling at a
        // fractional edge differs cosmetically, never the socket mating.
        feet = buildOverhangFeet(params.width, params.depth, dim.overhang, pitch, true);
        if (feet) {
          const withFeet = unwrap(fuse(socket, feet));
          socket.delete();
          feet.delete();
          feet = null;
          socket = withFeet;
          feetFused = true;
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
      // The lightweight base (shelled cups) isn't a standard socket, so it can't
      // share the socket mesh cache — leave its key null to force a fresh mesh.
      const deferredSolidKey = liteBase
        ? null
        : `${baseSocketShapeKey(
            params.width,
            params.depth,
            dim.withMagnet,
            dim.withScrew,
            params.base.magnetDiameter / 2,
            params.base.magnetDepth,
            params.base.screwDiameter / 2,
            true,
            dim.halfSockets,
            pitch,
            params.cellMask,
            { x: params.fractionalEdgeX, y: params.fractionalEdgeY },
            params.magnetAnchor
          )}|${feetFused ? overhangKey(dim.overhang) : 'nofeet'}`;

      return { ...ctx, solid: body, deferredSolid: socket, deferredSolidKey };
    } catch (e: unknown) {
      socket.delete();
      body.delete();
      feet?.delete();
      throw e;
    }
  },
};
