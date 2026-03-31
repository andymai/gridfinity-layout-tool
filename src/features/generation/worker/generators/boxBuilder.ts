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
  fuse,
  cut,
  fillet,
  faceFinder,
  edgeFinder,
  getBounds,
  shell,
  withScope,
} from 'brepjs';
import type { Shape3D, ValidSolid, Plane, Vec3, Sketch, DisposalScope } from 'brepjs';
import {
  SIZE,
  CLEARANCE,
  BOX_CORNER_RADIUS,
  LIP_SMALL_TAPER,
  LIP_VERTICAL_PART,
  LIP_BIG_TAPER,
  LIP_HEIGHT,
  LIP_TAPER_WIDTH,
  TOP_FILLET,
  sketch,
} from './generatorTypes';
import { getBoxCache, setBoxCache, getLipCache, setLipCache } from './shapeCache';
import { buildCacheKey, quantize } from './cacheKeyUtils';
/**
 * Build the bin box: a rounded-rectangle extrusion, shelled from the top.
 * The box starts at Z=0 (socket interface) and goes up to wallHeight.
 * Shell removes the top face, leaving walls + solid floor.
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
  gridUnitMm: number = SIZE
): Shape3D {
  const boxKey = buildCacheKey(
    'v2',
    quantize(gridW),
    quantize(gridD),
    quantize(gridUnitMm),
    quantize(wallHeight),
    quantize(wallThickness),
    solid,
    quantize(cutoutTopOffset)
  );
  const cached = getBoxCache(boxKey);
  if (cached) {
    return cached;
  }

  const outerW = gridW * gridUnitMm - CLEARANCE;
  const outerD = gridD * gridUnitMm - CLEARANCE;

  return withScope((scope: DisposalScope) => {
    const box = sketch(drawRoundedRectangle(outerW, outerD, BOX_CORNER_RADIUS)).extrude(wallHeight);

    // Solid mode: return the raw extrusion, optionally with lowered interior fill
    if (solid) {
      if (cutoutTopOffset > 0) {
        // Build hollow walls extending to full wallHeight
        const topFaces = faceFinder()
          .parallelTo('Z')
          .atDistance(wallHeight, [0, 0, 0])
          .findAll(box);
        const hollowWalls = unwrap(shell(box as ValidSolid, topFaces, wallThickness));
        scope.register(box); // consumed by shell

        // Build interior solid block stopping at wallHeight - cutoutTopOffset
        const innerW = outerW - 2 * wallThickness;
        const innerD = outerD - 2 * wallThickness;
        const fillHeight = wallHeight - cutoutTopOffset;

        // Guard: if fillHeight or inner dimensions are non-positive, the interior fill
        // would produce degenerate geometry that crashes WASM. Return hollow walls only.
        if (fillHeight <= 0 || innerW <= 0 || innerD <= 0) {
          return setBoxCache(boxKey, hollowWalls);
        }

        const innerFill = scope.register(
          sketch(
            drawRoundedRectangle(innerW, innerD, Math.max(0, BOX_CORNER_RADIUS - wallThickness)),
            'XY'
          ).extrude(fillHeight)
        );
        scope.register(hollowWalls); // consumed by fuse

        // Combine walls with lowered interior fill
        return setBoxCache(boxKey, unwrap(fuse(hollowWalls, innerFill)));
      }
      // Standard solid mode: full solid block — box goes to cache, NOT registered
      return setBoxCache(boxKey, box);
    }

    const topFaces = faceFinder().parallelTo('Z').atDistance(wallHeight, [0, 0, 0]).findAll(box);
    const result = unwrap(shell(box as ValidSolid, topFaces, wallThickness));
    scope.register(box); // consumed by shell
    return setBoxCache(boxKey, result);
  });
}
/**
 * Build the stacking lip using a ruled loft + boolean cut (fast path).
 *
 * Constructs the lip taper as a ruled loft through rounded-rectangle sections
 * at each profile breakpoint, then boolean-subtracts an inner frustum to create
 * a hollow ring. This produces analytic surfaces (planar + conical) instead of
 * the NURBS surfaces from sweepSketch, making it dramatically faster for boolean
 * and tessellation — especially with the brepkit kernel.
 */
function buildTopShapeLoft(outerW: number, outerD: number, includeLip: boolean): Shape3D {
  const LIP_EXTENSION = includeLip ? 1.2 : 0;
  const WALL = LIP_TAPER_WIDTH; // 2.6mm wall thickness

  // Insets from outer edge at each profile breakpoint
  const INSET_BOTTOM = LIP_TAPER_WIDTH; // 2.6mm
  const INSET_MID = LIP_BIG_TAPER; // 1.9mm
  const INSET_TOP = 0; // 0mm (peak at outer edge)

  const Z_EXT = -LIP_EXTENSION;
  const Z_BASE = 0;
  const Z_TAPER1 = LIP_SMALL_TAPER; // 0.7
  const Z_VERT = LIP_SMALL_TAPER + LIP_VERTICAL_PART; // 2.5
  const Z_PEAK = LIP_HEIGHT; // 4.4

  const sectionAt = (z: number, inset: number): Sketch => {
    const w = outerW - 2 * inset;
    const d = outerD - 2 * inset;
    const r = Math.max(BOX_CORNER_RADIUS - inset, 0.1);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
  };

  // Build outer frustum
  const outerSections: Sketch[] = [];
  if (includeLip) {
    outerSections.push(sectionAt(Z_EXT, INSET_BOTTOM));
  }
  outerSections.push(sectionAt(Z_BASE, INSET_BOTTOM));
  outerSections.push(sectionAt(Z_TAPER1, INSET_MID));
  outerSections.push(sectionAt(Z_VERT, INSET_MID));
  outerSections.push(sectionAt(Z_PEAK, INSET_TOP));

  return withScope((scope: DisposalScope) => {
    const [outerFirst, ...outerRest] = outerSections;
    const outerFrustum = scope.register(outerFirst.loftWith(outerRest, { ruled: true }));

    // Build inner frustum (offset inward by wall thickness)
    const innerSections: Sketch[] = [];
    if (includeLip) {
      innerSections.push(sectionAt(Z_EXT, INSET_BOTTOM + WALL));
    }
    innerSections.push(sectionAt(Z_BASE, INSET_BOTTOM + WALL));
    innerSections.push(sectionAt(Z_TAPER1, INSET_MID + WALL));
    innerSections.push(sectionAt(Z_VERT, INSET_MID + WALL));
    innerSections.push(sectionAt(Z_PEAK, INSET_TOP + WALL));

    const [innerFirst, ...innerRest] = innerSections;
    const innerFrustum = scope.register(innerFirst.loftWith(innerRest, { ruled: true }));

    // Boolean subtract inner from outer to create hollow ring
    let result = unwrap(cut(outerFrustum, innerFrustum));

    // Fillet the peak edge (only when TOP_FILLET > 0; spec default is 0)
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
function buildTopShapeSweep(outerW: number, outerD: number, includeLip: boolean): Shape3D {
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
      sketcher = sketcher.vLineTo(0);
    }

    const basicShape = sketcher.close();

    let topProfileShape = basicShape.intersect(
      drawRoundedRectangle(10, 10).translate(-5, includeLip ? 0 : 5)
    );

    if (includeLip) {
      const LIP_EXTENSION = 1.2;
      topProfileShape = topProfileShape.cut(
        drawRectangle(LIP_EXTENSION, 10).translate(-LIP_EXTENSION / 2, -5)
      );
    }

    return topProfileShape.sketchOnPlane(plane) as Sketch;
  };

  return withScope((scope: DisposalScope) => {
    const boxSketch = drawRoundedRectangle(
      outerW,
      outerD,
      BOX_CORNER_RADIUS
    ).sketchOnPlane() as Sketch;
    const swept = boxSketch.sweepSketch(topProfile, { withContact: true });

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
 * Uses loft-cut for all kernels: constructs explicit cross-sections at each
 * profile breakpoint so the lip matches the box outer bounds exactly.
 * Falls back to sweep if the loft fails (produces oversized lip on non-square
 * bins due to OCCT profile orientation issues — logged as a warning).
 *
 * Profile per Gridfinity spec v5: 0.7mm + 1.8mm + 1.9mm = 4.4mm total height.
 * Built at Z=0 locally, caller translates to wallHeight.
 */
export function buildTopShape(
  gridW: number,
  gridD: number,
  includeLip: boolean,
  gridUnitMm: number = SIZE
): Shape3D {
  const lipKey = buildCacheKey(
    'v3',
    quantize(gridW),
    quantize(gridD),
    quantize(gridUnitMm),
    includeLip
  );
  const cached = getLipCache(lipKey);
  if (cached) {
    return cached;
  }

  const outerW = gridW * gridUnitMm - CLEARANCE;
  const outerD = gridD * gridUnitMm - CLEARANCE;

  // Loft-cut for all kernels — explicit cross-sections keep the lip within box
  // bounds. Sweep fallback may overshoot on non-square bins (OCCT profile bug).
  let result: Shape3D;
  try {
    result = buildTopShapeLoft(outerW, outerD, includeLip);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[boxBuilder] loft failed, falling back to sweep: ${msg}`);
    result = buildTopShapeSweep(outerW, outerD, includeLip);
  }

  return setLipCache(lipKey, result);
}
