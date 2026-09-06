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
 * went non-manifold (GH); see the socket-deferral note below.
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
import { FeatureTag } from '../../featureTags';
import { collectOrigins } from '../collectOrigins';
import { applyPinHoles, buildDetachableFeet } from '../../detachableFeetBuilder';
import { resolveDetachableFeet } from '@/shared/utils/detachableFeetPlan';
import { DETACHABLE_PIN_HOLE_DIAMETER_MM } from '@/shared/types/bin';

/**
 * Which way the lite cups open.
 *
 * A spacer opens BOTH ends, so each foot becomes a tube and the cell is a
 * clean through-hole; it never carries magnets or screws (`deriveDimensions`
 * suppresses them — a pad inside a through-hole would be free-standing).
 *
 * The inverted relief opens downward with nothing under the body floor, so the
 * floor itself caps the ring. It is checked before `dim.solid` because it
 * applies to solid bins too: `'down'` leaves a `wallThickness` membrane there
 * under a body that is already solid, which the relief drops. `'down'` survives
 * only as the interior mode's answer for a solid bin, so a design saved before
 * the mode existed still builds the geometry it was published with.
 */
function cupOpenDirection(dim: PipelineContext['dimensions']): LightweightOpenDirection {
  if (dim.isSpacer) return 'through';
  if (dim.undersideRelief) return 'underside';
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
    // socket used in the socket section below. Solid bins and the underside
    // relief open the cups downward (no floor opening — the body keeps its
    // floor, which is the whole point of the relief).
    let liteBase: LightweightBase | null = null;
    let floorOpenings: Shape3D | null = null;
    if (dim.lightweight && !dim.socketless) {
      // Open-cavity floor for clipping cup recesses away from divider walls, so a
      // divider crossing a cup keeps a solid foot core beneath it (no bridge over
      // the recess). Only for hollow bins with rectangular compartments; tilted/
      // polygon layouts fall back to no clip (best-effort).
      //
      // Gated on `liteFloorOpen`, not on `lightweight`: the underside relief
      // leaves the floor solid, so a divider crossing a relieved foot already
      // rests on continuous material and there is no recess to keep it out of.
      // Clipping there would only put solid cores back under every divider for
      // nothing. (A scoop is mutually exclusive with the floor-open mode, so
      // there is no scoop band to preserve on this path either.)
      const openFloorDrawings =
        dim.liteFloorOpen &&
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
        dim.socketCellPlan,
        pitch,
        params.cellMask,
        openFloorDrawings,
        { x: params.fractionalEdgeX, y: params.fractionalEdgeY },
        params.magnetAnchor,
        dim.floorThickness
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

      // Collar: the outer box + lip extrude to `boxWallHeight`
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
      // outer-wall faces undissolved → z-fighting at the rounded corners.
      // Build the body+lip as a single fuse-free solid instead, but only for the
      // common case the integrated builder covers; everything else keeps the
      // exact-faithful fuse below. Draft-only: the export path is an exact kernel.
      const integratedLip =
        dim.hasLip &&
        !dim.omitLipSolid &&
        !dim.solid &&
        !dim.compartmentsBakedIntoShell &&
        getKernelCapabilities().tessellationModel === 'build-time' &&
        !(params.cellMask && maskHasHoles(params.cellMask)) &&
        // Tapered bins take the fuse path on both kernels so the draft
        // preview matches the exact export — the integrated builder has no taper.
        !dim.overhang.taper &&
        // The integrated builder mirrors the angled support unconditionally, so a
        // wall too short to carry one has to take the fuse path, where
        // `buildTopShape` can be told to leave it off.
        dim.lipHasSupport;

      let built = withScope((scope: DisposalScope) => {
        // Base-only bin: `boxWallHeight` is 0, and extruding a zero-length
        // vector is a kernel error, not an empty solid. The body is the floor
        // slab and nothing above it — `tileFloorHeight` of solid footprint,
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
            dim.tileFloorHeight,
            // The slab IS the bin's wall here, so both arguments are the same
            // resolved thickness. Passing raw `params.wallThickness` would let a
            // crafted 0/NaN reach the box cache key and, on a tapered one,
            // `buildTaperedOuter` — the guard `tileFloorHeight` already applied.
            dim.tileFloorHeight,
            true, // solid: a slab has no cavity to shell
            0, // no lowered fill — there is no interior to recess
            pitch,
            params.cellMask,
            undefined,
            undefined,
            dim.overhang
          );
          collectOrigins(floor, FeatureTag.BASE, originToTag);
          if (!dim.hasLip || dim.omitLipSolid) return floor;

          // `includeLip: false` drops the angled support a lip normally hangs
          // BELOW its own base plane (to -LIP_TAPER_WIDTH) to blend into the
          // wall it sits on. There is no wall: that support would land inside
          // the foot's taper and back-fill it to full width, leaving a foot that
          // no longer seats in a baseplate. Without it the ring's underside is a
          // flat annulus bearing on the slab — fully supported to print, and the
          // outer face stays flush exactly as a wall's would.
          const lipBase = scope.register(
            buildTopShape(
              params.width,
              params.depth,
              // False here for every legal tile — the slab is at most
              // `MAX_WALL_THICKNESS` thick, short of the support's reach — but read
              // from the shared flag rather than hardcoded, so the rule lives in
              // one place and a thicker slab would be allowed a support on merit.
              dim.lipHasSupport,
              pitch,
              params.cellMask,
              dim.overhang
            )
          );
          // Seated ON the slab top: `buildTopShape` hangs its own material
          // below the base plane, so the fuse still gets a volume rather than
          // the coplanar contact that would come out non-manifold.
          const top = scope.register(translate(lipBase, [0, 0, dim.tileFloorHeight]));
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
              dim.overhang,
              dim.floorThickness
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
          dim.overhang,
          dim.floorThickness
        );
        collectOrigins(binBody, FeatureTag.BASE, originToTag);

        if (dim.hasLip && !dim.omitLipSolid) {
          try {
            const lipBase = scope.register(
              buildTopShape(
                params.width,
                params.depth,
                // NOT always true: on a wall shorter than the support's own reach
                // the wedge lands inside the socket's upper taper and back-fills
                // it, and the foot stops seating. `dim.lipHasSupport` owns that
                // test — a 1u bin, a spacer at the default height unit, and any
                // 2u bin at a 3mm height unit all fall below it.
                dim.lipHasSupport,
                pitch,
                params.cellMask,
                dim.overhang
              )
            );
            const top = scope.register(translate(lipBase, [0, 0, boxWallHeight]));
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
      // passes over. The cavity drawings are 2D and can't express a
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

    // ── DETACHABLE FEET — flat-bottomed body, blind pin holes in its floor. ──
    // The feet are a separate PART, not deferred geometry: `deferredSolid` is
    // fused into the body on the export path, which is exactly what must not
    // happen to something the user presses on afterwards. They are generated
    // and combined alongside the bin the way a lid is.
    //
    // Cutting here rather than before `setShellCache` is deliberate: only this
    // clone gets holed.
    if (dim.detachableFeet) {
      const resolved = resolveDetachableFeet(params);
      if (resolved.placements.length > 0) {
        const { feet, pinHoles } = buildDetachableFeet({
          placements: resolved.placements,
          armMm: resolved.armMm,
          pinDiameterMm: resolved.pinDiameterMm,
          pinHoleDiameterMm: DETACHABLE_PIN_HOLE_DIAMETER_MM,
          floorThicknessMm: dim.floorThickness,
          // Screws only: their bore also passes through the FLOOR, so the tool
          // this returns has to carry it. Magnets stay in the feet.
          screw: resolved.screw,
          forExport: true,
        });
        // The feet themselves are rebuilt by the parts generator; here only
        // their holes matter, so release them rather than carry them along.
        for (const f of feet) f.delete();
        body = applyPinHoles(body, pinHoles);
      }
      return { ...ctx, solid: body, deferredSolid: null };
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
          dim.socketCellPlan,
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
      // from the interface, so the exported STL was not watertight (GH).
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
            dim.socketCellPlan,
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
