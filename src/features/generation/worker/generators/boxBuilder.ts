/**
 * Box body and stacking lip builder for Gridfinity bins.
 *
 * Builds the bin box (rounded-rectangle extrusion, shelled from top)
 * and the stacking lip (loft-based with sweep fallback).
 *
 * Box coordinate system:
 * - Z=0: socket interface (bottom of box)
 * - Z=wallHeight: top of box walls
 */

import {
  drawRoundedRectangle,
  unwrap,
  clone,
  fuse,
  cut,
  cutAll,
  fuseAll,
  intersect,
  faceFinder,
  shell,
  withScope,
} from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope, Drawing } from 'brepjs';
import { SIZE, CLEARANCE, BOX_CORNER_RADIUS, COPLANAR_MARGIN, sketch } from './generatorTypes';
import { getBoxCache, setBoxCache } from './shapeCache';
import { buildCacheKey, quantize } from './cacheKeyUtils';
import { resolvePitch, pitchKeySegments, type GridUnitInput } from './gridPitch';
import { hashMask, isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import {
  hasOverhang,
  overhangExpansion,
  overhangKey,
  type ResolvedOverhang,
  type ResolvedTaper,
} from './overhang';
import {
  buildTaperedBox,
  buildTaperedInnerEnvelope,
  buildTaperedLofts,
  buildTaperedOuter,
} from './taperedOuter';
import { createLogger } from '@/core/logger';
import { buildMaskDrawing, buildMaskDrawingInset, buildMaskHoleDrawings } from './maskPolygon';
import { translateDrawing } from './boxTopShape';
export { buildTopShape } from './boxTopShape';

const logger = createLogger('boxBuilder');

/**
 * Whether a compartment footprint sits entirely within a rectangle. Used to
 * skip the clip against the tapered inner envelope for compartments that can
 * never reach the wall. Deliberately conservative — the epsilon errs toward
 * clipping, since a missed clip cuts a slot through the wall while a needless
 * one only costs time.
 */
function fitsInside(
  d: Drawing,
  rect: { minX: number; maxX: number; minY: number; maxY: number }
): boolean {
  const [min, max] = d.boundingBox.bounds;
  const eps = 1e-6;
  return (
    min[0] >= rect.minX - eps &&
    max[0] <= rect.maxX + eps &&
    min[1] >= rect.minY - eps &&
    max[1] <= rect.maxY + eps
  );
}

/**
 * Build a hollow-walls + closed-floor shell without relying on brepjs
 * `shell()`. brepjs 15.x's shell operation fails on concave-perimeter
 * solids (bins with L/T/U-shaped footprints), so we compose the shell
 * explicitly as `outer ⊖ inner` where:
 *   - outer: footprint extruded floor-to-top (Z=0 to Z=totalHeight)
 *   - inner: inner-footprint extruded from Z=wallThickness (top of
 *     floor) up past Z=totalHeight so the cut opens the top cleanly.
 * Used for every non-rectangular bin; rectangles keep the existing
 * shell() path because it's well-tested there.
 */
function buildHollowPolygon(
  scope: DisposalScope,
  footprint: Drawing,
  innerFootprint: Drawing,
  totalHeight: number,
  wallThickness: number,
  outerHoleDrawings: readonly Drawing[] = [],
  innerHoleDrawings: readonly Drawing[] = []
): Shape3D {
  const rawOuter = sketch(footprint, 'XY').extrude(totalHeight);
  const outer = scope.register(
    subtractHolesFromSolid(scope, rawOuter, outerHoleDrawings, totalHeight)
  );

  const rawInner = sketch(innerFootprint, 'XY', wallThickness).extrude(
    totalHeight - wallThickness + COPLANAR_MARGIN
  );
  const inner = scope.register(
    subtractHolesFromSolid(
      scope,
      rawInner,
      innerHoleDrawings,
      totalHeight - wallThickness + COPLANAR_MARGIN,
      wallThickness
    )
  );

  return unwrap(cut(outer, inner));
}

/**
 * Subtract each O-shape interior hole from a bin body as a 3D boolean
 * cut. Hole drawings carry the correct outward growth (CLEARANCE/2 for
 * the outer face, CLEARANCE/2 + wallThickness for the inner face). When
 * `holeDrawings` is empty this returns the input unchanged.
 *
 * `plugOriginZ` defaults to 0 (cut runs from the floor through the top)
 * and `plugHeight` is the height the plug extends — extruding a hair
 * past the bin height with `COPLANAR_MARGIN` keeps the coplanar top
 * face from breaking the cut.
 */
function subtractHolesFromSolid(
  scope: DisposalScope,
  body: Shape3D,
  holeDrawings: readonly Drawing[],
  plugHeight: number,
  plugOriginZ: number = 0
): Shape3D {
  if (holeDrawings.length === 0) return body;
  let result = body;
  for (const hole of holeDrawings) {
    const plug = scope.register(
      sketch(hole, 'XY', plugOriginZ).extrude(plugHeight + COPLANAR_MARGIN)
    );
    const next = unwrap(cut(result, plug));
    if (next !== result) {
      scope.register(result);
      result = next;
    }
  }
  return result;
}

/**
 * Build the bin box: a rounded-rectangle extrusion, shelled from the top.
 * The box starts at Z=0 (socket interface) and goes up to wallHeight.
 * Shell removes the top face, leaving walls + solid floor.
 *
 * When `cellMask` is provided and is not all-filled, the box is built from
 * the mask's polygon outline instead of a rectangle (sharp corners, no
 * outer fillet in v1). Undefined/full masks use the existing rectangle path.
 *
 * @param cutoutTopOffset - For solid mode: lowers the interior fill by this amount (mm)
 */
export function buildBinBox(
  gridW: number,
  gridD: number,
  wallHeight: number,
  wallThickness: number,
  solid: boolean,
  cutoutTopOffset: number = 0,
  gridUnitMm: GridUnitInput = SIZE,
  cellMask?: CellMask,
  /**
   * Per-compartment cavity drawings used by the multi-cavity cut path.
   * When provided with length > 1 (and `solid` is false, mask is rectangular),
   * the box is built as `outer − each cavity` instead of `outer ⊖ inner` +
   * fused dividers, so the divider walls are residue from the cut and meet
   * the cavity floor cleanly (no fuse T-junction). See `compartmentBuilder`
   * `buildCompartmentCavityDrawings` and.
   */
  compartmentCavityDrawings?: readonly Drawing[],
  compartmentCavityKey?: string,
  /**
   * Per-side outward expansion (mm) of the outer body. Grows the footprint
   * (and lowers the floor footprint) without touching the base sockets, so the
   * overhang region ends up with a flat bottom. Suppressed for polygon masks.
   */
  overhang?: ResolvedOverhang,
  /**
   * Interior floor thickness (mm) when it exceeds `wallThickness`. Applied after
   * the body is built, so all five hollowing paths get it from one place.
   */
  floorThickness?: number
): Shape3D {
  const polygon = isPartialMask(cellMask);
  const ov = polygon ? undefined : overhang;
  const exp = ov && hasOverhang(ov) ? overhangExpansion(ov) : null;
  const useMultiCavity =
    !solid &&
    !polygon &&
    compartmentCavityDrawings !== undefined &&
    compartmentCavityDrawings.length > 1;
  const pitch = resolvePitch(gridUnitMm);
  const boxKey = buildCacheKey(
    'v3',
    quantize(gridW),
    quantize(gridD),
    quantize(pitch.x),
    ...pitchKeySegments(pitch, quantize),
    quantize(wallHeight),
    quantize(wallThickness),
    solid,
    quantize(cutoutTopOffset),
    polygon ? hashMask(cellMask) : 'rect',
    useMultiCavity ? (compartmentCavityKey ?? 'comp') : 'none',
    ov ? overhangKey(ov) : '0',
    ...(floorThickness !== undefined && floorThickness > wallThickness
      ? [`floor${quantize(floorThickness)}`]
      : [])
  );
  const cached = getBoxCache(boxKey);
  if (cached) {
    return cached;
  }

  // Outer body grows by the per-side overhang; the asymmetry between opposite
  // sides shifts the footprint center so each wall lands at the right place.
  // The interior expands in lockstep (shell/inner offset use the same dims),
  // keeping wall thickness uniform — the extra material fills the drawer gap.
  const outerW = gridW * pitch.x - CLEARANCE + (exp?.addW ?? 0);
  const outerD = gridD * pitch.y - CLEARANCE + (exp?.addD ?? 0);
  const offX = exp?.offsetX ?? 0;
  const offY = exp?.offsetY ?? 0;

  /**
   * Footprint drawings: rounded rectangle for rectangular bins, polygon
   * (via mask) for custom shapes. The mask polygon already accounts for
   * CLEARANCE via its inward offset; inner offsets subtract `wallThickness`
   * directly. Built as factories so we only pay for a drawing when the
   * branch that needs it actually runs.
   */
  // Asymmetric overhang shifts the centered rounded-rect off the origin so the
  // wider side reaches further out; symmetric/zero overhang leaves it centered.
  const recenter = (d: Drawing): Drawing => translateDrawing(d, offX, offY);

  const makeFootprint = (): Drawing =>
    polygon
      ? buildMaskDrawing(cellMask, gridUnitMm)
      : recenter(drawRoundedRectangle(outerW, outerD, BOX_CORNER_RADIUS));

  const makeInnerFootprint = (): Drawing =>
    polygon
      ? buildMaskDrawingInset(cellMask, gridUnitMm, wallThickness)
      : recenter(
          drawRoundedRectangle(
            Math.max(outerW - 2 * wallThickness, 0.1),
            Math.max(outerD - 2 * wallThickness, 0.1),
            Math.max(BOX_CORNER_RADIUS - wallThickness, 0)
          )
        );

  // Holes in the mask (O-shape-style interiors) — pre-extracted so every
  // branch below can decide whether it needs to subtract them. Empty for
  // rectangular masks and simple non-rectangular masks without holes.
  //
  // The outer set uses CLEARANCE/2 of outward growth (clearance on the
  // cavity's outer face). The inner set grows by an extra wallThickness
  // so the hollow ring around the cavity has `wallThickness` of material.
  const outerHoleDrawings: readonly Drawing[] = polygon
    ? buildMaskHoleDrawings(cellMask, gridUnitMm)
    : [];
  const innerHoleDrawings: readonly Drawing[] = polygon
    ? buildMaskHoleDrawings(cellMask, gridUnitMm, CLEARANCE / 2 + wallThickness)
    : [];

  const raisesFloor = !solid && floorThickness !== undefined && floorThickness > wallThickness;

  return withScope((scope: DisposalScope) => {
    const rawBox = sketch(makeFootprint()).extrude(wallHeight);
    // Punch O-shape holes through the outer extrusion. When there are no
    // holes this is a no-op and returns the same shape. `subtractHolesFromSolid`
    // already registers intermediates with the scope via `scope.register`.
    const box = subtractHolesFromSolid(scope, rawBox, outerHoleDrawings, wallHeight);

    /**
     * The slab overlaps the existing floor top by COPLANAR_MARGIN — merely
     * meeting that face fuses non-manifold.
     *
     * Its footprint is rim-sized, so on a tapered body it has to be clipped to
     * the inner envelope: down at the floor the wall has narrowed away from the
     * rim, and the raw slab fuses on as a plate protruding past it.
     */
    const finish = (shape: Shape3D, taper?: ResolvedTaper | null): Shape3D => {
      if (!raisesFloor) return setBoxCache(boxKey, shape);
      const rawSlab = scope.register(
        sketch(makeInnerFootprint(), 'XY', wallThickness - COPLANAR_MARGIN).extrude(
          floorThickness - wallThickness + COPLANAR_MARGIN
        )
      );
      const slab = taper
        ? scope.register(
            unwrap(
              intersect(
                rawSlab as ValidSolid,
                scope.register(
                  buildTaperedInnerEnvelope(
                    outerW,
                    outerD,
                    wallHeight,
                    wallThickness,
                    taper,
                    floorThickness,
                    offX,
                    offY
                  )
                ) as ValidSolid
              )
            )
          )
        : rawSlab;
      const fused = unwrap(fuse(shape as ValidSolid, slab as ValidSolid));
      // Registering the cached shape would queue a delete on what the cache
      // hands out.
      if (fused !== shape) scope.register(shape);
      return setBoxCache(boxKey, fused);
    };

    // Solid mode: return the raw extrusion, optionally with lowered interior fill
    if (solid) {
      // A tapered solid bin is the outer loft with nothing removed —
      // there is no cavity, so the prism `box` is simply the wrong body. A
      // lowered fill surface becomes a recess CUT from that loft rather than
      // shell+fill+fuse: one solid, no coincident-face seam, and the
      // recess never has to be reconciled with a wall that narrows below it.
      if (ov?.taper) {
        try {
          const outer = buildTaperedOuter(
            scope,
            outerW,
            outerD,
            wallHeight,
            wallThickness,
            ov.taper,
            offX,
            offY
          );
          const fillHeight = wallHeight - cutoutTopOffset;
          if (cutoutTopOffset <= 0 || fillHeight <= 0) {
            scope.register(box); // unused on the taper path
            return finish(unwrap(clone(outer)));
          }
          // The recess spans fillHeight→past the rim. Above the band the wall is
          // prismatic, so a rim-sized inner footprint is exact there; a recess
          // reaching INTO the band would breach the narrowing wall, so clip it
          // to the inner envelope in that case.
          const rawRecess = scope.register(
            sketch(makeInnerFootprint(), 'XY', fillHeight).extrude(
              cutoutTopOffset + COPLANAR_MARGIN
            )
          );
          const recess =
            fillHeight < Math.min(ov.taper.bandHeight, wallHeight)
              ? scope.register(
                  unwrap(
                    intersect(
                      rawRecess as ValidSolid,
                      scope.register(
                        buildTaperedInnerEnvelope(
                          outerW,
                          outerD,
                          wallHeight,
                          wallThickness,
                          ov.taper,
                          wallHeight + COPLANAR_MARGIN,
                          offX,
                          offY
                        )
                      ) as ValidSolid
                    )
                  )
                )
              : rawRecess;
          const body = unwrap(cut(outer as ValidSolid, recess as ValidSolid));
          scope.register(box); // unused on the taper path
          return finish(body);
        } catch (e: unknown) {
          // Mirror the hollow taper branch: never lose the bin, but surface the
          // regression instead of silently shipping an untapered body.
          logger.warn('[buildBinBox] solid taper build failed; falling back to a plain box', {
            err: e instanceof Error ? e.message : String(e),
            width: gridW,
            depth: gridD,
          });
        }
      }
      if (cutoutTopOffset > 0) {
        let hollowWalls: Shape3D;
        if (polygon) {
          scope.register(box); // not consumed below; dispose via scope
          try {
            hollowWalls = buildHollowPolygon(
              scope,
              makeFootprint(),
              makeInnerFootprint(),
              wallHeight,
              wallThickness,
              outerHoleDrawings,
              innerHoleDrawings
            );
          } catch {
            // Narrow-feature polygon or degenerate inner offset — fall back
            // to the raw solid box so generation never crashes in
            // cutoutTopOffset mode. Mirrors the non-solid polygon branch.
            return finish(box);
          }
        } else {
          // Rectangular path — brepjs shell is reliable on convex perimeters.
          const topFaces = faceFinder()
            .parallelTo('Z')
            .atDistance(wallHeight, [0, 0, 0])
            .findAll(box);
          hollowWalls = unwrap(shell(box as ValidSolid, topFaces, wallThickness));
          scope.register(box); // consumed by shell
        }

        // Build interior solid block stopping at wallHeight - cutoutTopOffset
        const innerW = outerW - 2 * wallThickness;
        const innerD = outerD - 2 * wallThickness;
        const fillHeight = wallHeight - cutoutTopOffset;

        // Guard: if fillHeight or inner dimensions are non-positive, the interior fill
        // would produce degenerate geometry that crashes WASM. Return hollow walls only.
        if (fillHeight <= 0 || (!polygon && (innerW <= 0 || innerD <= 0))) {
          return finish(hollowWalls);
        }

        // For polygon masks the offset can collapse on narrow features or
        // oversized wallThickness; catch and fall back to hollow walls.
        let innerFill: Shape3D;
        try {
          const rawFill = sketch(makeInnerFootprint(), 'XY').extrude(fillHeight);
          // Punch O-shape holes through the interior fill too, grown by
          // wallThickness so the surrounding ring wall has material.
          innerFill = scope.register(
            subtractHolesFromSolid(scope, rawFill, innerHoleDrawings, fillHeight)
          );
        } catch {
          return finish(hollowWalls);
        }
        scope.register(hollowWalls); // consumed by fuse

        // Combine walls with lowered interior fill
        return finish(unwrap(fuse(hollowWalls, innerFill)));
      }
      // Standard solid mode: full solid block — box goes to cache, NOT registered
      return finish(box);
    }

    // Guard: if wall thickness leaves no interior, return the solid box.
    // For polygon masks we trust the inward offset; only rectangle path
    // can produce the degenerate condition this catches.
    if (!polygon) {
      const innerW = outerW - 2 * wallThickness;
      const innerD = outerD - 2 * wallThickness;
      if (innerW <= 0 || innerD <= 0) {
        return finish(box);
      }
    }

    if (useMultiCavity) {
      // Multi-cavity cut path: walls are the natural residue between cuts.
      // Each compartment cavity is extruded from Z=wallThickness up past the
      // top (COPLANAR_MARGIN clears the rim) and cut from the outer
      // extrusion. The resulting wall faces meet the cavity floor as part
      // of a single solid — no fuse seam, no non-manifold T-junction.
      try {
        // A tapered bin starts from the lofted outer instead of the prism, and
        // every compartment is clipped to the inner envelope first. Cutting a
        // rim-sized prism straight from a tapered outer would not just thin the
        // wall near the floor — below the band the prism spans the whole wall
        // thickness, so the cut opens a slot clean through it.
        const lofts = ov?.taper
          ? buildTaperedLofts(
              scope,
              outerW,
              outerD,
              wallHeight,
              wallThickness,
              ov.taper,
              offX,
              offY
            )
          : null;
        const solidBase = lofts?.outer ?? box;
        const cavityHeight = wallHeight - wallThickness + COPLANAR_MARGIN;
        // Only compartments that can reach the tapered wall are clipped, and
        // they are clipped as one fused group rather than individually — on a
        // 12x12 grid that is 1 intersect instead of 44, worth ~4s.
        //
        // Two alternatives measured slower on the same grid: clipping each
        // compartment separately (9.1s vs 5.1s), and taking the complement
        // twice (`cavity - compartments` = dividers, then `cavity - dividers`),
        // which is only two booleans but 19.2s — the intermediate divider solid
        // is far more complex than the compartments it came from.
        const plain: Shape3D[] = [];
        const needClip: Shape3D[] = [];
        for (const cavityDrawing of compartmentCavityDrawings) {
          const prism = scope.register(
            sketch(cavityDrawing, 'XY', wallThickness).extrude(cavityHeight)
          );
          if (lofts && !fitsInside(cavityDrawing, lofts.narrowestInner)) needClip.push(prism);
          else plain.push(prism);
        }
        const tools =
          lofts && needClip.length > 0
            ? [
                ...plain,
                scope.register(
                  unwrap(
                    intersect(
                      scope.register(unwrap(fuseAll(needClip as ValidSolid[]))),
                      lofts.cavity as ValidSolid
                    )
                  )
                ),
              ]
            : plain;
        // One multi-tool boolean rather than a cut per compartment: cutting
        // sequentially re-traverses the whole (growing) solid every time, which
        // dominates on a fine grid.
        const result = unwrap(cutAll(solidBase as ValidSolid, tools as ValidSolid[]));
        // `solidBase` is either `box` or `lofts.outer`, and both are already
        // owned by the scope — registering it again would queue a second
        // `delete()` on the same handle.
        scope.register(box);
        return finish(result, lofts ? ov?.taper : null);
      } catch (e: unknown) {
        // Defensive only — context.ts is supposed to gate this path with
        // `compartmentCavitiesAreViable` so cuts can't fail in practice.
        // If a cut does throw, fall through to the regular hollow-shell
        // path below so the bin is at least usable. The bin will be
        // divider-less (compartmentWallsFeature is also gated off when
        // `compartmentsBakedIntoShell` is true) — surface that via a
        // console warning so the silent degradation is observable in
        // dev/logs rather than only at the next user complaint.
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn('[buildBinBox] multi-cavity cut failed; bin will be built without dividers', {
          err: msg,
          width: gridW,
          depth: gridD,
          cavities: compartmentCavityDrawings.length,
        });
      }
    }

    if (polygon) {
      // Polygon path: compose shell explicitly — brepjs shell() fails on
      // concave perimeters. Caught error still falls back to solid so a
      // pathological narrow-feature mask never crashes generation.
      scope.register(box); // not consumed; dispose via scope
      try {
        return setBoxCache(
          boxKey,
          buildHollowPolygon(
            scope,
            makeFootprint(),
            makeInnerFootprint(),
            wallHeight,
            wallThickness,
            outerHoleDrawings,
            innerHoleDrawings
          )
        );
      } catch {
        return finish(box);
      }
    }

    // Tapered bins build the hollow body directly (outer − cavity loft,
    // no shell) — shell() is unreliable on a non-prismatic solid.
    if (ov?.taper) {
      try {
        const taperedBody = buildTaperedBox(
          scope,
          outerW,
          outerD,
          wallHeight,
          wallThickness,
          ov.taper,
          offX,
          offY
        );
        scope.register(box); // unused on the taper path
        return finish(taperedBody, ov.taper);
      } catch (e: unknown) {
        // Fall through to the plain shelled box below so the bin is never lost —
        // but surface it (like the multi-cavity fallback) so a taper regression
        // is observable in dev/logs rather than a silent loss of the feature.
        logger.warn('[buildBinBox] taper build failed; falling back to a plain shelled box', {
          err: e instanceof Error ? e.message : String(e),
          width: gridW,
          depth: gridD,
        });
      }
    }

    const topFaces = faceFinder().parallelTo('Z').atDistance(wallHeight, [0, 0, 0]).findAll(box);
    let result: Shape3D;
    try {
      result = unwrap(shell(box as ValidSolid, topFaces, wallThickness));
    } catch {
      return finish(box);
    }
    scope.register(box); // consumed by shell
    return finish(result);
  });
}

/**
 * Build the stacking lip using a ruled loft + boolean cut.
 *
 * Outer frustum is a rectangular tube flush with the bin wall (inset=0).
 * Inner frustum traces the lip profile's inner contour, including the
 * angled support face that the sweep version produces by sweeping the
 * lip-extension polygon: from INNER_BASE (2.6mm) at Z_EXT down to a
 * narrower inset (LIP_EXTENSION, 1.2mm) at Z_ANGLE_BOTTOM (-2.6mm).
 * After the loft is cut from the outer and fused with the bin wall, the
 * portion of the ring that overlaps the wall thickness is absorbed; what
 * remains is the visible lip overhang plus an angled support that goes
 * from zero overhang at Z_ANGLE_BOTTOM up to (LIP_TAPER_WIDTH −
 * wallThickness) overhang at Z_EXT — printable without supports.
 */
