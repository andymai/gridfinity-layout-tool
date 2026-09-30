/**
 * Alignment connector builder for split bin pieces.
 *
 * Generates FDM-friendly zero-overhang connectors on cut faces so split
 * bin pieces can be aligned and glued together without print supports.
 *
 * - Wall connectors (optional, `splitWallKey.ts`): press-together alignment keys + reinforcing
 *   pilasters on the exterior perimeter walls. Toggled independently of the
 *   floor scarf. A thicker wall hosts the key in its own material, so the
 *   inward pilaster shrinks — and is dropped entirely once the wall encloses
 *   the groove.
 * - Floor connectors: 45° scarf lap joint. The male piece extends past
 *   the cut face with a 45° underside slope; the female piece has a
 *   matching 45° ramp cut into its floor. Both surfaces are at the FDM
 *   self-supporting limit. Overlap distance = floor thickness.
 *
 * FDM printing constraints:
 * - Minimum feature width: 0.7mm (~2x 0.4mm nozzle)
 * - Minimum feature height: 0.5mm (reliable OCCT boolean threshold)
 * - All overhangs ≤ 45° (self-supporting on FDM without supports)
 * - Features shortened near corner intersections of perpendicular cuts
 * - Width tapers 45° at scarf lap ends for self-supporting termination
 *
 * Direction convention (both male and female extrude in +axis):
 * - Male (ridge/scarf overhang): sketch OVERLAP inside piece body,
 *   extrudes outward through the cut face. Fused onto the left/front piece.
 * - Female (channel/scarf ramp): sketch OVERLAP outside piece body
 *   (past cut face), extrudes inward. Boolean subtraction clips the
 *   overhang, producing a channel/ramp that opens cleanly at the mating face.
 */

import { drawRectangle, unwrap, fuse, cut, translate, getBounds, translateDrawing } from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import type { SplitConnectorConfig } from '@/shared/types/bin';
import {
  NOZZLE_BASELINE,
  scaleFeature,
  scaleClearance,
} from '@/shared/printSettings/connectorScaling';
import { EPSILON, MIN_FEATURE_HEIGHT, MIN_FEATURE_WIDTH, OVERLAP } from './splitConnectorFrame';
import type { BinGeometryContext, CutFace } from './splitConnectorFrame';
import { addWallConnectors, perimeterWalls } from './splitWallKey';

export { OVERLAP } from './splitConnectorFrame';
export type { BinGeometryContext, CutFace } from './splitConnectorFrame';
export { buildKey, fitWallKeyToHeight, wallKeyGeometry } from './splitWallKey';
export type { WallKeyGeometry, WallKeyHeightFit } from './splitWallKey';

/** Scarf lap angle in radians (45° = π/4). tan(45°) = 1.0 → overlap = floorThickness. */
const SCARF_ANGLE = Math.PI / 4;

/** Scarf lap slope ratio: overlap distance per unit of floor thickness. tan(45°) = 1.0 */
const SCARF_SLOPE = Math.tan(SCARF_ANGLE);

/** Width taper slope: 45° taper at each end of the scarf lap for self-supporting FDM. */
const WIDTH_TAPER_SLOPE = 1.0;

type Extent = [number, number, number];

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
  // Actual body edges (overhang-inclusive, possibly asymmetric), not ±footprint/2.
  binEdgeXMin: number,
  binEdgeXMax: number,
  binEdgeYMin: number,
  binEdgeYMax: number,
  pieceW: number,
  pieceD: number,
  pieceCenterX: number,
  pieceCenterY: number
): CutFace[] {
  const faces: CutFace[] = [];

  // An x-axis cut runs along Y, so its perimeter walls are the bin's Y edges; a
  // y-axis cut runs along X and crosses the X edges.
  const xFaceBase = {
    binEdgeMin: binEdgeYMin,
    binEdgeMax: binEdgeYMax,
    pieceEdgeLength: pieceD,
    pieceCenterOffset: pieceCenterY,
    perpendicularCuts: cutPlanesY,
  } as const;
  const yFaceBase = {
    binEdgeMin: binEdgeXMin,
    binEdgeMax: binEdgeXMax,
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

// ── Geometry Primitives ─────────────────────────────────────────────────────

/**
 * Build a wedge for scarf lap joint (floor connector).
 *
 * Ruled loft between two cross-sections at different positions along the
 * cut axis, with the tip section shifted upward so top edges are
 * coplanar. This creates a flat top + sloped bottom surface (the 45° ramp).
 *
 * - Base face: full rectangle (baseWidth × baseHeight) at the body side
 * - Tip face: thin rectangle (tipWidth × tipHeight) shifted up so its
 *   top edge aligns with the base's top edge
 */
function buildScarfWedge(
  cutAxis: 'x' | 'y',
  sketchPos: number,
  extrudeLen: number,
  baseWidth: number,
  tipWidth: number,
  baseHeight: number,
  tipHeight: number,
  bottomZ: number,
  edgeOffset: number
): Shape3D {
  const plane = cutAxis === 'x' ? 'YZ' : 'XZ';
  const [basePos, tipPos] = cutAxis === 'x' ? [0, extrudeLen] : [extrudeLen, 0];

  // Base section: centered at sketch origin
  const baseSection = drawRectangle(baseWidth, baseHeight).sketchOnPlane(plane, basePos) as Sketch;

  // Tip section: shifted upward in drawing-Y (maps to world-Z on YZ/XZ planes)
  // so top edges align with base. The loft creates a flat top + sloped bottom.
  // Shift = (baseHeight - tipHeight) / 2 because drawRectangle centers at origin.
  const tipZShift = (baseHeight - tipHeight) / 2;
  const tipDrawing = translateDrawing(drawRectangle(tipWidth, tipHeight), [0, tipZShift]);
  const tipSection = tipDrawing.sketchOnPlane(plane, tipPos) as Sketch;

  const lofted = baseSection.loftWith([tipSection], { ruled: true });

  const xOffset = cutAxis === 'x' ? sketchPos : edgeOffset;
  const yOffset = cutAxis === 'x' ? edgeOffset : sketchPos + extrudeLen;

  const positioned = translate(lofted, [xOffset, yOffset, bottomZ + baseHeight / 2]);
  lofted.delete();
  return positioned;
}

// ── Floor Scarf Lap ─────────────────────────────────────────────────────────

/**
 * Add a 45° scarf lap floor joint at a cut face.
 *
 * Male: wedge fused onto piece, extending past cut face with 45° underside.
 * Female: wedge cut from piece, creating 45° ramp into floor (reversed slope).
 *
 * The scarf overlap distance = floorThickness × SCARF_SLOPE (= floorThickness at 45°).
 * Width tapers 45° at each end for self-supporting FDM geometry.
 */
function addScarfLapFeature(
  face: CutFace,
  clearance: number,
  fuseTargets: Shape3D[],
  cutTargets: Shape3D[],
  floorThickness: number,
  floorZ: number,
  effectiveWidth: number,
  edgeOffset: number,
  minFeatureWidth: number
): void {
  const overlapLen = floorThickness * SCARF_SLOPE;

  // Width taper: 45° at each end reduces effective width at the tip
  const taperEach = Math.min(
    overlapLen * WIDTH_TAPER_SLOPE,
    effectiveWidth / 2 - minFeatureWidth / 2
  );
  const tipWidth = Math.max(minFeatureWidth, effectiveWidth - 2 * Math.max(0, taperEach));

  if (face.isMale) {
    // Male: wedge extends past cut face. Base (full height) is inside piece,
    // tip (near-zero height) is at the far end of the overhang.
    fuseTargets.push(
      buildScarfWedge(
        face.axis,
        face.position - OVERLAP,
        overlapLen + OVERLAP,
        effectiveWidth,
        tipWidth,
        floorThickness,
        MIN_FEATURE_HEIGHT,
        floorZ,
        edgeOffset
      )
    );
  } else {
    // Female: ramp cut into floor — SAME wedge shape as male (flat top,
    // sloped bottom), positioned at the cut face extending into the piece body.
    // Thick end (full floor height) at the cut face, thin end deeper inside.
    // The boolean cut removes this volume, creating the ramp channel.
    const axisClearance = clearance / Math.cos(SCARF_ANGLE);
    const widthClearance = clearance * 2;

    cutTargets.push(
      buildScarfWedge(
        face.axis,
        face.position - OVERLAP,
        overlapLen + axisClearance + OVERLAP,
        effectiveWidth + widthClearance,
        tipWidth + widthClearance,
        floorThickness + axisClearance,
        MIN_FEATURE_HEIGHT,
        floorZ - axisClearance / 2,
        edgeOffset
      )
    );
  }
}

// ── Connector Orchestration ─────────────────────────────────────────────────

/**
 * Add connectors for a cut face. Two independent features:
 *  - Floor scarf lap — the "alignment connectors" toggle (`config.enabled`).
 *  - Wall connectors — its own toggle (`config.wallConnector`), gated separately so it
 *    can be used with the floor scarf off (and vice versa).
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

  // Nozzle-scaled feature floor + bead-grown clearance. Identical to the legacy
  // 0.7mm / config.clearance at ≤0.4mm; wider nozzles get a ≥2-perimeter floor and
  // a looser fit so the scarf/key don't seize.
  const nozzle = context.nozzleSizeMm ?? NOZZLE_BASELINE;
  const minWidth = scaleFeature(MIN_FEATURE_WIDTH, nozzle);
  const effClearance = scaleClearance(config.clearance, nozzle);

  // ── Floor scarf lap (45° self-supporting joint, centered on piece) ──────
  const ft = context.floorThickness;
  if (config.enabled && ft >= MIN_FEATURE_HEIGHT) {
    const margin = context.wallThickness + ft * SCARF_SLOPE;
    // Sized off the floor's own span: a tapered wall meets the floor at its
    // full inset, so a scarf sized off the rim span runs out through it.
    const walls = perimeterWalls(face, context);
    const floorInset = (inward: -1 | 1): number =>
      walls.find((w) => w.inward === inward)?.face.inset(context.floorZ) ?? 0;
    const insetMin = floorInset(1);
    const insetMax = floorInset(-1);
    const floorSpan = face.pieceEdgeLength - insetMin - insetMax;
    const floorCenter = face.pieceCenterOffset + (insetMin - insetMax) / 2;
    const effectiveWidth = shortenForCorners(
      floorSpan * 0.7,
      floorCenter,
      floorCenter - floorSpan / 2,
      floorCenter + floorSpan / 2,
      face.perpendicularCuts,
      margin
    );

    if (effectiveWidth >= minWidth - EPSILON) {
      addScarfLapFeature(
        face,
        effClearance,
        fuseTargets,
        cutTargets,
        ft,
        context.floorZ,
        effectiveWidth,
        floorCenter,
        minWidth
      );
    }
  }

  // ── Wall connectors (optional, on exterior perimeter walls) ──────────────────
  addWallConnectors(face, context, config, fuseTargets, cutTargets);
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
