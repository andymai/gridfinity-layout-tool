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
  TOP_FILLET,
  sketch,
} from './generatorTypes';
import { getBoxCache, setBoxCache, getLipCache, setLipCache } from './shapeCache';
import { buildCacheKey, quantize } from './cacheKeyUtils';
import { hashMask, isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import { buildMaskDrawing, buildMaskDrawingInset } from './maskPolygon';
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
  gridUnitMm: number = SIZE,
  cellMask?: CellMask
): Shape3D {
  const polygon = isPartialMask(cellMask);
  const boxKey = buildCacheKey(
    'v2',
    quantize(gridW),
    quantize(gridD),
    quantize(gridUnitMm),
    quantize(wallHeight),
    quantize(wallThickness),
    solid,
    quantize(cutoutTopOffset),
    polygon ? hashMask(cellMask) : 'rect'
  );
  const cached = getBoxCache(boxKey);
  if (cached) {
    return cached;
  }

  const outerW = gridW * gridUnitMm - CLEARANCE;
  const outerD = gridD * gridUnitMm - CLEARANCE;

  /**
   * Footprint sketch: rounded rectangle for rectangular bins, polygon
   * (via mask) for custom shapes. The mask polygon already accounts for
   * CLEARANCE via its inward offset; inner offsets below subtract
   * `wallThickness` directly.
   */
  const footprint = (): Drawing =>
    polygon
      ? buildMaskDrawing(cellMask, gridUnitMm)
      : drawRoundedRectangle(outerW, outerD, BOX_CORNER_RADIUS);

  const innerFootprint = (): Drawing =>
    polygon
      ? buildMaskDrawingInset(cellMask, gridUnitMm, wallThickness)
      : drawRoundedRectangle(
          Math.max(outerW - 2 * wallThickness, 0.1),
          Math.max(outerD - 2 * wallThickness, 0.1),
          Math.max(BOX_CORNER_RADIUS - wallThickness, 0)
        );

  return withScope((scope: DisposalScope) => {
    const box = sketch(footprint()).extrude(wallHeight);

    // Solid mode: return the raw extrusion, optionally with lowered interior fill
    if (solid) {
      if (cutoutTopOffset > 0) {
        // Build hollow walls extending to full wallHeight.
        // Faces returned by faceFinder come from the per-shape topology
        // cache and share their parent shape's lifecycle — do not dispose.
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
        if (fillHeight <= 0 || (!polygon && (innerW <= 0 || innerD <= 0))) {
          return setBoxCache(boxKey, hollowWalls);
        }

        // For polygon masks the offset can collapse on narrow features or
        // oversized wallThickness; catch and fall back to hollow walls.
        let innerFill: Shape3D;
        try {
          innerFill = scope.register(sketch(innerFootprint(), 'XY').extrude(fillHeight));
        } catch {
          return setBoxCache(boxKey, hollowWalls);
        }
        scope.register(hollowWalls); // consumed by fuse

        // Combine walls with lowered interior fill
        return setBoxCache(boxKey, unwrap(fuse(hollowWalls, innerFill)));
      }
      // Standard solid mode: full solid block — box goes to cache, NOT registered
      return setBoxCache(boxKey, box);
    }

    // Guard: if wall thickness leaves no interior, return the solid box.
    // For polygon masks we trust the inward offset; only rectangle path
    // can produce the degenerate condition this catches.
    if (!polygon) {
      const innerW = outerW - 2 * wallThickness;
      const innerD = outerD - 2 * wallThickness;
      if (innerW <= 0 || innerD <= 0) {
        return setBoxCache(boxKey, box);
      }
    }

    const topFaces = faceFinder().parallelTo('Z').atDistance(wallHeight, [0, 0, 0]).findAll(box);
    // For polygon masks the shell operation can fail on narrow features
    // where wallThickness consumes the interior; fall back to the solid
    // extrusion in that case.
    let result: Shape3D;
    try {
      result = unwrap(shell(box as ValidSolid, topFaces, wallThickness));
    } catch {
      return setBoxCache(boxKey, box);
    }
    scope.register(box); // consumed by shell
    return setBoxCache(boxKey, result);
  });
}
/**
 * Build the stacking lip using a ruled loft + boolean cut.
 *
 * Outer frustum is a rectangular tube flush with the bin wall (inset=0).
 * Inner frustum traces the lip profile's inner contour, tapering from
 * 2.6mm at the base to 0mm at the peak. The cut produces a wedge-shaped
 * ring whose exterior is smooth and flush with the bin wall.
 */
function buildTopShapeLoft(
  outerW: number,
  outerD: number,
  includeLip: boolean,
  cellMask?: CellMask,
  gridUnitMm: number = SIZE
): Shape3D {
  const LIP_EXTENSION = includeLip ? 1.2 : 0;
  const polygon = isPartialMask(cellMask);

  const INNER_BASE = LIP_TAPER_WIDTH; // 2.6mm
  const INNER_MID = LIP_BIG_TAPER; // 1.9mm
  const INNER_TOP = 0;

  const Z_EXT = -LIP_EXTENSION;
  const Z_BASE = 0;
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
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
  };

  // Outer: rectangular tube at bin outer edge (2 sections → no extra edges)
  const zBottom = includeLip ? Z_EXT : Z_BASE;
  const outerSections: Sketch[] = [sectionAt(zBottom, 0), sectionAt(Z_PEAK, 0)];

  return withScope((scope: DisposalScope) => {
    const [outerFirst, ...outerRest] = outerSections;
    const outerFrustum = scope.register(outerFirst.loftWith(outerRest, { ruled: true }));

    // Inner: tapered frustum tracing the lip profile
    const innerSections: Sketch[] = [];
    if (includeLip) {
      innerSections.push(sectionAt(Z_EXT, INNER_BASE));
    }
    innerSections.push(sectionAt(Z_BASE, INNER_BASE));
    innerSections.push(sectionAt(Z_TAPER1, INNER_MID));
    innerSections.push(sectionAt(Z_VERT, INNER_MID));
    innerSections.push(sectionAt(Z_PEAK, INNER_TOP));

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
function buildTopShapeSweep(
  outerW: number,
  outerD: number,
  includeLip: boolean,
  cellMask?: CellMask,
  gridUnitMm: number = SIZE
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
    const boxSketch = polygon
      ? (buildMaskDrawing(cellMask, gridUnitMm).sketchOnPlane() as Sketch)
      : (drawRoundedRectangle(outerW, outerD, BOX_CORNER_RADIUS).sketchOnPlane() as Sketch);
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
 * Uses loft-cut for all kernels: constructs explicit rounded-rectangle
 * cross-sections at each profile breakpoint, avoiding an OCCT sweep bug
 * that flips the profile on non-square spines (#1379). Sweep retained as
 * fallback if loft throws.
 *
 * Profile per Gridfinity spec v5: 0.7mm + 1.8mm + 1.9mm = 4.4mm total height.
 * Built at Z=0 locally, caller translates to wallHeight.
 */
export function buildTopShape(
  gridW: number,
  gridD: number,
  includeLip: boolean,
  gridUnitMm: number = SIZE,
  cellMask?: CellMask
): Shape3D {
  const polygon = isPartialMask(cellMask);
  const lipKey = buildCacheKey(
    'v3',
    quantize(gridW),
    quantize(gridD),
    quantize(gridUnitMm),
    includeLip,
    polygon ? hashMask(cellMask) : 'rect'
  );
  const cached = getLipCache(lipKey);
  if (cached) {
    return cached;
  }

  const outerW = gridW * gridUnitMm - CLEARANCE;
  const outerD = gridD * gridUnitMm - CLEARANCE;

  // Loft-cut for all kernels: produces analytic surfaces and avoids an OCCT
  // BRepOffsetAPI_MakePipeShell bug where the profile direction flips on
  // certain non-square aspect ratios, causing the lip to overhang (#1379).
  let result: Shape3D;
  try {
    result = buildTopShapeLoft(outerW, outerD, includeLip, cellMask, gridUnitMm);
  } catch {
    // Loft failed — fall back to sweep path (kernel regression).
    // NOTE: sweep has the OCCT profile-flip bug on non-square spines (#1379)
    result = buildTopShapeSweep(outerW, outerD, includeLip, cellMask, gridUnitMm);
  }

  return setLipCache(lipKey, result);
}
