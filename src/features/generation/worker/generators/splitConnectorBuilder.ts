/**
 * Alignment connector builder for split bin pieces.
 *
 * Generates tongue-and-groove features on cut faces so split bin pieces
 * can be quickly aligned and glued together:
 *
 * - Wall tongues: vertical tongues at each outer wall edge with 55° chamfers
 * - Floor tongue: horizontal tongue along the floor slab with sloped sides
 * - Lip step: shallow ledge at the stacking lip junction
 *
 * All features respect FDM printing constraints:
 * - Minimum feature width: 0.7mm (~2× 0.4mm nozzle)
 * - Minimum feature height: 0.5mm (reliable OCCT boolean threshold)
 * - Minimum shell around grooves: 0.2mm (~1 print layer)
 * - Minimum wall for wall tongues: 1.4mm
 * - Groove depth = tongue depth + clearance (prevents bottoming out)
 * - Default clearance 0.15mm per side for glue-fit assembly
 * - 55° max overhang angle on all horizontal surfaces (safe for most printers)
 * - Features shortened near corner intersections of perpendicular cuts
 *
 * Direction convention (both male and female extrude in +axis):
 * - Male (tongue): sketch 0.15mm inside piece body, extrudes outward
 *   through the cut face. Fused onto the left/front piece.
 * - Female (groove): sketch 0.15mm OUTSIDE piece body (past cut face),
 *   extrudes inward. Boolean subtraction clips the overhang, producing
 *   a groove that opens cleanly at the mating face.
 */

import { drawRectangle, unwrap, fuseAll, cutAll, translate } from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import type { SplitConnectorConfig } from '@/shared/types/bin';
import { LIP_SMALL_TAPER, sketch } from './generatorTypes';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Overlap into the piece body so booleans have shared volume (mm).
 *  Without this, the prism only touches the cut face (coplanar),
 *  causing OCCT's boolean operations to fail silently. */
const OVERLAP = 0.15;

/** Minimum bin wall thickness to place wall tongues (mm).
 *  Must accommodate: tongue + 2×clearance + 2×MIN_SHELL.
 *  At default clearance (0.15mm): 0.7 + 0.3 + 0.4 = 1.4mm. */
const MIN_WALL_FOR_TONGUE = 1.4;

/** Minimum printable feature WIDTH (mm) — slightly under 2× nozzle width to
 *  allow wall tongues at common wall thicknesses. */
const MIN_FEATURE_WIDTH = 0.7;

/** Minimum feature HEIGHT (mm) for reliable OCCT boolean operations.
 *  Must be thick enough for OCCT to create valid solids. */
const MIN_FEATURE_HEIGHT = 0.5;

/** Minimum shell thickness (mm) around a groove to remain printable.
 *  0.2mm = one print layer at the most common layer height. */
const MIN_SHELL = 0.2;

/** Height of the lip step ledge (mm). */
const LIP_STEP_HEIGHT = 0.5;

/** Chamfer slope ratio: chamfer_height / protrusion_depth.
 *  cot(max_overhang_angle_from_vertical).
 *  0.7 → 55° overhang (safe on most modern printers with PLA). */
const CHAMFER_SLOPE = 0.7;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CutFace {
  readonly axis: 'x' | 'y';
  readonly position: number;
  readonly isMale: boolean;
  /** Full bin edge length along this cut face (for locating outer wall tongues). */
  readonly binEdgeLength: number;
  /** Piece edge length along this cut face (for sizing floor tongue / lip step). */
  readonly pieceEdgeLength: number;
  /** Piece center coordinate along the edge direction (absolute, bin-centered). */
  readonly pieceCenterOffset: number;
  /** Positions of perpendicular cut planes that intersect this edge (for corner shortening). */
  readonly perpendicularCuts: readonly number[];
}

export interface BinGeometryContext {
  readonly floorZ: number;
  readonly wallTopZ: number;
  readonly hasStackingLip: boolean;
  readonly wallThickness: number;
}

// ─── Public API ──────────────────────────────────────────────────────────────

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
    addTongueAndGroove(face, context, config, fuseTargets, cutTargets);

    if (context.hasStackingLip) {
      addLipStep(face, context, config, fuseTargets, cutTargets);
    }
  }

  let result = piece;

  if (fuseTargets.length > 0) {
    try {
      result = unwrap(fuseAll([result, ...fuseTargets]));
    } catch {
      // Boolean fuse failed — continue with unmodified piece
    }
  }

  if (cutTargets.length > 0) {
    try {
      result = unwrap(cutAll(result, cutTargets));
    } catch {
      // Boolean cut failed — continue with piece as-is
    }
  }

  return result;
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

// ─── Prism Builders ─────────────────────────────────────────────────────────

/** Rectangular prism (untapered). Used for grooves and thin features. */
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
  const prism = sketch(rect, sketchPlane, sketchPos).extrude(extrudeLen);

  return translate(prism, [
    cutAxis === 'x' ? 0 : edgeOffset,
    cutAxis === 'y' ? 0 : edgeOffset,
    bottomZ + height / 2,
  ]);
}

/** Tapered prism via ruled loft. Width and height taper independently at 55°. */
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

  // Fall back to rectangular for negligible chamfers or thin features
  if ((heightChamfer < 0.1 && widthChamfer < 0.1) || height < 1.0) {
    return buildPrism(cutAxis, sketchPos, extrudeLen, width, height, bottomZ, edgeOffset);
  }

  const tipWidth = width - 2 * widthChamfer;
  const tipHeight = height - 2 * heightChamfer;
  const sketchPlane = cutAxis === 'x' ? 'YZ' : 'XZ';

  const baseSection = drawRectangle(width, height).sketchOnPlane(sketchPlane, 0) as Sketch;
  const tipSection = drawRectangle(tipWidth, tipHeight).sketchOnPlane(
    sketchPlane,
    extrudeLen
  ) as Sketch;

  const lofted = baseSection.loftWith([tipSection], { ruled: true });

  return translate(lofted, [
    cutAxis === 'x' ? sketchPos : edgeOffset,
    cutAxis === 'y' ? sketchPos : edgeOffset,
    bottomZ + height / 2,
  ]);
}

// ─── Male/Female Feature Placement ──────────────────────────────────────────

/**
 * Build a connector shape and push it to the appropriate target array.
 *
 * Male tongues use tapered prisms (55° chamfers on overhangs).
 * Female grooves always use rectangular prisms — groove surfaces are
 * interior (no overhang concern), and a rectangular groove is larger
 * than the tapered tongue at every cross-section, ensuring clearance.
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

// ─── Tongue & Groove Features ────────────────────────────────────────────────

function addTongueAndGroove(
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

  // ── Wall tongues (at outer bin walls only) ─────────────────────────────
  // Skip if the wall edge is outside the piece or near a perpendicular cut
  // (middle pieces have no outer walls on the split axis).
  const maxGrooveWidth = wt - 2 * MIN_SHELL;
  const maxTongueWidth = maxGrooveWidth - 2 * config.clearance;
  const tongueWidth = Math.min(config.pinDiameter, maxTongueWidth);

  if (wt >= MIN_WALL_FOR_TONGUE && tongueWidth >= MIN_FEATURE_WIDTH) {
    for (const edgePos of [-wallOffset, wallOffset]) {
      if (edgePos < pieceMin || edgePos > pieceMax) continue;
      const nearCut = face.perpendicularCuts.some((cp) => Math.abs(edgePos - cp) < wt * 2);
      if (nearCut) continue;
      addFeature(
        face,
        config.clearance,
        fuseTargets,
        cutTargets,
        config.pinProtrusion,
        tongueWidth,
        wallHeight,
        context.floorZ,
        edgePos,
        true
      );
    }
  }

  // ── Floor tongue (centered on piece, shortened near corners) ───────────
  const maxGrooveHeight = wt - 2 * MIN_SHELL;
  const maxTongueHeight = maxGrooveHeight - 2 * config.clearance;
  if (maxTongueHeight >= MIN_FEATURE_HEIGHT) {
    const floorHeight = Math.min(config.pinDiameter, maxTongueHeight);
    const floorCenterZ = context.floorZ + wt / 2;
    const floorBottomZ = floorCenterZ - floorHeight / 2;
    const margin = wt + config.pinProtrusion;

    const effectiveWidth = shortenForCorners(
      face.pieceEdgeLength * 0.7,
      face.pieceCenterOffset,
      pieceMin,
      pieceMax,
      face.perpendicularCuts,
      margin
    );

    if (effectiveWidth >= MIN_FEATURE_WIDTH) {
      addFeature(
        face,
        config.clearance,
        fuseTargets,
        cutTargets,
        config.pinProtrusion,
        effectiveWidth,
        floorHeight,
        floorBottomZ,
        face.pieceCenterOffset,
        true
      );
    }
  }
}

/**
 * Shorten a feature's width to stay within piece bounds and avoid corners
 * where perpendicular cut planes create intersecting connector zones.
 */
function shortenForCorners(
  nominalWidth: number,
  center: number,
  pieceMin: number,
  pieceMax: number,
  perpendicularCuts: readonly number[],
  margin: number
): number {
  let halfW = nominalWidth / 2;

  // Clamp to piece bounds
  halfW = Math.min(halfW, center - pieceMin, pieceMax - center);

  // Shrink away from perpendicular cut planes
  for (const cp of perpendicularCuts) {
    if (cp > center) {
      halfW = Math.min(halfW, cp - center - margin);
    } else {
      halfW = Math.min(halfW, center - cp - margin);
    }
  }

  return Math.max(0, halfW * 2);
}

// ─── Lip Step ────────────────────────────────────────────────────────────────

function addLipStep(
  face: CutFace,
  context: BinGeometryContext,
  config: SplitConnectorConfig,
  fuseTargets: Shape3D[],
  cutTargets: Shape3D[]
): void {
  const margin = context.wallThickness + LIP_STEP_HEIGHT;
  const pieceMin = face.pieceCenterOffset - face.pieceEdgeLength / 2;
  const pieceMax = face.pieceCenterOffset + face.pieceEdgeLength / 2;

  const stepWidth = shortenForCorners(
    face.pieceEdgeLength * 0.8,
    face.pieceCenterOffset,
    pieceMin,
    pieceMax,
    face.perpendicularCuts,
    margin
  );

  if (stepWidth < MIN_FEATURE_WIDTH) return;

  addFeature(
    face,
    config.clearance,
    fuseTargets,
    cutTargets,
    LIP_STEP_HEIGHT,
    stepWidth,
    LIP_SMALL_TAPER,
    context.wallTopZ,
    face.pieceCenterOffset,
    false
  );
}
