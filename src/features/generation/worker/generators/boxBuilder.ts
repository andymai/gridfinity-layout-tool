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
  getKernel,
  withScope,
} from 'brepjs';
import type { Shape3D, Plane, Vec3, Sketch, DisposalScope } from 'brepjs';
import {
  SIZE,
  CLEARANCE,
  CORNER_RADIUS,
  LIP_SMALL_TAPER,
  LIP_VERTICAL_PART,
  LIP_BIG_TAPER,
  LIP_HEIGHT,
  LIP_TAPER_WIDTH,
  TOP_FILLET,
  sketch,
} from './generatorTypes';
import { getBoxCache, setBoxCache, getLipCache, setLipCache } from './shapeCache';
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
  cutoutTopOffset: number = 0
): Shape3D {
  const boxKey = `${gridW}|${gridD}|${wallHeight}|${wallThickness}|${solid}|${cutoutTopOffset}`;
  const cached = getBoxCache(boxKey);
  if (cached) {
    return cached;
  }

  const outerW = gridW * SIZE - CLEARANCE;
  const outerD = gridD * SIZE - CLEARANCE;

  return withScope((scope: DisposalScope) => {
    const box = sketch(drawRoundedRectangle(outerW, outerD, CORNER_RADIUS)).extrude(wallHeight);

    // Solid mode: return the raw extrusion, optionally with lowered interior fill
    if (solid) {
      if (cutoutTopOffset > 0) {
        // Build hollow walls extending to full wallHeight
        const topFaces = faceFinder()
          .parallelTo('Z')
          .atDistance(wallHeight, [0, 0, 0])
          .findAll(box);
        const hollowWalls = unwrap(shell(box, topFaces, wallThickness));
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
            drawRoundedRectangle(innerW, innerD, Math.max(0, CORNER_RADIUS - wallThickness)),
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
    const result = unwrap(shell(box, topFaces, wallThickness));
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
    const r = Math.max(CORNER_RADIUS - inset, 0.1);
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

    // Fillet the peak edge
    const lipEdges = edgeFinder()
      .when((e) => {
        const bounds = getBounds(e);
        return bounds.zMax >= Z_PEAK - 1 && bounds.zMin <= Z_PEAK;
      })
      .findAll(result);

    if (lipEdges.length > 0) {
      scope.register(result); // consumed by fillet
      result = unwrap(fillet(result, lipEdges, TOP_FILLET));
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
    const boxSketch = drawRoundedRectangle(outerW, outerD, CORNER_RADIUS).sketchOnPlane() as Sketch;
    const swept = scope.register(boxSketch.sweepSketch(topProfile, { withContact: true }));

    const lipEdges = edgeFinder()
      .when((e) => {
        const bounds = getBounds(e);
        return bounds.zMax >= LIP_HEIGHT - 1 && bounds.zMin <= LIP_HEIGHT;
      })
      .findAll(swept);

    return unwrap(fillet(swept, lipEdges, TOP_FILLET));
  });
}

/**
 * Build the stacking lip at the top of the bin.
 *
 * Uses kernel-optimized construction:
 * - brepkit: loft + boolean cut (analytic surfaces, avoids slow shell)
 * - OCCT: sweep + fillet (robust, avoids loft-shell failures)
 *
 * Profile per Gridfinity spec v5: 0.7mm + 1.8mm + 1.9mm = 4.4mm total height.
 * Built at Z=0 locally, caller translates to wallHeight.
 */
export function buildTopShape(gridW: number, gridD: number, includeLip: boolean): Shape3D {
  const lipKey = `${gridW}|${gridD}|${includeLip}`;
  const cached = getLipCache(lipKey);
  if (cached) {
    return cached;
  }

  const outerW = gridW * SIZE - CLEARANCE;
  const outerD = gridD * SIZE - CLEARANCE;

  let result: Shape3D;
  if (getKernel().kernelId === 'brepkit') {
    // brepkit: loft-cut is ~5-50x faster than sweep (analytic surfaces)
    try {
      result = buildTopShapeLoft(outerW, outerD, includeLip);
    } catch (e: unknown) {
      // Loft failed — fall back to sweep path. Log for diagnostics since this
      // indicates a kernel regression (loft should always succeed).
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[boxBuilder] brepkit loft failed, falling back to sweep: ${msg}`);
      result = buildTopShapeSweep(outerW, outerD, includeLip);
    }
  } else {
    // OCCT: sweep is faster and more robust (loft-shell fails, loft-cut is slow)
    result = buildTopShapeSweep(outerW, outerD, includeLip);
  }

  return setLipCache(lipKey, result);
}
