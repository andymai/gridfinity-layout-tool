/**
 * Alignment connector builder for split bin pieces.
 *
 * Generates cylindrical pins (male) and matching holes (female) on cut faces,
 * plus a thin tongue-and-groove ridge along the wall cross-section and
 * a step ledge at the stacking lip junction.
 *
 * Convention: right/back face of a piece = male (pins protrude outward),
 *             left/front face of a piece = female (matching holes recessed inward).
 */

import { drawCircle, drawRectangle, unwrap, fuseAll, cutAll, translate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { SplitConnectorConfig } from '@/shared/types/bin';
import { LIP_SMALL_TAPER, sketch } from './generatorTypes';
import { computePinPositions } from '@/shared/generation/splitUtils';

// ─── Constants ───────────────────────────────────────────────────────────────

const WALL_RIDGE_PROTRUSION = 0.3;
const WALL_RIDGE_HALF_WIDTH = 0.4;
const LIP_STEP_HEIGHT = 0.3;
const COPLANAR_MARGIN = 0.05;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CutFace {
  readonly axis: 'x' | 'y';
  readonly position: number;
  readonly isMale: boolean;
  readonly edgeLength: number;
}

export interface BinGeometryContext {
  readonly floorZ: number;
  readonly wallTopZ: number;
  readonly hasStackingLip: boolean;
  readonly totalHeightMm: number;
  readonly wallThickness: number;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Apply alignment connectors to a single split piece.
 * Returns the original piece unchanged if boolean operations fail.
 */
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
    // Floor zone: cylindrical pins/holes
    const floorResult = buildFloorPins(face, context, config);
    fuseTargets.push(...floorResult.fuse);
    cutTargets.push(...floorResult.cut);

    // Wall zone: tongue/groove ridge
    const wallResult = buildWallRidge(face, context, config);
    fuseTargets.push(...wallResult.fuse);
    cutTargets.push(...wallResult.cut);

    // Lip zone: step ledge
    if (context.hasStackingLip) {
      const lipResult = buildLipStep(face, context, config);
      fuseTargets.push(...lipResult.fuse);
      cutTargets.push(...lipResult.cut);
    }
  }

  let result = piece;

  if (fuseTargets.length > 0) {
    try {
      result = unwrap(fuseAll([result, ...fuseTargets]));
    } catch {
      // Connector fuse failed — continue with unmodified piece
    }
  }

  if (cutTargets.length > 0) {
    try {
      result = unwrap(cutAll(result, cutTargets));
    } catch {
      // Connector cut failed — continue with piece as-is
    }
  }

  return result;
}

/**
 * Compute CutFace descriptors for a piece at (col, row) in the split grid.
 * Male/female: right/back face = male (pins), left/front face = female (holes).
 */
export function computeCutFaces(
  col: number,
  row: number,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  outerW: number,
  outerD: number
): CutFace[] {
  const faces: CutFace[] = [];

  if (col < cutPlanesX.length) {
    faces.push({ axis: 'x', position: cutPlanesX[col], isMale: true, edgeLength: outerD });
  }
  if (col > 0) {
    faces.push({ axis: 'x', position: cutPlanesX[col - 1], isMale: false, edgeLength: outerD });
  }
  if (row < cutPlanesY.length) {
    faces.push({ axis: 'y', position: cutPlanesY[row], isMale: true, edgeLength: outerW });
  }
  if (row > 0) {
    faces.push({ axis: 'y', position: cutPlanesY[row - 1], isMale: false, edgeLength: outerW });
  }

  return faces;
}

// ─── Floor Zone: Cylindrical Pins ────────────────────────────────────────────

function buildFloorPins(
  face: CutFace,
  context: BinGeometryContext,
  config: SplitConnectorConfig
): { fuse: Shape3D[]; cut: Shape3D[] } {
  const fuse: Shape3D[] = [];
  const cut: Shape3D[] = [];

  const pinR = config.pinDiameter / 2;
  const holeR = pinR + config.clearance;
  const pinH = config.pinProtrusion;
  const holeH = pinH + config.clearance;
  // Place pins at mid-height of the base/socket zone.
  // For flat-base bins (floorZ=0), offset by pin radius + margin to stay within the solid.
  const pinCenterZ = context.floorZ > 0 ? context.floorZ / 2 : config.pinDiameter / 2 + 0.5;
  const positions = computePinPositions(face.edgeLength, config.pinSpacing);

  // Direction: geometry must extend INTO the piece (away from the cut face into piece territory).
  // Male (right/back face) = piece is on the negative side → extrude in -1 direction.
  // Female (left/front face) = piece is on the positive side → extrude in +1 direction.
  const dir: 1 | -1 = face.isMale ? -1 : 1;

  for (const offset of positions) {
    if (face.isMale) {
      fuse.push(
        buildHorizontalCylinder(face.axis, face.position, offset, pinCenterZ, pinR, pinH, dir)
      );
    } else {
      cut.push(
        buildHorizontalCylinder(
          face.axis,
          face.position,
          offset,
          pinCenterZ,
          holeR,
          holeH + COPLANAR_MARGIN,
          dir
        )
      );
    }
  }

  return { fuse, cut };
}

function buildHorizontalCylinder(
  cutAxis: 'x' | 'y',
  cutPosition: number,
  edgeOffset: number,
  centerZ: number,
  radius: number,
  length: number,
  direction: 1 | -1
): Shape3D {
  const circle = drawCircle(radius);
  const sketchPlane = cutAxis === 'x' ? 'YZ' : 'XZ';
  const cylinder = sketch(circle, sketchPlane, cutPosition).extrude(length * direction);

  return translate(cylinder, [
    cutAxis === 'x' ? 0 : edgeOffset,
    cutAxis === 'y' ? 0 : edgeOffset,
    centerZ,
  ]);
}

// ─── Wall Zone: Tongue-and-Groove Ridge ──────────────────────────────────────

function buildWallRidge(
  face: CutFace,
  context: BinGeometryContext,
  config: SplitConnectorConfig
): { fuse: Shape3D[]; cut: Shape3D[] } {
  const ridgeHeight = context.wallTopZ - context.floorZ;
  if (ridgeHeight <= 0) return { fuse: [], cut: [] };

  const ridgeWidth = Math.min(WALL_RIDGE_HALF_WIDTH, context.wallThickness * 0.3) * 2;
  const cl = config.clearance;
  // Male = piece on negative side → extrude into piece = -1; Female = positive side → +1
  const dir: 1 | -1 = face.isMale ? -1 : 1;

  if (face.isMale) {
    const tongue = buildRidgePrism(
      face.axis,
      face.position,
      ridgeWidth,
      WALL_RIDGE_PROTRUSION,
      ridgeHeight,
      context.floorZ,
      dir
    );
    return { fuse: [tongue], cut: [] };
  }

  const groove = buildRidgePrism(
    face.axis,
    face.position,
    ridgeWidth + cl * 2,
    WALL_RIDGE_PROTRUSION + cl,
    ridgeHeight + cl * 2,
    context.floorZ - cl,
    dir
  );
  return { fuse: [], cut: [groove] };
}

function buildRidgePrism(
  cutAxis: 'x' | 'y',
  cutPosition: number,
  width: number,
  depth: number,
  height: number,
  bottomZ: number,
  direction: 1 | -1
): Shape3D {
  const rect = drawRectangle(width, height);
  const sketchPlane = cutAxis === 'x' ? 'YZ' : 'XZ';
  const prism = sketch(rect, sketchPlane, cutPosition).extrude(depth * direction);

  return translate(prism, [0, 0, bottomZ + height / 2]);
}

// ─── Lip Zone: Step Ledge ────────────────────────────────────────────────────

function buildLipStep(
  face: CutFace,
  context: BinGeometryContext,
  config: SplitConnectorConfig
): { fuse: Shape3D[]; cut: Shape3D[] } {
  const cl = config.clearance;
  const stepWidth = face.edgeLength * 0.8;
  const dir: 1 | -1 = face.isMale ? -1 : 1;

  if (face.isMale) {
    const step = buildRidgePrism(
      face.axis,
      face.position,
      stepWidth,
      LIP_STEP_HEIGHT,
      LIP_SMALL_TAPER,
      context.wallTopZ,
      dir
    );
    return { fuse: [step], cut: [] };
  }

  const groove = buildRidgePrism(
    face.axis,
    face.position,
    stepWidth + cl * 2,
    LIP_STEP_HEIGHT + cl,
    LIP_SMALL_TAPER + cl * 2,
    context.wallTopZ - cl,
    dir
  );
  return { fuse: [], cut: [groove] };
}
