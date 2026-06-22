/**
 * Alignment connector builder for split bin pieces.
 *
 * Generates FDM-friendly zero-overhang connectors on cut faces so split
 * bin pieces can be aligned and glued together without print supports.
 *
 * - Wall connectors (optional): press-together alignment keys + reinforcing
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
import type { SplitConnectorConfig, WallConnectorStyle } from '@/shared/types/bin';
import {
  NOZZLE_BASELINE,
  scaleFeature,
  scaleClearance,
} from '@/shared/printSettings/connectorScaling';
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
const DEFAULT_WALL_KEY_HEIGHT_FRACTION = 0.85;

/**
 * Half-width of the wall key (mm). Doubled (1.6mm), this is the key's footprint
 * along the cut line — which, on a perimeter wall, is also its inward reach. Sized stocky
 * enough that the tongue meaningfully resists splaying rather than just aligning; the
 * reinforcing pilaster now adds material on every selectable wall (its inward reach,
 * `pilasterPerpDepth` ≈ 3.3mm, exceeds the thickest `WALL_THICKNESS_OPTIONS` = 2.6mm).
 * The tongue is ~4 perimeters at a 0.4mm nozzle. See `wallKeyGeometry`.
 */
const WALL_KEY_HALF_WIDTH = 0.8;

/**
 * Intact outer wall skin kept in front of the groove (mm). The key is anchored this far
 * behind the exterior face regardless of wall thickness, so a thicker wall envelops the
 * key rather than pushing it deeper. ~2 perimeters at a 0.4mm nozzle — printable, and the
 * seam is glued anyway.
 */
const WALL_KEY_OUTER_SKIN = 0.8;

/**
 * How far the key protrudes across the cut into the mating piece (mm). This is the
 * tongue's engagement depth — deeper means more glue surface and far more resistance
 * to the halves pulling/splaying apart. Clamped down on short bins by `buildKey` so the
 * self-supporting tip ramp always finishes below the lead-in notch.
 */
const WALL_KEY_PROTRUSION = 2.4;

/**
 * Lead-in drop at the top of the key (mm). The whole protruding span slopes down by this
 * over its length, turning the tongue into a self-guiding wedge instead of a blunt block;
 * the female groove inherits the same slope as a wider insertion mouth.
 */
const WALL_KEY_LEADIN = 1.2;

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
  /** Nozzle-scaled half-width of the key tongue along the cut line (mm). */
  readonly keyHalfWidth: number;
  /** Nozzle-scaled protrusion of the key across the cut into the mating piece (mm). */
  readonly protrusion: number;
}

/**
 * Placement of a wall key + its reinforcing pilaster. The key is a straight
 * (non-undercut) tongue/groove so the two halves assemble by pressing together
 * horizontally — an undercut would force a vertical drop-in, impossible past the
 * partial-height groove and the stacking lip.
 *
 * The key is anchored a fixed skin (`WALL_KEY_OUTER_SKIN`) behind the exterior face
 * rather than behind the full wall thickness, so the groove cut never breaches the
 * outside no matter how thick the wall is. Because the inset no longer grows with
 * `wallThickness`, a thicker wall envelops the key in its own material instead of
 * pushing it deeper — and `pilasterPerpDepth` then exceeds the wall by less and less,
 * until `addKeyConnectors` drops the pilaster entirely (no extra inward material).
 */
export function wallKeyGeometry(
  wallThickness: number,
  clearance: number,
  nozzleSizeMm: number = NOZZLE_BASELINE
): WallKeyGeometry {
  // Scale the 0.4mm-tuned footprint up on a wider nozzle: the tongue stays ≥2
  // perimeters wide, the intact outer skin in front of the groove stays ≥2
  // perimeters, and the protrusion stays ≥2 perimeters of engagement. All three
  // are exactly the legacy value at ≤0.4mm (no regression).
  const keyHalfWidth = scaleFeature(WALL_KEY_HALF_WIDTH * 2, nozzleSizeMm) / 2;
  const outerSkinNom = scaleFeature(WALL_KEY_OUTER_SKIN, nozzleSizeMm);
  const protrusion = scaleFeature(WALL_KEY_PROTRUSION, nozzleSizeMm);

  const grooveHalf = keyHalfWidth + clearance;
  const perpInset = outerSkinNom + grooveHalf;
  const grooveInnerEdge = perpInset + grooveHalf;
  const pilasterPerpDepth = grooveInnerEdge + WALL_PILASTER_MARGIN;
  const pilasterProtDepth = protrusion + clearance + WALL_PILASTER_MARGIN;
  // Intact outer skin in front of the groove. Capped at the wall thickness for thin
  // walls, where the groove sits fully inward of the wall (hosted by the pilaster).
  const outerSkin = Math.min(outerSkinNom, wallThickness);
  return { perpInset, pilasterPerpDepth, pilasterProtDepth, outerSkin, keyHalfWidth, protrusion };
}

export interface WallKeyHeightFit {
  /** False when the wall is too short to host a non-degenerate key — skip wall keys. */
  readonly fits: boolean;
  /** Protrusion clamped so the 45° tip ramp finishes below the lead-in notch (mm). */
  readonly protrusion: number;
}

/**
 * Decide whether a wall key fits the available interior height and clamp its protrusion
 * so the self-supporting 45° tip ramp always finishes below the lead-in notch.
 *
 * The minimum required protrusion scales with the nozzle (≥2 perimeters via
 * `scaleFeature`), so a wide nozzle skips a key it could only print as a sub-bead tongue
 * rather than emitting a weak one. `keyHeight` is shared by the male tongue and female
 * groove, so both clamp identically and stay dimensionally matched.
 */
export function fitWallKeyToHeight(
  keyHeight: number,
  nominalProtrusion: number,
  nozzleSizeMm: number = NOZZLE_BASELINE
): WallKeyHeightFit {
  // The tongue needs vertical room for its lead-in notch, a self-supporting 45° tip ramp
  // (≥ a ≥2-perimeter protrusion), and a minimum flat above the ramp.
  const minProtrusion = scaleFeature(MIN_FEATURE_WIDTH, nozzleSizeMm);
  if (keyHeight < WALL_KEY_LEADIN + minProtrusion + MIN_FEATURE_HEIGHT) {
    return { fits: false, protrusion: 0 };
  }
  const protrusion = Math.min(nominalProtrusion, keyHeight - WALL_KEY_LEADIN - MIN_FEATURE_HEIGHT);
  return { fits: true, protrusion };
}

type Extent = [number, number, number];

export interface CutFace {
  readonly axis: 'x' | 'y';
  readonly position: number;
  readonly isMale: boolean;
  /**
   * Perpendicular coordinates of the bin's two exterior walls this cut crosses.
   * These are the *actual* body edges, which an overhang pushes outward and can
   * make asymmetric (left ≠ right) — not the nominal ±footprint/2. Connector
   * placement keys off these so overhung walls are detected and the connector
   * lands on the true outer face (#1949).
   */
  readonly binEdgeMin: number;
  readonly binEdgeMax: number;
  readonly pieceEdgeLength: number;
  readonly pieceCenterOffset: number;
  readonly perpendicularCuts: readonly number[];
}

export interface BinGeometryContext {
  readonly floorZ: number;
  readonly wallTopZ: number;
  readonly wallThickness: number;
  readonly floorThickness: number;
  /**
   * Nozzle diameter (mm) the pieces print with. Drives feature/clearance scaling
   * so connectors stay printable on wider nozzles. Defaults to the 0.4mm baseline
   * when omitted, leaving geometry identical to pre-nozzle-aware behavior.
   */
  readonly nozzleSizeMm?: number;
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
    const effectiveWidth = shortenForCorners(
      face.pieceEdgeLength * 0.7,
      face.pieceCenterOffset,
      face.pieceCenterOffset - face.pieceEdgeLength / 2,
      face.pieceCenterOffset + face.pieceEdgeLength / 2,
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
        face.pieceCenterOffset,
        minWidth
      );
    }
  }

  // ── Wall connectors (optional, on exterior perimeter walls) ──────────────────
  addWallConnectors(face, context, config, fuseTargets, cutTargets);
}

/**
 * Dispatch to the configured wall-connector builder.
 *
 * This is the extension point for new wall connector types. To add one:
 *   1. Add a member to `WallConnectorStyle` (in shared/types/bin).
 *   2. Add a `case` here that calls your builder — the exhaustive `never` check
 *      below makes the compiler flag this switch until you do.
 *   3. Implement the builder using `perimeterWalls()` for placement and pushing
 *      onto `fuseTargets` / `cutTargets`, mirroring `addKeyConnectors`.
 *   4. Surface it in the SplitOptionsSection UI.
 */
function addWallConnectors(
  face: CutFace,
  context: BinGeometryContext,
  config: SplitConnectorConfig,
  fuseTargets: Shape3D[],
  cutTargets: Shape3D[]
): void {
  const style: WallConnectorStyle = config.wallConnector ?? 'none';
  switch (style) {
    case 'none':
      return;
    case 'key':
      addKeyConnectors(face, context, config, fuseTargets, cutTargets);
      return;
    default: {
      const _exhaustive: never = style;
      return _exhaustive;
    }
  }
}

/** A perimeter wall a cut crosses, with the directions a connector needs to orient itself. */
interface PerimeterWall {
  /** Perpendicular coordinate of the wall's outer face (a bin edge). */
  readonly perimeter: number;
  /** Sign pointing toward the bin center — the only direction a connector may thicken. */
  readonly inward: -1 | 1;
  /** Sign pointing into this piece's body behind the cut (male −axis, female +axis). */
  readonly bodySign: -1 | 1;
}

/**
 * The exterior perimeter walls a cut face crosses. A cut crosses a perimeter
 * wall wherever this piece's perpendicular span reaches a bin edge
 * (`binEdgeMin`/`binEdgeMax` — overhang-inclusive, so an overhung wall still
 * qualifies); interior pieces touch neither. Shared by all wall-connector builders.
 */
function perimeterWalls(face: CutFace): PerimeterWall[] {
  const pieceMin = face.pieceCenterOffset - face.pieceEdgeLength / 2;
  const pieceMax = face.pieceCenterOffset + face.pieceEdgeLength / 2;
  const tol = 1e-3;
  const bodySign = face.isMale ? -1 : 1;

  const walls: PerimeterWall[] = [];
  if (Math.abs(pieceMin - face.binEdgeMin) < tol)
    walls.push({ perimeter: face.binEdgeMin, inward: 1, bodySign });
  if (Math.abs(pieceMax - face.binEdgeMax) < tol)
    walls.push({ perimeter: face.binEdgeMax, inward: -1, bodySign });
  return walls;
}

/**
 * 'key' connector: a slim press-together alignment key on each exterior perimeter
 * wall. A thin wall is reinforced by a full-height inward pilaster; a wall thick
 * enough to enclose the key hosts it directly and the pilaster is skipped (no extra
 * material — see `wallKeyGeometry`).
 *
 * The key is a straight (non-undercut) tongue/groove so the two halves press
 * together horizontally — the natural assembly motion, and the only one
 * compatible with a partial-height feature that leaves the stacking lip intact.
 * The protruding tongue has a 45° chamfered underside so it prints
 * self-supporting and self-guides on insertion. When present, the pilaster thickens
 * the wall inward only (preserving the Gridfinity footprint); the key is anchored a
 * fixed skin behind the outer face so the groove can't breach the exterior wall.
 *
 * Convention matches the floor lap: male faces grow a tongue, female faces have a
 * matching groove + clearance.
 */
function addKeyConnectors(
  face: CutFace,
  context: BinGeometryContext,
  config: SplitConnectorConfig,
  fuseTargets: Shape3D[],
  cutTargets: Shape3D[]
): void {
  const wallHeight = context.wallTopZ - context.floorZ;
  const heightFraction = config.ridgeHeightFraction ?? DEFAULT_WALL_KEY_HEIGHT_FRACTION;
  const keyHeight = wallHeight * heightFraction;

  const nozzle = context.nozzleSizeMm ?? NOZZLE_BASELINE;
  const effClearance = scaleClearance(config.clearance, nozzle);
  const geom = wallKeyGeometry(context.wallThickness, effClearance, nozzle);

  // Skip wall keys on bins too short to host a non-degenerate key; otherwise clamp the
  // protrusion so the self-supporting tip ramp finishes below the lead-in notch.
  const fit = fitWallKeyToHeight(keyHeight, geom.protrusion, nozzle);
  if (!fit.fits) return;

  // The pilaster only adds material where it reaches past the existing wall. Once the
  // wall is thick enough to enclose the groove (+margin) it hosts the key on its own,
  // so we skip the pilaster — the "use the thicker wall instead of adding material" path.
  const needsPilaster = geom.pilasterPerpDepth > context.wallThickness + EPSILON;

  // A pilaster intrudes into the cavity; don't let it eat more than ~45% of a narrow
  // piece's span. Without a pilaster the slim key always fits, so the guard only applies
  // when one is actually added.
  if (needsPilaster && geom.pilasterPerpDepth > face.pieceEdgeLength * 0.45) return;

  for (const { perimeter, inward, bodySign } of perimeterWalls(face)) {
    if (needsPilaster) {
      fuseTargets.push(
        buildPilaster(
          face.axis,
          face.position,
          perimeter,
          inward,
          bodySign,
          context.floorZ,
          context.wallTopZ,
          context.floorZ + keyHeight,
          geom
        )
      );
    }

    const key = buildKey(
      face.axis,
      face.position,
      perimeter,
      inward,
      context.floorZ,
      keyHeight,
      face.isMale ? 0 : effClearance,
      fit.protrusion,
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
  keyTop: number,
  geom: WallKeyGeometry
): Shape3D {
  const depth = geom.pilasterPerpDepth;
  const vOut = perimeter; // outer wall face (no outward growth)
  const vFull = perimeter + inward * depth;
  const vDraftTop = perimeter + inward * depth * (1 - WALL_PILASTER_DRAFT);
  const vTopMin = perimeter + inward * WALL_PILASTER_TOP_MIN;
  const vFloor = perimeter + inward * Math.max(0, depth - WALL_PILASTER_FLOOR_CHAMFER);
  const cham = Math.min(WALL_PILASTER_FLOOR_CHAMFER, (wallTopZ - floorZ) * 0.25);
  // Keep the buttress at full depth through the key (the groove needs the material), then
  // melt into the wall over the whole span above it — a longer, more graceful taper than a
  // fixed stub, and it never starts below the groove (which would breach the seal). Falls
  // back to the legacy `wallTopZ − TOP_TAPER` window when the key is short.
  const taperStart = Math.max(keyTop, wallTopZ - WALL_PILASTER_TOP_TAPER);
  const topStart = Math.min(Math.max(floorZ + cham + 0.5, taperStart), wallTopZ - 0.5);

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
  // The cut-normal is the cut axis itself, so re-center along `axis`.
  const protCenter = cutPos + (bodySign * geom.pilasterProtDepth) / 2;
  return recenterAxis(raw, axis, protCenter);
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
  protrusion: number,
  geom: WallKeyGeometry
): Shape3D {
  // `protrusion` is pre-clamped by `fitWallKeyToHeight` so the 45° tip ramp finishes
  // below the lead-in notch; both male tongue and female groove receive the same value.
  const halfW = geom.keyHalfWidth + inflate;
  const protTip = cutPos + protrusion + inflate;
  const keyTop = floorZ + keyHeight + inflate;
  const lead = Math.min(WALL_KEY_LEADIN, protrusion - 0.2, keyHeight / 2);
  const perpC = perimeter + inward * geom.perpInset;
  const perpAxis = axis === 'x' ? 'y' : 'x';

  // Profile in (cut-normal, Z): the protruding span is a wedge — a 45° self-supporting
  // underside ramp and a top that slopes down by `lead` from the seam to the tip, so the
  // tongue reads as a sculpted point and self-guides as the halves press in. The body
  // portion keeps a flat top (it's buried in the wall/pilaster). The key extrudes along
  // the cut line (perpAxis), so its profile lives in the cut plane.
  const plane = axis === 'x' ? 'XZ' : 'YZ';
  const profile = draw([cutPos - OVERLAP, floorZ])
    .lineTo([cutPos - OVERLAP, keyTop])
    .lineTo([cutPos, keyTop])
    .lineTo([protTip, keyTop - lead])
    .lineTo([protTip, floorZ + protrusion])
    .lineTo([cutPos, floorZ])
    .close();
  const raw = sketch(profile, plane, 0).extrude(2 * halfW);
  return recenterAxis(raw, perpAxis, perpC);
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
