/**
 * Alignment connector builder for split bin pieces.
 *
 * Generates tongue-and-groove features on cut faces so split bin pieces
 * can be quickly aligned and glued together:
 *
 * - Wall connectors: auto-selected by wall thickness:
 *   - Thin walls (< 1.4mm): half-lap joints (each piece keeps half the wall)
 *   - Thick walls (≥ 1.4mm): tongue-and-groove with 55° chamfers
 * - Floor tongue: horizontal tongue centered in the floor slab with 55° chamfers.
 *   Top taper is invisible (swallowed by existing floor material on fuse).
 *
 * All features respect FDM printing constraints:
 * - Minimum feature width: 0.7mm (~2× 0.4mm nozzle)
 * - Minimum feature height: 0.5mm (reliable OCCT boolean threshold)
 * - Minimum shell around grooves: 0.2mm (~1 print layer)
 * - Groove depth = tongue depth + clearance (prevents bottoming out)
 * - Default clearance 0.15mm per side for glue-fit assembly
 * - 55° max overhang angle on all horizontal surfaces (safe for most printers)
 * - Features shortened near corner intersections of perpendicular cuts
 *
 * Direction convention (both male and female extrude in +axis):
 * - Male (tongue): sketch OVERLAP inside piece body, extrudes outward
 *   through the cut face. Fused onto the left/front piece.
 * - Female (groove): sketch OVERLAP OUTSIDE piece body (past cut face),
 *   extrudes inward. Boolean subtraction clips the overhang, producing
 *   a groove that opens cleanly at the mating face.
 */

import { drawRectangle, unwrap, fuse, cut, translate, getBounds } from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import type { SplitConnectorConfig } from '@/shared/types/bin';
import { sketch } from './generatorTypes';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Overlap into the piece body so booleans have shared volume (mm).
 *  Must be large enough for OCCT to reliably fuse/cut the shapes.
 *  0.15mm was too thin and caused silent boolean failures. */
const OVERLAP = 1.0;

/** Minimum printable feature WIDTH (mm). Set below 2× nozzle width (0.8mm)
 *  to allow wall tongues at the common 1.2mm wall thickness, where the
 *  max tongue width is ~0.5mm after clearance and shell constraints. */
const MIN_FEATURE_WIDTH = 0.7;

/** Minimum feature HEIGHT (mm) for reliable OCCT boolean operations.
 *  Must be thick enough for OCCT to create valid solids. */
const MIN_FEATURE_HEIGHT = 0.5;

/** Minimum shell thickness (mm) around a groove to remain printable.
 *  0.2mm = one print layer at the most common layer height. */
const MIN_SHELL = 0.2;

/** Tolerance for floating-point comparison of mm dimensions.
 *  Without this, expressions like 1.2 - 2×0.2 - 2×0.15 yield
 *  0.49999…94 instead of 0.5, silently skipping floor tongues
 *  at the default 1.2mm wall thickness. */
const EPSILON = 1e-9;

/** Chamfer slope ratio: chamfer_height / protrusion_depth.
 *  cot(max_overhang_angle_from_vertical).
 *  0.7 → 55° overhang (safe on most modern printers with PLA). */
const CHAMFER_SLOPE = 0.7;

/** Wall thickness threshold (mm) for auto-selecting joint style.
 *  Below this: half-lap joints (cut-based, works at any wall thickness).
 *  At or above: tongue-and-groove joints (additive, needs room for tongue). */
const HALF_LAP_WALL_THRESHOLD = 1.4;

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
  readonly wallThickness: number;
  /** Floor slab thickness (mm). Equal to wallThickness from the shell operation,
   *  but decoupled so floor tongue sizing is independent of wall changes. */
  readonly floorThickness: number;
  /** Stacking lip height (mm). 0 when no lip is present, 4.4mm with a lip.
   *  Half-lap wall cuts extend through the lip so both halves interlock
   *  when the split pieces are assembled. */
  readonly lipHeight: number;
  /** Stacking lip inward taper width (mm). 0 when no lip is present, 2.6mm with a lip.
   *  The lip extends this far inward from the outer bin edge. On the male side,
   *  the half-lap cut must be widened to remove the full inner lip overhang. */
  readonly lipTaperWidth: number;
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
  }

  // Capture the piece's bounding box extent to validate boolean results.
  // OCCT can silently return garbage (e.g., just a tongue shape instead of
  // piece + tongue) without throwing. We detect this by checking that the
  // result's extent is at least 80% of the original piece on each axis.
  const pieceBounds = getBounds(piece);
  const pieceExtent: [number, number, number] = [
    pieceBounds.xMax - pieceBounds.xMin,
    pieceBounds.yMax - pieceBounds.yMin,
    pieceBounds.zMax - pieceBounds.zMin,
  ];

  // Apply booleans one at a time — batch operations (fuseAll/cutAll) are more
  // prone to silent OCCT failures. Each result is validated against the
  // original extent to catch garbage outputs.
  let result = applyBooleans(piece, fuseTargets, fuse, pieceExtent);
  result = applyBooleans(result, cutTargets, cut, pieceExtent);

  return result;
}

type Extent = [number, number, number];

/** Apply a sequence of boolean operations (fuse or cut) one at a time,
 *  validating each result against the original piece extent. Skips any
 *  operation that fails or produces a suspiciously small result. */
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
      // Boolean failed — skip this feature
    }
  }
  return result;
}

/** Check that a boolean result preserved the piece body.
 *  Returns false if the result's extent shrank below 80% on any axis,
 *  indicating OCCT silently returned garbage. */
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

  // Fall back to rectangular when chamfers are negligible, or when the feature
  // is too thin for a meaningful taper. Thin wall tongues (width < 2mm) produce
  // near-degenerate sliver faces in the loft that crash OCCT booleans.
  if ((heightChamfer < 0.1 && widthChamfer < 0.1) || height < 1.0 || width < 2.0) {
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

// ─── Half-Lap Wall Joint ────────────────────────────────────────────────────

/**
 * Build an overlapping half-lap joint for a wall at the cut face.
 *
 * Each piece gets two features:
 * 1. A **cut** (subtractive) removing the opposing half of wall+lip for lapDepth
 *    from the cut face, creating a recess for the other piece's tab.
 * 2. A **tab** (additive) extending its own half of the wall past the cut face
 *    by lapDepth, filling the opposing piece's recess.
 *
 * Male piece: outer tab extends past cut face, inner half is cut away.
 * Female piece: inner tab extends past cut face, outer half is cut away.
 *
 * When a stacking lip is present, the cut extends through the lip height
 * (and is widened on the male side to cover the lip's inner overhang).
 * The tab covers only the wall zone — the lip's tapered profile can't be
 * approximated by a rectangular prism, so the lip zone has just the step
 * for glue surface area.
 */
function addHalfLapWallFeature(
  face: CutFace,
  fuseTargets: Shape3D[],
  cutTargets: Shape3D[],
  lapDepth: number,
  wallHeight: number,
  lipHeight: number,
  bottomZ: number,
  edgePos: number,
  wallThickness: number,
  lipTaperWidth: number,
  clearance: number
): void {
  if (edgePos === 0) return; // Wall coincides with bin center — no meaningful lap joint
  const sign = Math.sign(edgePos);
  const halfWt = wallThickness / 2;
  const isMale = face.isMale;

  // ── Subtractive: remove opposing half of wall + lip ─────────────────────
  // Male cut must be wide enough for the lip's inner overhang.
  // Female cut covers the outer half — halfWt from centerline suffices.
  const totalHeight = wallHeight + lipHeight;
  const cutExtent = isMale && lipTaperWidth > 0 ? lipTaperWidth - halfWt : halfWt;
  const cutWidth = cutExtent + 2 * clearance;
  const cutShift = (sign * cutExtent) / 2;

  // Both sides need depthExtra so the opposing tab doesn't bottom out.
  const cutSketchPos = isMale
    ? face.position - lapDepth - clearance - OVERLAP
    : face.position - OVERLAP;
  const cutDepth = lapDepth + clearance + 2 * OVERLAP;

  cutTargets.push(
    buildPrism(
      face.axis,
      cutSketchPos,
      cutDepth,
      cutWidth,
      totalHeight,
      bottomZ,
      edgePos + (isMale ? -cutShift : cutShift)
    )
  );

  // ── Additive: extend own half of the wall past the cut face ─────────────
  // Tab covers only the wall zone (rectangular prism matches the wall).
  // The lip zone gets the subtractive step above for glue surface.
  const tabWidth = halfWt;
  const tabShift = (sign * halfWt) / 2;

  if (isMale) {
    // Male tab: outer half of wall extending into female territory
    fuseTargets.push(
      buildPrism(
        face.axis,
        face.position - OVERLAP,
        lapDepth + OVERLAP,
        tabWidth,
        wallHeight,
        bottomZ,
        edgePos + tabShift
      )
    );
  } else {
    // Female tab: inner half of wall extending into male territory
    fuseTargets.push(
      buildPrism(
        face.axis,
        face.position - lapDepth,
        lapDepth + OVERLAP,
        tabWidth,
        wallHeight,
        bottomZ,
        edgePos - tabShift
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

  // ── Wall connectors (at outer bin walls only) ──────────────────────────
  // Auto-select joint style based on wall thickness:
  // - Thin walls (< 1.4mm): half-lap joints (subtractive, always viable)
  // - Thick walls (≥ 1.4mm): tongue-and-groove (additive, needs room)
  const useHalfLap = wt < HALF_LAP_WALL_THRESHOLD;

  // For T&G, pre-check that the tongue fits; skip wall connectors entirely if not.
  const maxGrooveWidth = wt - 2 * MIN_SHELL;
  const tongueWidth = Math.min(config.tongueThickness, maxGrooveWidth - 2 * config.clearance);
  const canAddTongue = !useHalfLap && tongueWidth >= MIN_FEATURE_WIDTH - EPSILON;

  if (useHalfLap || canAddTongue) {
    for (const edgePos of [-wallOffset, wallOffset]) {
      if (edgePos < pieceMin || edgePos > pieceMax) continue;
      const nearCut = face.perpendicularCuts.some((cp) => Math.abs(edgePos - cp) < wt * 2);
      if (nearCut) continue;

      if (useHalfLap) {
        addHalfLapWallFeature(
          face,
          fuseTargets,
          cutTargets,
          config.tongueProtrusion,
          wallHeight,
          context.lipHeight,
          context.floorZ,
          edgePos,
          wt,
          context.lipTaperWidth,
          config.clearance
        );
      } else {
        addFeature(
          face,
          config.clearance,
          fuseTargets,
          cutTargets,
          config.tongueProtrusion,
          tongueWidth,
          wallHeight,
          context.floorZ,
          edgePos,
          true
        );
      }
    }
  }

  // ── Floor tongue (centered on piece, shortened near corners) ───────────
  // Floor slab thickness is constant — tongue height is sized from it,
  // independent of wall thickness changes.
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
