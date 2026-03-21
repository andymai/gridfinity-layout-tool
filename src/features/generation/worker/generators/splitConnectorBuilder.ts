/**
 * Alignment connector builder for split bin pieces.
 *
 * Generates half-lap wall joints and tongue-and-groove floor features on cut
 * faces so split bin pieces can be aligned and glued together seamlessly.
 *
 * - Wall connectors: half-lap joints with zero clearance for seamless
 *   exterior/interior surfaces. Each piece keeps half the wall thickness
 *   and extends it past the cut face to fill the opposing piece's recess.
 * - Floor tongue: horizontal tongue centered in the floor slab with 55°
 *   chamfers and configurable clearance for alignment during assembly.
 *
 * All features respect FDM printing constraints:
 * - Minimum feature width: 0.7mm (~2x 0.4mm nozzle)
 * - Minimum feature height: 0.5mm (reliable OCCT boolean threshold)
 * - Minimum shell around grooves: 0.2mm (~1 print layer)
 * - 55° max overhang angle on floor tongue surfaces
 * - Features shortened near corner intersections of perpendicular cuts
 *
 * Direction convention (both male and female extrude in +axis):
 * - Male (tongue): sketch OVERLAP inside piece body, extrudes outward
 *   through the cut face. Fused onto the left/front piece.
 * - Female (groove): sketch OVERLAP outside piece body (past cut face),
 *   extrudes inward. Boolean subtraction clips the overhang, producing
 *   a groove that opens cleanly at the mating face.
 */

import { drawRectangle, unwrap, fuse, cut, translate, getBounds } from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import type { SplitConnectorConfig } from '@/shared/types/bin';
import { sketch } from './generatorTypes';

/** Overlap into the piece body so booleans have shared volume (mm). */
export const OVERLAP = 1.0;

/** Minimum printable feature width (mm). */
const MIN_FEATURE_WIDTH = 0.7;

/** Minimum feature height (mm) for reliable OCCT boolean operations. */
const MIN_FEATURE_HEIGHT = 0.5;

/** Minimum shell thickness (mm) around a groove to remain printable. */
const MIN_SHELL = 0.2;

/** Tolerance for floating-point mm comparisons. */
const EPSILON = 1e-9;

/** Chamfer slope ratio (cot of max overhang angle). 0.7 = 55° overhang. */
const CHAMFER_SLOPE = 0.7;

type Extent = [number, number, number];

export interface CutFace {
  readonly axis: 'x' | 'y';
  readonly position: number;
  readonly isMale: boolean;
  readonly binEdgeLength: number;
  readonly pieceEdgeLength: number;
  readonly pieceCenterOffset: number;
  readonly perpendicularCuts: readonly number[];
}

export interface BinGeometryContext {
  readonly floorZ: number;
  readonly wallTopZ: number;
  readonly wallThickness: number;
  readonly floorThickness: number;
  /** Fraction of wall height removed by the deepest wall cutout (0-1). Undefined = no cutout. */
  readonly wallCutoutDepthFraction?: number;
}

export function applySplitConnectors(
  piece: Shape3D,
  cutFaces: readonly CutFace[],
  context: BinGeometryContext,
  config: SplitConnectorConfig
): Shape3D {
  if (cutFaces.length === 0) return piece;

  const fuseTargets: Shape3D[] = [];
  const cutTargets: Shape3D[] = [];

  for (const face of cutFaces) {
    addConnectors(face, context, config, fuseTargets, cutTargets);
  }

  const pieceBounds = getBounds(piece);
  const pieceExtent: Extent = [
    pieceBounds.xMax - pieceBounds.xMin,
    pieceBounds.yMax - pieceBounds.yMin,
    pieceBounds.zMax - pieceBounds.zMin,
  ];

  let result = applyBooleans(piece, fuseTargets, fuse, pieceExtent);
  result = applyBooleans(result, cutTargets, cut, pieceExtent);

  return result;
}

/** Apply boolean operations one at a time, validating each result. */
function applyBooleans(
  piece: Shape3D,
  targets: Shape3D[],
  op: typeof fuse | typeof cut,
  expectedExtent: Extent
): Shape3D {
  let result = piece;
  for (const target of targets) {
    try {
      const candidate = unwrap(op(result, target));
      if (isResultValid(candidate, expectedExtent)) {
        result = candidate;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
    }
  }
  return result;
}

/** Returns false if the result shrank below 80% on any axis. */
function isResultValid(shape: Shape3D, expectedExtent: Extent): boolean {
  try {
    const bounds = getBounds(shape);
    const extent: Extent = [
      bounds.xMax - bounds.xMin,
      bounds.yMax - bounds.yMin,
      bounds.zMax - bounds.zMin,
    ];
    for (let i = 0; i < 3; i++) {
      if (expectedExtent[i] > 1 && extent[i] < expectedExtent[i] * 0.8) {
        return false;
      }
    }
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    return false;
  }
}

export function computeCutFaces(
  col: number,
  row: number,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  outerW: number,
  outerD: number,
  pieceW: number,
  pieceD: number,
  pieceCenterX: number,
  pieceCenterY: number
): CutFace[] {
  const faces: CutFace[] = [];

  const xFaceBase = {
    binEdgeLength: outerD,
    pieceEdgeLength: pieceD,
    pieceCenterOffset: pieceCenterY,
    perpendicularCuts: cutPlanesY,
  } as const;
  const yFaceBase = {
    binEdgeLength: outerW,
    pieceEdgeLength: pieceW,
    pieceCenterOffset: pieceCenterX,
    perpendicularCuts: cutPlanesX,
  } as const;

  if (col < cutPlanesX.length) {
    faces.push({ axis: 'x', position: cutPlanesX[col], isMale: true, ...xFaceBase });
  }
  if (col > 0) {
    faces.push({ axis: 'x', position: cutPlanesX[col - 1], isMale: false, ...xFaceBase });
  }
  if (row < cutPlanesY.length) {
    faces.push({ axis: 'y', position: cutPlanesY[row], isMale: true, ...yFaceBase });
  }
  if (row > 0) {
    faces.push({ axis: 'y', position: cutPlanesY[row - 1], isMale: false, ...yFaceBase });
  }

  return faces;
}

/** Rectangular prism. */
function buildPrism(
  cutAxis: 'x' | 'y',
  sketchPos: number,
  extrudeLen: number,
  width: number,
  height: number,
  bottomZ: number,
  edgeOffset: number
): Shape3D {
  const rect = drawRectangle(width, height);
  const sketchPlane = cutAxis === 'x' ? 'YZ' : 'XZ';
  const prism = sketch(rect, sketchPlane, 0).extrude(extrudeLen);

  const xOffset = cutAxis === 'x' ? sketchPos : edgeOffset;
  const yOffset = cutAxis === 'x' ? edgeOffset : sketchPos + extrudeLen;

  return translate(prism, [xOffset, yOffset, bottomZ + height / 2]);
}

/** Tapered prism via ruled loft with 55° chamfers. */
function buildTaperedPrism(
  cutAxis: 'x' | 'y',
  sketchPos: number,
  extrudeLen: number,
  width: number,
  height: number,
  bottomZ: number,
  edgeOffset: number
): Shape3D {
  const maxHeightChamfer = Math.max(0, (height - MIN_FEATURE_HEIGHT) / 2);
  const maxWidthChamfer = Math.max(0, (width - MIN_FEATURE_WIDTH) / 2);
  const heightChamfer = Math.min(extrudeLen * CHAMFER_SLOPE, maxHeightChamfer);
  const widthChamfer = Math.min(extrudeLen * CHAMFER_SLOPE, maxWidthChamfer);

  if ((heightChamfer < 0.1 && widthChamfer < 0.1) || height < 1.0 || width < 2.0) {
    return buildPrism(cutAxis, sketchPos, extrudeLen, width, height, bottomZ, edgeOffset);
  }

  const tipWidth = width - 2 * widthChamfer;
  const tipHeight = height - 2 * heightChamfer;

  const plane = cutAxis === 'x' ? 'YZ' : 'XZ';
  const [basePos, tipPos] = cutAxis === 'x' ? [0, extrudeLen] : [extrudeLen, 0];

  const baseSection = drawRectangle(width, height).sketchOnPlane(plane, basePos) as Sketch;
  const tipSection = drawRectangle(tipWidth, tipHeight).sketchOnPlane(plane, tipPos) as Sketch;
  const lofted = baseSection.loftWith([tipSection], { ruled: true });

  const xOffset = cutAxis === 'x' ? sketchPos : edgeOffset;
  const yOffset = cutAxis === 'x' ? edgeOffset : sketchPos + extrudeLen;

  return translate(lofted, [xOffset, yOffset, bottomZ + height / 2]);
}

/**
 * Build a tongue or groove and push to the appropriate target array.
 * Male = tapered tongue (fused). Female = rectangular groove (cut).
 */
function addFeature(
  face: CutFace,
  clearance: number,
  fuseTargets: Shape3D[],
  cutTargets: Shape3D[],
  extrudeLen: number,
  width: number,
  height: number,
  bottomZ: number,
  edgeOffset: number,
  tapered: boolean
): void {
  if (face.isMale) {
    const builder = tapered ? buildTaperedPrism : buildPrism;
    fuseTargets.push(
      builder(
        face.axis,
        face.position - OVERLAP,
        extrudeLen + OVERLAP,
        width,
        height,
        bottomZ,
        edgeOffset
      )
    );
  } else {
    cutTargets.push(
      buildPrism(
        face.axis,
        face.position - OVERLAP,
        extrudeLen + clearance + OVERLAP,
        width + clearance * 2,
        height + clearance * 2,
        bottomZ - clearance,
        edgeOffset
      )
    );
  }
}

/**
 * Half-lap wall joint for seamless exterior/interior surfaces.
 *
 * Each piece gets a cut (removing the opposing half of wall) and a tab
 * (extending its own half past the cut face to fill the opposing recess).
 * Male = outer tab + inner cut. Female = inner tab + outer cut.
 *
 * Zero clearance on wall half-laps produces perfectly flush inner and
 * outer surfaces when assembled. The tab depth matches the groove depth
 * exactly, eliminating gaps at the bottom of the recess.
 */
function addHalfLapWallFeature(
  face: CutFace,
  fuseTargets: Shape3D[],
  cutTargets: Shape3D[],
  lapDepth: number,
  wallHeight: number,
  bottomZ: number,
  edgePos: number,
  wallThickness: number
): void {
  if (edgePos === 0) return;
  const sign = Math.sign(edgePos);
  const halfWt = wallThickness / 2;
  const isMale = face.isMale;
  const halfShift = (sign * halfWt) / 2;

  // Subtractive: remove opposing half of wall
  const cutSketchPos = isMale ? face.position - lapDepth - OVERLAP : face.position - OVERLAP;
  const cutDepth = lapDepth + 2 * OVERLAP;

  cutTargets.push(
    buildPrism(
      face.axis,
      cutSketchPos,
      cutDepth,
      halfWt,
      wallHeight,
      bottomZ,
      edgePos + (isMale ? -halfShift : halfShift)
    )
  );

  // Additive: extend own half past cut face, filling the opposing groove
  const tabDepth = lapDepth + OVERLAP;

  if (isMale) {
    fuseTargets.push(
      buildPrism(
        face.axis,
        face.position - OVERLAP,
        tabDepth + OVERLAP,
        halfWt,
        wallHeight,
        bottomZ,
        edgePos + halfShift
      )
    );
  } else {
    fuseTargets.push(
      buildPrism(
        face.axis,
        face.position - tabDepth,
        tabDepth + OVERLAP,
        halfWt,
        wallHeight,
        bottomZ,
        edgePos - halfShift
      )
    );
  }
}

/**
 * Add wall half-laps and floor tongue for a cut face.
 */
function addConnectors(
  face: CutFace,
  context: BinGeometryContext,
  config: SplitConnectorConfig,
  fuseTargets: Shape3D[],
  cutTargets: Shape3D[]
): void {
  const wallHeight = context.wallTopZ - context.floorZ;
  if (wallHeight <= 0) return;

  const wt = context.wallThickness;
  const binHalfEdge = face.binEdgeLength / 2;
  const wallOffset = binHalfEdge - wt / 2;
  const pieceMin = face.pieceCenterOffset - face.pieceEdgeLength / 2;
  const pieceMax = face.pieceCenterOffset + face.pieceEdgeLength / 2;

  // ── Wall half-laps (seamless exterior/interior surfaces) ───────────────
  // Clip tab height so it doesn't extend into the wall cutout region
  const effectiveWallHeight =
    context.wallCutoutDepthFraction !== undefined
      ? wallHeight * (1 - context.wallCutoutDepthFraction)
      : wallHeight;

  for (const edgePos of [-wallOffset, wallOffset]) {
    if (edgePos < pieceMin || edgePos > pieceMax) continue;
    const nearCut = face.perpendicularCuts.some((cp) => Math.abs(edgePos - cp) < wt * 2);
    if (nearCut) continue;
    if (effectiveWallHeight < MIN_FEATURE_HEIGHT) continue;

    addHalfLapWallFeature(
      face,
      fuseTargets,
      cutTargets,
      config.tongueProtrusion,
      effectiveWallHeight,
      context.floorZ,
      edgePos,
      wt
    );
  }

  // ── Floor tongue (centered on piece, shortened near corners) ──────────
  const ft = context.floorThickness;
  const maxGrooveHeight = ft - 2 * MIN_SHELL;
  const floorHeight = Math.min(config.tongueThickness, maxGrooveHeight - 2 * config.clearance);
  if (floorHeight >= MIN_FEATURE_HEIGHT - EPSILON) {
    const floorCenterZ = context.floorZ + ft / 2;
    const floorBottomZ = floorCenterZ - floorHeight / 2;
    const margin = wt + config.tongueProtrusion;

    const effectiveWidth = shortenForCorners(
      face.pieceEdgeLength * 0.7,
      face.pieceCenterOffset,
      pieceMin,
      pieceMax,
      face.perpendicularCuts,
      margin
    );

    if (effectiveWidth >= MIN_FEATURE_WIDTH - EPSILON) {
      addFeature(
        face,
        config.clearance,
        fuseTargets,
        cutTargets,
        config.tongueProtrusion,
        effectiveWidth,
        floorHeight,
        floorBottomZ,
        face.pieceCenterOffset,
        true
      );
    }
  }
}

/** Shorten a feature to stay within piece bounds and avoid perpendicular cut corners. */
function shortenForCorners(
  nominalWidth: number,
  center: number,
  pieceMin: number,
  pieceMax: number,
  perpendicularCuts: readonly number[],
  margin: number
): number {
  let halfW = nominalWidth / 2;

  halfW = Math.min(halfW, center - pieceMin, pieceMax - center);

  for (const cp of perpendicularCuts) {
    if (cp > center) {
      halfW = Math.min(halfW, cp - center - margin);
    } else {
      halfW = Math.min(halfW, center - cp - margin);
    }
  }

  return Math.max(0, halfW * 2);
}
