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
  draw,
  drawRoundedRectangle,
  drawRectangle,
  unwrap,
  clone,
  fuse,
  cut,
  cutAll,
  fuseAll,
  intersect,
  fillet,
  faceFinder,
  edgeFinder,
  getBounds,
  shell,
  withScope,
} from 'brepjs';
import type { Shape3D, ValidSolid, Plane, Sketch, Vec3, DisposalScope, Drawing } from 'brepjs';
import {
  SIZE,
  CLEARANCE,
  BOX_CORNER_RADIUS,
  LIP_SMALL_TAPER,
  LIP_VERTICAL_PART,
  LIP_BIG_TAPER,
  LIP_HEIGHT,
  LIP_TAPER_WIDTH,
  LIP_OVERLAP,
  TOP_FILLET,
  COPLANAR_MARGIN,
  sketch,
} from './generatorTypes';
import { getBoxCache, setBoxCache, getLipCache, setLipCache } from './shapeCache';
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

const logger = createLogger('boxBuilder');

function translateDrawing(d: Drawing, offX: number, offY: number): Drawing {
  return offX !== 0 || offY !== 0 ? d.translate(offX, offY) : d;
}

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
function buildTopShapeLoft(
  outerW: number,
  outerD: number,
  includeLip: boolean,
  cellMask?: CellMask,
  gridUnitMm: GridUnitInput = SIZE,
  offX: number = 0,
  offY: number = 0
): Shape3D {
  const LIP_EXTENSION = includeLip ? 1.2 : 0;
  const polygon = isPartialMask(cellMask);

  const INNER_BASE = LIP_TAPER_WIDTH; // 2.6mm
  const INNER_MID = LIP_BIG_TAPER; // 1.9mm
  const INNER_TOP = 0;
  // Inset at the bottom of the angled support: matches the sweep profile,
  // where the support's inner edge sits at X = -LIP_EXTENSION (1.2mm).
  const INNER_ANGLE = LIP_EXTENSION;

  // Z_ANGLE_BOTTOM matches the sweep profile's deepest Y (-LIP_TAPER_WIDTH);
  // the angled support spans Z = [Z_ANGLE_BOTTOM, Z_EXT] = [-2.6, -1.2].
  const Z_ANGLE_BOTTOM = includeLip ? -LIP_TAPER_WIDTH : 0;
  const Z_EXT = -LIP_EXTENSION;
  const Z_BASE = 0;
  // Material below the base plane, so the caller can seat that plane ON the
  // wall top and still hand the fuse a volume to work with rather than two
  // touching faces. With a support there is already LIP_TAPER_WIDTH of it; the
  // supportless profile bottoms out at the base plane and needs the skirt.
  // Buried inside the wall either way, so it never reaches the silhouette.
  const Z_SKIRT = includeLip ? Z_ANGLE_BOTTOM : -LIP_OVERLAP;
  const Z_TAPER1 = LIP_SMALL_TAPER; // 0.7
  const Z_VERT = LIP_SMALL_TAPER + LIP_VERTICAL_PART; // 2.5
  const Z_PEAK = LIP_HEIGHT; // 4.4

  const sectionAt = (z: number, inset: number): Sketch => {
    if (polygon) {
      // Polygon path: offset mask drawing inward by `inset`.
      // inset === 0 returns the outer drawing directly.
      const d =
        inset === 0
          ? buildMaskDrawing(cellMask, gridUnitMm)
          : buildMaskDrawingInset(cellMask, gridUnitMm, inset);
      return d.sketchOnPlane('XY', z) as Sketch;
    }
    const w = outerW - 2 * inset;
    const d = outerD - 2 * inset;
    const r = Math.max(BOX_CORNER_RADIUS - inset, 0.1);
    const rect = drawRoundedRectangle(w, d, r);
    return translateDrawing(rect, offX, offY).sketchOnPlane('XY', z) as Sketch;
  };

  // Outer: rectangular tube at bin outer edge (2 sections → no extra edges)
  const zBottom = Z_SKIRT;
  const outerSections: Sketch[] = [sectionAt(zBottom, 0), sectionAt(Z_PEAK, 0)];

  // For O-shape footprints, pre-compute the hole drawings at every inset
  // level the loft sections need. holesCavity matches the cavity boundary
  // (bin's outer face); holesInnerAngle/Base/Mid are the same boundary grown
  // further into the filled material by the corresponding lip offsets.
  // holesInnerAngle is only needed when stacking is included (its only
  // consumer is inside `if (includeLip)`), so skip the offset-and-tessellate
  // work for non-stacking bins.
  const holesCavity = polygon ? buildMaskHoleDrawings(cellMask, gridUnitMm) : [];
  const holesInnerAngle =
    polygon && includeLip
      ? buildMaskHoleDrawings(cellMask, gridUnitMm, CLEARANCE / 2 + INNER_ANGLE)
      : [];
  const holesInnerBase = polygon
    ? buildMaskHoleDrawings(cellMask, gridUnitMm, CLEARANCE / 2 + INNER_BASE)
    : [];
  const holesInnerMid = polygon
    ? buildMaskHoleDrawings(cellMask, gridUnitMm, CLEARANCE / 2 + INNER_MID)
    : [];

  return withScope((scope: DisposalScope) => {
    const [outerFirst, ...outerRest] = outerSections;
    const outerFrustum = scope.register(outerFirst.loftWith(outerRest, { ruled: true }));

    // Inner: tapered frustum tracing the lip profile, including the angled
    // support face below Z_EXT.
    const innerSections: Sketch[] = [];
    if (includeLip) {
      innerSections.push(sectionAt(Z_ANGLE_BOTTOM, INNER_ANGLE));
      innerSections.push(sectionAt(Z_EXT, INNER_BASE));
    } else {
      // Matches the outer tube's bottom, so the skirt comes out as a ring. Let
      // the inner loft start at the base plane instead and the cut leaves the
      // skirt solid: a 0.1mm membrane sealing the bin's mouth.
      innerSections.push(sectionAt(Z_SKIRT, INNER_BASE));
    }
    innerSections.push(sectionAt(Z_BASE, INNER_BASE));
    innerSections.push(sectionAt(Z_TAPER1, INNER_MID));
    innerSections.push(sectionAt(Z_VERT, INNER_MID));
    innerSections.push(sectionAt(Z_PEAK, INNER_TOP));

    const [innerFirst, ...innerRest] = innerSections;
    const innerFrustum = scope.register(innerFirst.loftWith(innerRest, { ruled: true }));

    // Boolean subtract inner from outer to create hollow ring
    let result = unwrap(cut(outerFrustum, innerFrustum));

    // Add a lip ring around each interior hole. Mirrors the outer lip's
    // profile, including the angled support: the lip's "outer" face (facing
    // the filled material) grows from INNER_ANGLE at Z_ANGLE_BOTTOM, through
    // INNER_BASE at Z_EXT/Z_BASE, to 0 at Z_PEAK; its "inner" face (facing
    // the cavity) stays at the cavity boundary. cut(outerFrustum,
    // innerFrustum) is then fused onto the outer lip so a bin stacked on
    // top sits flush over both the outer perimeter and the hole.
    for (let h = 0; h < holesCavity.length; h++) {
      const cavity = holesCavity[h];
      const atAngle = holesInnerAngle[h];
      const atBase = holesInnerBase[h];
      const atMid = holesInnerMid[h];

      const bigSections: Sketch[] = [];
      if (includeLip) {
        bigSections.push(atAngle.sketchOnPlane('XY', Z_ANGLE_BOTTOM) as Sketch);
        bigSections.push(atBase.sketchOnPlane('XY', Z_EXT) as Sketch);
      } else {
        bigSections.push(atBase.sketchOnPlane('XY', Z_SKIRT) as Sketch);
      }
      bigSections.push(atBase.sketchOnPlane('XY', Z_BASE) as Sketch);
      bigSections.push(atMid.sketchOnPlane('XY', Z_TAPER1) as Sketch);
      bigSections.push(atMid.sketchOnPlane('XY', Z_VERT) as Sketch);
      bigSections.push(cavity.sketchOnPlane('XY', Z_PEAK) as Sketch);

      const smallSections: Sketch[] = [
        cavity.sketchOnPlane('XY', zBottom) as Sketch,
        cavity.sketchOnPlane('XY', Z_PEAK) as Sketch,
      ];

      const [bigFirst, ...bigRest] = bigSections;
      const big = scope.register(bigFirst.loftWith(bigRest, { ruled: true }));
      const [smallFirst, ...smallRest] = smallSections;
      const small = scope.register(smallFirst.loftWith(smallRest, { ruled: true }));
      const holeRing = scope.register(unwrap(cut(big, small)));
      scope.register(result); // consumed by fuse
      result = unwrap(fuse(result, holeRing));
    }

    // Fillet the peak edge (only when TOP_FILLET > 0; spec default is 0)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- TOP_FILLET is a tunable constant; default is 0 but build can override
    if (TOP_FILLET > 0) {
      const lipEdges = edgeFinder()
        .when((e) => {
          const bounds = getBounds(e);
          return bounds.zMax >= Z_PEAK - 1 && bounds.zMin <= Z_PEAK;
        })
        .findAll(result);

      if (lipEdges.length > 0) {
        scope.register(result); // consumed by fillet
        result = unwrap(fillet(result as ValidSolid, lipEdges, TOP_FILLET));
      }
    }

    return result;
  });
}

/**
 * Build the stacking lip using sweep (robust fallback).
 *
 * Sweeps the lip profile around the bin perimeter, then fillets the peak.
 * This creates NURBS surfaces that are slower for brepkit but robust for OCCT.
 */
function buildTopShapeSweep(
  outerW: number,
  outerD: number,
  includeLip: boolean,
  cellMask?: CellMask,
  gridUnitMm: GridUnitInput = SIZE,
  offX: number = 0,
  offY: number = 0
): Shape3D {
  const polygon = isPartialMask(cellMask);
  const topProfile = (plane: Plane, _origin: Vec3): Sketch => {
    let sketcher = draw([-LIP_TAPER_WIDTH, 0])
      .line(LIP_SMALL_TAPER, LIP_SMALL_TAPER)
      .vLine(LIP_VERTICAL_PART)
      .line(LIP_BIG_TAPER, LIP_BIG_TAPER);

    if (includeLip) {
      const LIP_EXTENSION = 1.2;
      sketcher = sketcher
        .vLineTo(-(LIP_TAPER_WIDTH + LIP_EXTENSION))
        .lineTo([-LIP_TAPER_WIDTH, -LIP_EXTENSION]);
    } else {
      // Down past the base plane by LIP_OVERLAP and back, the skirt the loft
      // path builds. Both paths have to hand the caller the same solid, or
      // whether the loft threw would decide how tall the bin comes out.
      sketcher = sketcher.vLineTo(-LIP_OVERLAP).hLineTo(-LIP_TAPER_WIDTH);
    }

    const basicShape = sketcher.close();

    let topProfileShape = basicShape.intersect(
      drawRoundedRectangle(10, 10).translate(-5, includeLip ? 0 : 5 - LIP_OVERLAP)
    );

    if (includeLip) {
      const LIP_EXTENSION = 1.2;
      topProfileShape = topProfileShape.cut(
        drawRectangle(LIP_EXTENSION, 10).translate(-LIP_EXTENSION / 2, -5)
      );
    }

    return topProfileShape.sketchOnPlane(plane) as Sketch;
  };

  // O-shape lip around any interior holes. `buildMaskDrawing` returns the
  // outer perimeter only (no 2D hole cut), so the sweep would otherwise
  // skip the cavity. Sweep the hole boundaries too and fuse onto the
  // outer lip so a bin stacked on top mates across the hole.
  const holeDrawings = polygon ? buildMaskHoleDrawings(cellMask, gridUnitMm) : [];

  return withScope((scope: DisposalScope) => {
    const outerRect = drawRoundedRectangle(outerW, outerD, BOX_CORNER_RADIUS);
    const boxSketch = polygon
      ? (buildMaskDrawing(cellMask, gridUnitMm).sketchOnPlane() as Sketch)
      : (translateDrawing(outerRect, offX, offY).sketchOnPlane() as Sketch);
    let swept: Shape3D = boxSketch.sweepSketch(topProfile, { withContact: true });

    for (const hole of holeDrawings) {
      const holeSketch = hole.sketchOnPlane() as Sketch;
      const holeLip = scope.register(holeSketch.sweepSketch(topProfile, { withContact: true }));
      scope.register(swept);
      swept = unwrap(fuse(swept, holeLip));
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- TOP_FILLET is a tunable constant; default is 0 but build can override
    if (TOP_FILLET > 0) {
      const lipEdges = edgeFinder()
        .when((e) => {
          const bounds = getBounds(e);
          return bounds.zMax >= LIP_HEIGHT - 1 && bounds.zMin <= LIP_HEIGHT;
        })
        .findAll(swept);

      if (lipEdges.length > 0) {
        scope.register(swept); // consumed by fillet
        return unwrap(fillet(swept as ValidSolid, lipEdges, TOP_FILLET));
      }
    }
    return swept;
  });
}

/**
 * Build the stacking lip at the top of the bin.
 *
 * Uses loft-cut for all kernels: constructs explicit rounded-rectangle
 * cross-sections at each profile breakpoint, avoiding an OCCT sweep bug
 * that flips the profile on non-square spines. Sweep retained as
 * fallback if loft throws.
 *
 * Profile per Gridfinity spec v5: 0.7mm + 1.8mm + 1.9mm = 4.4mm total height.
 * The base plane is Z=0 locally and the caller translates it to the wall top,
 * so the peak lands exactly `LIP_HEIGHT` above it. Material hangs BELOW Z=0
 * (the angled support, or `LIP_OVERLAP` of skirt without one) to give the fuse
 * a volume; it is buried in the wall and never reaches the silhouette.
 */
export function buildTopShape(
  gridW: number,
  gridD: number,
  includeLip: boolean,
  gridUnitMm: GridUnitInput = SIZE,
  cellMask?: CellMask,
  overhang?: ResolvedOverhang
): Shape3D {
  const polygon = isPartialMask(cellMask);
  // Overhang is suppressed for polygon masks (the mask defines the footprint).
  const ov = polygon ? undefined : overhang;
  const exp = ov && hasOverhang(ov) ? overhangExpansion(ov) : null;
  const pitch = resolvePitch(gridUnitMm);
  const lipKey = buildCacheKey(
    'v5',
    quantize(gridW),
    quantize(gridD),
    quantize(pitch.x),
    ...pitchKeySegments(pitch, quantize),
    includeLip,
    polygon ? hashMask(cellMask) : 'rect',
    ov ? overhangKey(ov) : '0'
  );
  const cached = getLipCache(lipKey);
  if (cached) {
    return cached;
  }

  // Lip grows with the body so a bin stacked on top still mates flush across
  // the full (overhung) perimeter.
  const outerW = gridW * pitch.x - CLEARANCE + (exp?.addW ?? 0);
  const outerD = gridD * pitch.y - CLEARANCE + (exp?.addD ?? 0);
  const offX = exp?.offsetX ?? 0;
  const offY = exp?.offsetY ?? 0;

  // Loft-cut for all kernels: produces analytic surfaces and avoids an OCCT
  // BRepOffsetAPI_MakePipeShell bug where the profile direction flips on
  // certain non-square aspect ratios, causing the lip to overhang.
  let result: Shape3D;
  try {
    result = buildTopShapeLoft(outerW, outerD, includeLip, cellMask, gridUnitMm, offX, offY);
  } catch {
    // Loft failed — fall back to sweep path (kernel regression).
    // NOTE: sweep has the OCCT profile-flip bug on non-square spines
    result = buildTopShapeSweep(outerW, outerD, includeLip, cellMask, gridUnitMm, offX, offY);
  }

  return setLipCache(lipKey, result);
}
