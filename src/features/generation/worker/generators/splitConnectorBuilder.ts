/**
 * Alignment connector builder for split bin pieces.
 *
 * Generates FDM-friendly zero-overhang connectors on cut faces so split
 * bin pieces can be aligned and glued together without print supports.
 *
 * - Wall connectors: simple butt joints. Walls meet at the cut face with
 *   no interlock features. The floor scarf lap provides alignment.
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

import {
  drawRectangle,
  draw,
  unwrap,
  fuse,
  cut,
  translate,
  getBounds,
  translateDrawing,
} from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import type { SplitConnectorConfig } from '@/shared/types/bin';
import { sketch } from './meshUtils';

/** Overlap into the piece body so booleans have shared volume (mm). */
export const OVERLAP = 1.0;

/** Minimum printable feature width for horizontal features (mm, ~2× nozzle). */
const MIN_FEATURE_WIDTH = 0.7;

/** Minimum feature height (mm) for reliable OCCT boolean operations. */
const MIN_FEATURE_HEIGHT = 0.5;

/** Tolerance for floating-point mm comparisons. */
const EPSILON = 1e-9;

/** Scarf lap angle in radians (45° = π/4). tan(45°) = 1.0 → overlap = floorThickness. */
const SCARF_ANGLE = Math.PI / 4;

/** Scarf lap slope ratio: overlap distance per unit of floor thickness. tan(45°) = 1.0 */
const SCARF_SLOPE = Math.tan(SCARF_ANGLE);

/** Width taper slope: 45° taper at each end of the scarf lap for self-supporting FDM. */
const WIDTH_TAPER_SLOPE = 1.0;

/** Key vertical extent as a fraction of interior wall height (lead-in tapers above it). */
const DEFAULT_WALL_KEY_HEIGHT_FRACTION = 0.8;

/** Half-width of the slim wall key, measured along the cut line (mm). */
const WALL_KEY_HALF_WIDTH = 0.9;

/** How far the key protrudes across the cut into the mating piece (mm). */
const WALL_KEY_PROTRUSION = 1.2;

/** Lead-in chamfer at the top/tip of the key so the halves self-guide together (mm). */
const WALL_KEY_LEADIN = 0.6;

/** Snug margin (mm, per side) between the key footprint and the pilaster edge. */
const WALL_PILASTER_MARGIN = 0.6;

/** Inward draft of the pilaster's cavity-facing face: fractional pull-back at the top. */
const WALL_PILASTER_DRAFT = 0.12;

/** Height of the region at the pilaster top where its inner face ramps back to the wall (mm). */
const WALL_PILASTER_TOP_TAPER = 3;

/** Residual inner depth where the pilaster melts into the wall just below the lip (mm). */
const WALL_PILASTER_TOP_MIN = 0.4;

/** 45° chamfer at the pilaster's floor junction (mm). */
const WALL_PILASTER_FLOOR_CHAMFER = 0.6;

export interface WallKeyGeometry {
  /** Inward distance from the outer wall face to the key's perpendicular center (mm). */
  readonly perpInset: number;
  /** Inward perpendicular footprint of the pilaster from the outer wall face (mm). */
  readonly pilasterPerpDepth: number;
  /** Pilaster depth along the cut-normal into the piece body (mm). */
  readonly pilasterProtDepth: number;
  /** Remaining intact outer wall skin after the groove is cut (mm). Must stay > 0. */
  readonly outerSkin: number;
}

/**
 * Placement of a wall key + its reinforcing pilaster. The key is a straight
 * (non-undercut) tongue/groove so the two halves assemble by pressing together
 * horizontally — an undercut would force a vertical drop-in, impossible past the
 * partial-height groove and the stacking lip.
 *
 * The key is inset from the outer wall face by the full wall thickness so the
 * groove cut (key + clearance) never reaches the exterior face — without the
 * inset the female groove punches a hole through the outer wall. The pilaster
 * restores material inward (only) to host the feature.
 */
export function wallKeyGeometry(wallThickness: number, clearance: number): WallKeyGeometry {
  const perpInset = wallThickness + WALL_KEY_HALF_WIDTH;
  const pilasterPerpDepth = perpInset + WALL_KEY_HALF_WIDTH + clearance + WALL_PILASTER_MARGIN;
  const pilasterProtDepth = WALL_KEY_PROTRUSION + clearance + WALL_PILASTER_MARGIN;
  // Key sits at the inner wall face; the groove only eats `clearance` into it.
  const outerSkin = wallThickness - clearance;
  return { perpInset, pilasterPerpDepth, pilasterProtDepth, outerSkin };
}

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
  edgeOffset: number
): void {
  const overlapLen = floorThickness * SCARF_SLOPE;

  // Width taper: 45° at each end reduces effective width at the tip
  const taperEach = Math.min(
    overlapLen * WIDTH_TAPER_SLOPE,
    effectiveWidth / 2 - MIN_FEATURE_WIDTH / 2
  );
  const tipWidth = Math.max(MIN_FEATURE_WIDTH, effectiveWidth - 2 * Math.max(0, taperEach));

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
 * Add connectors for a cut face: a floor scarf lap (always, when enabled) plus
 * optional vertical dovetail locking connectors on the exterior side walls.
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
  const pieceMin = face.pieceCenterOffset - face.pieceEdgeLength / 2;
  const pieceMax = face.pieceCenterOffset + face.pieceEdgeLength / 2;

  // ── Floor scarf lap (45° self-supporting joint, centered on piece) ──────
  const ft = context.floorThickness;
  if (ft >= MIN_FEATURE_HEIGHT) {
    const margin = wt + ft * SCARF_SLOPE;
    const effectiveWidth = shortenForCorners(
      face.pieceEdgeLength * 0.7,
      face.pieceCenterOffset,
      pieceMin,
      pieceMax,
      face.perpendicularCuts,
      margin
    );

    if (effectiveWidth >= MIN_FEATURE_WIDTH - EPSILON) {
      addScarfLapFeature(
        face,
        config.clearance,
        fuseTargets,
        cutTargets,
        ft,
        context.floorZ,
        effectiveWidth,
        face.pieceCenterOffset
      );
    }
  }

  // ── Wall locking keys (straight, press-together, on exterior perimeter walls) ─
  if (config.wallLocking) {
    addWallKeys(face, context, config, fuseTargets, cutTargets);
  }
}

/**
 * Add straight alignment keys to the exterior perimeter walls a cut crosses.
 *
 * The key is a straight (non-undercut) tongue/groove so the two halves press
 * together horizontally — the natural assembly motion, and the only one
 * compatible with a partial-height feature that leaves the stacking lip intact.
 * The protruding tongue has a 45° chamfered underside so it prints
 * self-supporting and self-guides on insertion. A reinforcing boss thickens the
 * wall inward only (preserving the Gridfinity footprint); the key is inset from
 * the outer face so the groove can't breach the exterior wall.
 *
 * Convention matches the floor lap: male faces grow a tongue, female faces have a
 * matching groove + clearance.
 */
function addWallKeys(
  face: CutFace,
  context: BinGeometryContext,
  config: SplitConnectorConfig,
  fuseTargets: Shape3D[],
  cutTargets: Shape3D[]
): void {
  const wallHeight = context.wallTopZ - context.floorZ;
  const heightFraction = config.ridgeHeightFraction ?? DEFAULT_WALL_KEY_HEIGHT_FRACTION;
  const keyHeight = wallHeight * heightFraction;
  if (keyHeight < MIN_FEATURE_HEIGHT) return;

  const half = face.binEdgeLength / 2;
  const pieceMin = face.pieceCenterOffset - face.pieceEdgeLength / 2;
  const pieceMax = face.pieceCenterOffset + face.pieceEdgeLength / 2;
  const tol = 1e-3;

  // The cut crosses a perimeter wall wherever this piece's perpendicular span
  // reaches the bin boundary (±half). Interior pieces touch neither.
  const perimeters: number[] = [];
  if (Math.abs(pieceMin + half) < tol) perimeters.push(-half);
  if (Math.abs(pieceMax - half) < tol) perimeters.push(half);

  const geom = wallKeyGeometry(context.wallThickness, config.clearance);
  // Don't let a pilaster eat more than ~45% of a narrow piece's perpendicular span.
  if (geom.pilasterPerpDepth > face.pieceEdgeLength * 0.45) return;

  for (const perimeter of perimeters) {
    const inward = perimeter > 0 ? -1 : 1;
    // This piece's body is behind the cut: male on the −axis side, female on +axis.
    const bodySign = face.isMale ? -1 : 1;

    fuseTargets.push(
      buildPilaster(
        face.axis,
        face.position,
        perimeter,
        inward,
        bodySign,
        context.floorZ,
        context.wallTopZ,
        geom
      )
    );

    const key = buildKey(
      face.axis,
      face.position,
      perimeter,
      inward,
      context.floorZ,
      keyHeight,
      face.isMale ? 0 : config.clearance,
      geom
    );
    (face.isMale ? fuseTargets : cutTargets).push(key);
  }
}

/** Re-center a freshly extruded prism on `target` along the given world axis (extrude sign is plane-dependent). */
function recenterAxis(solid: Shape3D, worldAxis: 'x' | 'y', target: number): Shape3D {
  const b = getBounds(solid);
  const lo = worldAxis === 'x' ? b.xMin : b.yMin;
  const hi = worldAxis === 'x' ? b.xMax : b.yMax;
  const shift = target - (lo + hi) / 2;
  const moved = translate(solid, worldAxis === 'x' ? [shift, 0, 0] : [0, shift, 0]);
  solid.delete();
  return moved;
}

/**
 * Build the reinforcing pilaster: a full-interior-height buttress that thickens
 * the wall inward only. Its cavity-facing silhouette (a profile in the
 * perpendicular×Z plane, extruded along the cut-normal) gives a 45° chamfer at
 * the floor, a subtle inward draft, and a top that tapers back into the wall
 * just below the lip — so it reads as designed rather than a glued-on block.
 */
function buildPilaster(
  axis: 'x' | 'y',
  cutPos: number,
  perimeter: number,
  inward: -1 | 1,
  bodySign: -1 | 1,
  floorZ: number,
  wallTopZ: number,
  geom: WallKeyGeometry
): Shape3D {
  const depth = geom.pilasterPerpDepth;
  const vOut = perimeter; // outer wall face (no outward growth)
  const vFull = perimeter + inward * depth;
  const vDraftTop = perimeter + inward * depth * (1 - WALL_PILASTER_DRAFT);
  const vTopMin = perimeter + inward * WALL_PILASTER_TOP_MIN;
  const vFloor = perimeter + inward * Math.max(0, depth - WALL_PILASTER_FLOOR_CHAMFER);
  const cham = Math.min(WALL_PILASTER_FLOOR_CHAMFER, (wallTopZ - floorZ) * 0.25);
  const topStart = Math.max(floorZ + cham + 0.5, wallTopZ - WALL_PILASTER_TOP_TAPER);

  // Silhouette in (perpendicular, Z); extruded along the cut-normal (prot) axis.
  const plane = axis === 'x' ? 'YZ' : 'XZ';
  const profile = draw([vOut, floorZ])
    .lineTo([vOut, wallTopZ])
    .lineTo([vTopMin, wallTopZ])
    .lineTo([vDraftTop, topStart])
    .lineTo([vFull, floorZ + cham])
    .lineTo([vFloor, floorZ])
    .close();
  const raw = sketch(profile, plane, 0).extrude(geom.pilasterProtDepth);
  const protCenter = cutPos + (bodySign * geom.pilasterProtDepth) / 2;
  return recenterAxis(raw, axis === 'x' ? 'x' : 'y', protCenter);
}

/**
 * Build the slim alignment key. The tongue (male, `inflate` = 0) protrudes from
 * the cut face with a 45° self-supporting underside and a lead-in chamfer at the
 * top/tip; the groove (female, `inflate` = clearance) is the same shape grown by
 * the fit clearance. Extruded along the cut line and centered on the key axis.
 */
function buildKey(
  axis: 'x' | 'y',
  cutPos: number,
  perimeter: number,
  inward: -1 | 1,
  floorZ: number,
  keyHeight: number,
  inflate: number,
  geom: WallKeyGeometry
): Shape3D {
  const halfW = WALL_KEY_HALF_WIDTH + inflate;
  const protTip = cutPos + WALL_KEY_PROTRUSION + inflate;
  const keyTop = floorZ + keyHeight + inflate;
  const lead = Math.min(WALL_KEY_LEADIN, WALL_KEY_PROTRUSION - 0.2, keyHeight / 2);
  const perpC = perimeter + inward * geom.perpInset;

  // Profile in (cut-normal, Z): 45° underside ramp (self-supporting) + a lead-in
  // chamfer on the top/tip so the halves guide together as they press in.
  const plane = axis === 'x' ? 'XZ' : 'YZ';
  const profile = draw([cutPos - OVERLAP, floorZ])
    .lineTo([cutPos - OVERLAP, keyTop])
    .lineTo([protTip - lead, keyTop])
    .lineTo([protTip, keyTop - lead])
    .lineTo([protTip, floorZ + WALL_KEY_PROTRUSION])
    .lineTo([cutPos, floorZ])
    .close();
  const raw = sketch(profile, plane, 0).extrude(2 * halfW);
  return recenterAxis(raw, axis === 'x' ? 'y' : 'x', perpC);
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
