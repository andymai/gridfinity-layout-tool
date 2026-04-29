/**
 * Click-lock lid geometry builder.
 *
 * Produces a standalone lid solid that mates with a Gridfinity bin's
 * stacking lip. The lid is built in lid-local coordinates so it can be
 * positioned and exported independently of the bin.
 *
 * Geometry breakdown:
 *   - `buildLidFloor`     — flat plate at the top
 *   - `buildMatingShell`  — inverted-lip wall built via outer/inner lofts
 *   - `buildClickRails`   — tapered snap rails on each straight wall
 *   - `buildStackGrid`    — Gridfinity lip profile on top (optional)
 *   - `cutMagnetHoles`    — standard magnet pattern through the floor
 *
 * Coordinate convention:
 *   Z = 0          : top of lid floor
 *   Z = -topThickness : bottom of lid floor (top of mating cavity)
 *   Z negative     : mating shell + click rails (extend down over bin lip)
 *   Z positive     : optional Gridfinity stack grid
 *
 * Supports both rectangular and non-rectangular (cellMask polygon) bin
 * footprints. For polygon bins, all profiles follow the polygon outline,
 * click rails are placed per straight edge, and magnet holes are skipped
 * in unfilled cells.
 */

import {
  draw,
  drawRoundedRectangle,
  drawCircle,
  unwrap,
  fuse,
  cut,
  cutAll,
  translate,
  rotate,
  withScope,
} from 'brepjs';
import type { Shape3D, DisposalScope, Sketch, ValidSolid, Drawing } from 'brepjs';
import { LIP_BIG_TAPER, pocketCornerRadius } from './generatorConstants';
import { SOCKET_HEIGHT, SOCKET_BIG_TAPER, SOCKET_TAPER_WIDTH, CLEARANCE } from './generatorTypes';
import {
  LID_CLICK_RAIL_BUMP,
  LID_CLICK_RAIL_ENTRY_CHAMFER,
  LID_CLICK_RAIL_EXIT_CHAMFER,
  LID_CLICK_RAIL_DROP,
  LID_CLICK_RAIL_TAIL,
  LID_CLICK_RAIL_OUT,
  LID_CLICK_RAIL_INSET,
  LID_CLICK_RAIL_INNER,
  LID_CLICK_RAIL_TOP_CHAMFER,
  LID_MAGNET_OFFSETS,
  LID_COPLANAR_MARGIN,
  LID_MIN_CORNER_RADIUS,
  lidAnchorZ,
  lidWallBottomZ,
  LID_FIT_CLEARANCE,
  LID_CORNER_RADIUS,
  LID_MAGNET_CEILING,
  lidTopThickness,
} from './lidConstants';
import type { BinParams } from '@/shared/types/bin';
import { buildMaskDrawingAtInset } from './maskPolygon';
import {
  isPartialMask,
  maskToPolygon,
  MASK_CELL_SIZE,
  type CellMask,
} from '@/shared/utils/cellMask';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import { forEachCell } from './cellDecomposition';

import { LID_MIN_RAIL_LENGTH as MIN_RAIL_LENGTH } from '@/shared/types/bin';

/** Geometric inputs derived from BinParams. */
interface LidInputs {
  readonly lidOuterW: number;
  readonly lidOuterD: number;
  readonly lidCornerR: number;
  readonly fitClearance: number;
  readonly topThickness: number;
  /**
   * Cavity inner-face inset from the lid's outer perimeter. The wall in
   * the lip-mating zone is `cavityInset - LIP_BIG_TAPER = LID_WALL_THICKNESS`
   * (= 1.85mm); above the lip the chamfer hasn't kicked in yet so the
   * wall reads as the full `cavityInset` (= 3.75mm).
   */
  readonly cavityInset: number;
  readonly stackableTop: boolean;
  readonly magnetHoles: boolean;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  readonly cellsX: number;
  readonly cellsY: number;
  readonly gridUnitMm: number;
  readonly heightUnitMm: number;
  /** Bin has a label on its back wall — disable click rails on the front/back walls. */
  readonly omitFrontBackRails: boolean;
  /**
   * Per-side click-rail engagement. When all four are `false` the lid
   * is friction-fit (no positive snap). Combined with `omitFrontBackRails`
   * to produce the effective per-side rail set during placement.
   */
  readonly clickRails: {
    readonly front: boolean;
    readonly back: boolean;
    readonly left: boolean;
    readonly right: boolean;
  };
  /**
   * Click-rail coverage as a fraction (0..1) of each wall's edge length.
   * Rails are always centered; a value of 1 keeps the historical
   * edge-to-edge behavior, lower values shrink the rail toward the
   * midpoint to save filament. Ignored when `clickRails === false`.
   */
  readonly clickRailCoverage: number;
  /** Z of the bin's lip top in lid-local coords when snapped (the "anchor" line). */
  readonly anchorZ: number;
  /** Z of the bottom of the mating wall (where the wall ends and rails begin). */
  readonly wallBottomZ: number;
  /** Custom-shape mask if the bin has one. Undefined = rectangular. */
  readonly cellMask: CellMask | undefined;
}

export function resolveLidInputs(params: BinParams): LidInputs {
  const { gridUnitMm, heightUnitMm } = params;
  // Single locked-down clearance — see comment on LID_FIT_CLEARANCE.
  const fitClearance = LID_FIT_CLEARANCE;
  // Floor plate grows when magnets are enabled to fit the pocket plus
  // a thin sealed ceiling above it (LID_MAGNET_CEILING).
  const topThickness = lidTopThickness(params.lid.magnetHoles, params.base.magnetDepth);

  // Lid outer footprint: `bin*42 - 2*Clearance` per side. The lid uses
  // its OWN corner radius (`LID_CORNER_RADIUS = 4mm`), NOT the bin's
  // `BOX_CORNER_RADIUS` (3.75mm) — using the bin value shifts rails,
  // shrinks walls, and breaks lip fit.
  const lidOuterW = params.width * gridUnitMm - 2 * fitClearance;
  const lidOuterD = params.depth * gridUnitMm - 2 * fitClearance;
  // lidCornerR and cavityInset are the same expression: both are the lid's
  // effective corner radius after clearance. `cavityInset` names the semantic
  // role (inner-face distance from outer perimeter); `lidCornerR` is used by
  // geometry helpers. Cavity wall thickness in the lip-mating zone =
  // cavityInset - LIP_BIG_TAPER = 1.85mm.
  const lidCornerR = LID_CORNER_RADIUS - fitClearance;
  const cavityInset = lidCornerR;

  // Polygon path activates when the mask is partially filled. A fully-filled
  // mask is treated as rectangular (matches the bin generator's convention).
  const cellMask = isPartialMask(params.cellMask) ? params.cellMask : undefined;

  return {
    lidOuterW,
    lidOuterD,
    lidCornerR,
    fitClearance,
    topThickness,
    cavityInset,
    stackableTop: params.lid.stackableTop,
    // Magnets only have a stack-grid neighbour to mate with when
    // `stackableTop` is on. Off ⇒ skip the pockets even if the user
    // last toggled magnets on.
    magnetHoles: params.lid.magnetHoles && params.lid.stackableTop,
    magnetDiameter: params.base.magnetDiameter,
    magnetDepth: params.base.magnetDepth,
    cellsX: params.width,
    cellsY: params.depth,
    gridUnitMm,
    heightUnitMm,
    // Label tabs always sit on the back wall (per labelTabBuilder convention).
    // Disable click rails along the bin's depth axis (front/back) so they
    // don't collide with the printed label tab.
    omitFrontBackRails: params.label.enabled,
    clickRails: params.lid.clickRails,
    // Coverage stored as 0–100 percentage on LidConfig; converted to
    // a 0–1 fraction here for direct multiplication against rail lengths.
    clickRailCoverage: params.lid.clickRailCoverage / 100,
    anchorZ: lidAnchorZ(heightUnitMm, fitClearance),
    wallBottomZ: lidWallBottomZ(heightUnitMm, fitClearance),
    cellMask,
  };
}

/**
 * Build a 2D outline at the requested inset from the lid's outer perimeter.
 * Returns either a rounded-rectangle drawing (rectangular bins) or a polygon
 * drawing (cellMask bins). Corner radius decreases with inset so all
 * loft sections in the same series remain topologically consistent.
 */
function buildOutlineDrawing(inputs: LidInputs, outerInset: number): Drawing {
  const { lidOuterW, lidOuterD, lidCornerR, gridUnitMm, fitClearance, cellMask } = inputs;
  const radius = Math.max(lidCornerR - outerInset, LID_MIN_CORNER_RADIUS);

  if (cellMask) {
    // Polygon path: total inset from the base (full grid) polygon =
    // fitClearance + outerInset. The polygon helper handles the inset and
    // corner rounding in closed form for axis-aligned polygons.
    return buildMaskDrawingAtInset(cellMask, gridUnitMm, fitClearance + outerInset, radius);
  }

  // Rectangular path
  const w = lidOuterW - 2 * outerInset;
  const d = lidOuterD - 2 * outerInset;
  return drawRoundedRectangle(w, d, radius);
}

function sectionAt(inputs: LidInputs, z: number, outerInset: number): Sketch {
  return buildOutlineDrawing(inputs, outerInset).sketchOnPlane('XY', z) as Sketch;
}

/* ──────────────────────────────────────────────────────────────────────
 * Mating shell — the inverted-lip wall that wraps the bin's stacking lip.
 *
 * Cross-section (Y vertical, going up from wall bottom to floor top):
 *   - Y ∈ [anchor, 0]: wall thickness = lidCornerR (full corner-radius)
 *   - Y ∈ [anchor - LIP_BIG_TAPER, anchor]: outer face chamfers inward by
 *     LIP_BIG_TAPER (matches the lip's top chamfer)
 *   - Y ∈ [wallBottom, anchor - LIP_BIG_TAPER]: wall thickness =
 *     lidCornerR - LIP_BIG_TAPER, matching the lip's vertical part
 *
 * Inner cavity boundary is constant at lidCornerR inset from outer (so the
 * lid corners are solid pillars that don't engage the bin's lip — engagement
 * happens on the straights via the click rails).
 *
 * Built as two lofts (outer + inner) and subtracted, mirroring the
 * `buildTopShapeLoft` strategy from boxBuilder.ts so we stay on the same
 * code path that's been validated against OCCT non-square sweep bugs.
 * ──────────────────────────────────────────────────────────────────────── */

function buildMatingShell(scope: DisposalScope, inputs: LidInputs): Shape3D {
  const { cavityInset, anchorZ, wallBottomZ } = inputs;
  const zVertTop = anchorZ - LIP_BIG_TAPER;

  // OUTER profile — 4 sections in ASCENDING Z (loftWith expects this):
  //  Z=wallBottom and Z=zVertTop : chamfered inward by LIP_BIG_TAPER
  //  Z=anchor and Z=0            : full outer (no chamfer)
  const outerSections: readonly Sketch[] = [
    sectionAt(inputs, wallBottomZ, LIP_BIG_TAPER),
    sectionAt(inputs, zVertTop, LIP_BIG_TAPER),
    sectionAt(inputs, anchorZ, 0),
    sectionAt(inputs, 0, 0),
  ];

  // INNER profile — constant inset at `cavityInset` for every Z. The
  // cavity wall in the lip-mating zone is `cavityInset - LIP_BIG_TAPER =
  // LID_WALL_THICKNESS`. Two sections in ASCENDING Z with COPLANAR margin
  // so the cut bites cleanly through the outer.
  const innerSections: readonly Sketch[] = [
    sectionAt(inputs, wallBottomZ - LID_COPLANAR_MARGIN, cavityInset),
    sectionAt(inputs, LID_COPLANAR_MARGIN, cavityInset),
  ];

  const [oFirst, ...oRest] = outerSections;
  const outerLoft = scope.register(oFirst.loftWith([...oRest], { ruled: true }));
  const [iFirst, ...iRest] = innerSections;
  const innerLoft = scope.register(iFirst.loftWith([...iRest], { ruled: true }));

  return unwrap(cut(outerLoft, innerLoft));
}

/* ──────────────────────────────────────────────────────────────────────
 * Floor plate — flat top of the lid.
 *
 * Flat plate at Z ∈ [-topThickness, 0] in the full lid-outer outline. Fuses
 * with the mating shell to seal the cavity at the top.
 * ──────────────────────────────────────────────────────────────────────── */

function buildLidFloor(scope: DisposalScope, inputs: LidInputs): Shape3D {
  const { topThickness } = inputs;
  return scope.register(
    buildOutlineDrawing(inputs, 0)
      .sketchOnPlane('XY', -topThickness)
      .extrude(topThickness) as Shape3D
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Click rails — snap features extruded along each straight wall.
 *
 * Cross-section (X = outward from corner-radius line, Y = vertical):
 *   The polygon has its top at Z=wallBottom (just below the mating wall),
 *   protrudes OUTWARD by LID_CLICK_RAIL_OUT to form the rail bump that
 *   catches the lip's bottom chamfer, drops down, then has an inner shelf
 *   that gives the rail body structural depth.
 *
 * Each rail is built in a canonical orientation (extrusion along X axis,
 * profile in YZ plane), then translated/rotated to each straight wall.
 * Rails are inset from corners by `lidCornerR` on both ends.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Top-chamfer apex X for a rail bar, given the cavity wall's rail-local X.
 *
 * The chamfer slopes 45° from the rail's inner-face top corner up to this
 * apex; we want the apex to land on the cavity wall so the rail attaches
 * flush instead of leaving an unsupported tongue hanging into the cavity.
 * When the cavity wall is at or inboard of the spine (LID_WALL_THICKNESS
 * ≳ 1.85mm), the apex falls back to the baseline 0.8mm chamfer width.
 *
 * Exported for unit testing of the geometric relationship.
 */
export function chamferApexXForCavityWall(cavityWallX: number): number {
  return Math.max(LID_CLICK_RAIL_INNER + LID_CLICK_RAIL_TOP_CHAMFER, cavityWallX);
}

/**
 * Build the rail's 2D cross-section.
 *
 * @param wallBottomZ Z of the rail's top face (= bottom of mating wall).
 * @param cavityWallX Rail-local X of the lid's cavity inner face. The rail
 *   spine sits at X=0 and is anchored at the lid's corner-radius line; the
 *   cavity wall sits at `lidCornerR - cavityInset` away from the spine in
 *   the outward (+X) direction. The top chamfer's apex extends to meet
 *   this position so the rail attaches flush to the cavity wall instead
 *   of leaving an unsupported tongue hanging in midair.
 *
 *   At thin walls (default 1.2mm), cavityWallX > 0 (cavity wall is OUTWARD
 *   of the rail spine) and the chamfer must grow to reach it. At thicker
 *   walls (~1.85mm) the cavity wall coincides with the spine and the
 *   chamfer reverts to its baseline 0.8mm height.
 */
function clickShape2D(wallBottomZ: number, cavityWallX: number): Drawing {
  // Top of polygon = top of rail = bottom of mating wall.
  const yTop = wallBottomZ;
  // Y heights stepping down from the rail's top.
  const y1 = yTop - LID_CLICK_RAIL_ENTRY_CHAMFER; // -0.8
  const y2 = y1 - LID_CLICK_RAIL_BUMP - 0.1; // rail body bottom
  const y3 = y2 - LID_CLICK_RAIL_EXIT_CHAMFER; // exit chamfer
  const y4 = y3 - LID_CLICK_RAIL_DROP; // post-bump drop
  const y5 = y4 - LID_CLICK_RAIL_TAIL; // bottom apex

  const chamferApexX = chamferApexXForCavityWall(cavityWallX);
  const chamferTopY = yTop + (chamferApexX - LID_CLICK_RAIL_INNER);

  return draw([chamferApexX, yTop])
    .lineTo([LID_CLICK_RAIL_OUT, yTop])
    .lineTo([LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET, y1])
    .lineTo([LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET, y2])
    .lineTo([LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET + LID_CLICK_RAIL_EXIT_CHAMFER, y3])
    .lineTo([LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET + LID_CLICK_RAIL_EXIT_CHAMFER, y4])
    .lineTo([0, y5])
    .lineTo([LID_CLICK_RAIL_INNER, y5])
    .lineTo([LID_CLICK_RAIL_INNER, yTop])
    .lineTo([chamferApexX, chamferTopY])
    .close();
}

/**
 * Build a single click rail bar in a canonical orientation: extruded along
 * the X axis (length = wallLength), profile in YZ plane at X=0. The rail's
 * outward direction is +Y (so the bump protrudes in +Y), and its top sits
 * at Z=wallBottomZ.
 */
function buildClickRailBar(
  scope: DisposalScope,
  wallBottomZ: number,
  cavityWallX: number,
  length: number
): Shape3D {
  // Build polygon in a 2D plane where local X = outward, local Y = vertical.
  // Sketch on YZ plane (perpendicular to wall direction = X axis).
  const profile = clickShape2D(wallBottomZ, cavityWallX);
  const sketch = profile.sketchOnPlane('YZ', -length / 2);
  return scope.register(sketch.extrude(length) as Shape3D);
}

/**
 * One rail to place on a wall: along which axis does the rail extrude
 * ('x' or 'y') and which way does the bump point (+1 or -1 along the
 * perpendicular axis).
 */
interface RailPlacement {
  /** Rail center position in world coords. */
  readonly centerX: number;
  readonly centerY: number;
  /** Length along the extrusion axis. */
  readonly length: number;
  /** Z rotation in degrees that maps the canonical bar to the target orientation. */
  readonly rotationDeg: number;
}

/**
 * Compute rail placements for a polygon bin.
 *
 * Walks the polygon's outer loop. For each axis-aligned edge:
 *  - Computes inward normal (interior is on LEFT of edge direction in CCW)
 *  - Outward = -inward
 *  - Insets the edge by `lidCornerR` from each end so the rail stays clear
 *    of corners (which are filled mating-shell pillars)
 *  - Skips edges shorter than MIN_RAIL_LENGTH after inset
 *  - Honors `omitFrontBackRails` for edges whose outward normal is along Y
 *
 * Bump direction (canonical bar bumps in +Y):
 *   Z rotation that maps +Y → outward (rule from boxBuilder convention):
 *     outward (0, +1) → 0°       (+Y stays +Y)
 *     outward (0, -1) → 180°     (+Y → -Y)
 *     outward (+1, 0) → -90°     (+Y → +X via -90°)
 *     outward (-1, 0) → 90°      (+Y → -X via 90°)
 */
function railPlacementsForPolygon(inputs: LidInputs): RailPlacement[] {
  const {
    cellMask,
    gridUnitMm,
    lidCornerR,
    fitClearance,
    omitFrontBackRails,
    clickRails,
    clickRailCoverage,
  } = inputs;
  if (!cellMask) return [];

  const loops = maskToPolygon(cellMask);
  const outer = loops[0];
  const halfWidthMm = (cellMask.cols * MASK_CELL_SIZE * gridUnitMm) / 2;
  const halfDepthMm = (cellMask.rows * MASK_CELL_SIZE * gridUnitMm) / 2;

  // Convert to mm, centered on the lid origin (matching the rectangular path).
  const verticesMm = outer.map((p) => ({
    x: p.x * gridUnitMm - halfWidthMm,
    y: p.y * gridUnitMm - halfDepthMm,
  }));

  // For each polygon edge, compute the rail's position independently. The
  // rail spine sits `(fitClearance + lidCornerR)` perpendicular-inward from
  // the polygon edge (matching `lidOuterW/2 - lidCornerR` in the rectangular
  // path), inset along the edge by `lidCornerR` from each end so it stays
  // clear of corner radii on both sides.
  const railInset = fitClearance + lidCornerR;
  const n = verticesMm.length;
  const placements: RailPlacement[] = [];

  for (let i = 0; i < n; i++) {
    const a = verticesMm[i];
    const b = verticesMm[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const edgeLen = Math.abs(dx) + Math.abs(dy); // axis-aligned

    // Rail spans the edge minus 2× corner radius (clear of corners), then
    // shrunk to `clickRailCoverage` (centered on the wall). Skip if the
    // resulting rail is too short to be useful.
    const railLen = (edgeLen - 2 * lidCornerR) * clickRailCoverage;
    if (railLen < MIN_RAIL_LENGTH) continue;

    // Edge direction unit (axis-aligned, so just sign).
    const edgeDirX = Math.sign(dx);
    const edgeDirY = Math.sign(dy);
    // Outward normal: right-perpendicular of edge direction (CCW polygon).
    const outX = edgeDirY;
    const outY = -edgeDirX;
    // Inward normal: opposite of outward (= left-perpendicular).
    const inX = -outX;
    const inY = -outY;

    // Classify the edge by outward direction so we can apply the
    // user's per-side toggle. Non-axis-aligned edges (shouldn't happen
    // for cellMask polygons) are skipped before this check.
    let rotationDeg: number;
    let side: 'front' | 'back' | 'left' | 'right';
    if (outX === 0 && outY === 1) {
      rotationDeg = 0;
      side = 'back';
    } else if (outX === 0 && outY === -1) {
      rotationDeg = 180;
      side = 'front';
    } else if (outX === 1 && outY === 0) {
      rotationDeg = -90;
      side = 'right';
    } else if (outX === -1 && outY === 0) {
      rotationDeg = 90;
      side = 'left';
    } else {
      continue;
    }

    // User per-side toggle: skip if this side's rail is disabled.
    if (!clickRails[side]) continue;

    // Skip front/back rails when label tabs would collide. Label tabs
    // sit on the back wall; we skip both front and back to keep symmetry,
    // matching the rectangular path.
    if (omitFrontBackRails && (side === 'front' || side === 'back')) continue;

    // Rail center: edge midpoint shifted INWARD by railInset (perpendicular
    // to edge direction). This places the rail spine on the corner-radius line.
    const midX = (a.x + b.x) / 2 + inX * railInset;
    const midY = (a.y + b.y) / 2 + inY * railInset;

    placements.push({
      centerX: midX,
      centerY: midY,
      length: railLen,
      rotationDeg,
    });
  }

  return placements;
}

/** Compute rail placements for a rectangular bin (4 walls). */
function railPlacementsForRectangle(inputs: LidInputs): RailPlacement[] {
  const { lidOuterW, lidOuterD, lidCornerR, omitFrontBackRails, clickRails, clickRailCoverage } =
    inputs;
  // Rail spans wall length minus corner radii on both ends, then shrunk
  // to `clickRailCoverage` (centered on the wall) to save filament.
  const railLengthX = (lidOuterW - 2 * lidCornerR) * clickRailCoverage;
  const railLengthY = (lidOuterD - 2 * lidCornerR) * clickRailCoverage;
  const corneredOuterX = lidOuterW / 2 - lidCornerR;
  const corneredOuterY = lidOuterD / 2 - lidCornerR;

  const placements: RailPlacement[] = [];

  // Each side is independently gated by `clickRails[side]` AND the
  // label-tab override (`omitFrontBackRails` skips front+back). The min-
  // length guard skips edges too short to print a useful rail.
  const wantBack = clickRails.back && !omitFrontBackRails && railLengthX >= MIN_RAIL_LENGTH;
  const wantFront = clickRails.front && !omitFrontBackRails && railLengthX >= MIN_RAIL_LENGTH;
  const wantRight = clickRails.right && railLengthY >= MIN_RAIL_LENGTH;
  const wantLeft = clickRails.left && railLengthY >= MIN_RAIL_LENGTH;

  if (wantBack) {
    // Back wall: outward +Y, rotation 0°
    placements.push({ centerX: 0, centerY: corneredOuterY, length: railLengthX, rotationDeg: 0 });
  }
  if (wantFront) {
    // Front wall: outward -Y, rotation 180°
    placements.push({
      centerX: 0,
      centerY: -corneredOuterY,
      length: railLengthX,
      rotationDeg: 180,
    });
  }

  if (wantRight) {
    // Right wall: outward +X, rotation -90°
    placements.push({
      centerX: corneredOuterX,
      centerY: 0,
      length: railLengthY,
      rotationDeg: -90,
    });
  }
  if (wantLeft) {
    // Left wall: outward -X, rotation 90°
    placements.push({
      centerX: -corneredOuterX,
      centerY: 0,
      length: railLengthY,
      rotationDeg: 90,
    });
  }

  return placements;
}

function addClickRails(
  scope: DisposalScope,
  body: Shape3D,
  inputs: LidInputs,
  originToTag?: Map<number, number>
): Shape3D {
  const placements = inputs.cellMask
    ? railPlacementsForPolygon(inputs)
    : railPlacementsForRectangle(inputs);

  // Cavity wall position in rail-local X (where +X is outward from the
  // spine). The spine sits at `lidCornerR` from the lid outer; the cavity
  // wall sits at `cavityInset`. Their difference tells the rail's chamfer
  // how far outward it needs to climb to meet the wall flush.
  const cavityWallX = inputs.lidCornerR - inputs.cavityInset;

  let result = body;
  for (const place of placements) {
    const rail = buildClickRailBar(scope, inputs.wallBottomZ, cavityWallX, place.length);
    const oriented =
      place.rotationDeg === 0
        ? rail
        : scope.register(rotate(rail, place.rotationDeg, { axis: [0, 0, 1] }));
    const positioned = scope.register(translate(oriented, [place.centerX, place.centerY, 0]));
    // Tag each rail's faces as LID_RAIL before it gets fused into the body.
    // (Note: brepjs's face-origin tracking currently maps every fresh shape's
    // faces to origin=0, so this map collapses to last-writer-wins in practice.
    // We populate it anyway so consumers downstream can use it once brepjs's
    // origin tracking improves; today's hover effect uses whole-mesh glow.)
    if (originToTag) {
      collectOrigins(positioned, FeatureTag.LID_RAIL, originToTag);
    }
    scope.register(result);
    result = unwrap(fuse(result, positioned));
  }
  return result;
}

/* ──────────────────────────────────────────────────────────────────────
 * Stack grid — slab-minus-pockets, mirroring `baseplateGenerator` exactly.
 *
 * Build a `SOCKET_HEIGHT`-tall slab covering the lid's outer footprint,
 * then cut a baseplate-style tapered pocket per cell. The pocket
 * dimensions match the baseplate's `buildPocketCutter` exactly — same
 * SOCKET_BIG_TAPER chamfer, SOCKET_HEIGHT depth, and CLEARANCE/2 wall
 * step at the top — so an upper bin's base socket engages the lid the
 * same way it engages a baseplate. The remaining slab material between
 * pockets forms the outer ring + inner dividers naturally.
 *
 * Pocket cross-section (Z is vertical above the lid floor):
 *   Z=SOCKET_HEIGHT             inset = 0                   (top opening)
 *   Z=SOCKET_HEIGHT-CLEARANCE/2 inset = 0                   (clearance step)
 *   Z=SOCKET_HEIGHT-2.4         inset = INSET_MID = 2.15    (top chamfer end)
 *   Z=SOCKET_TAPER_WIDTH-CL/2   inset = INSET_MID            (vertical wall)
 *   Z=0                         inset = INSET_BOT = 2.95    (bottom)
 * Plus coplanar-margin caps above and below the slab so the boolean
 * cut bites cleanly through both faces.
 * ──────────────────────────────────────────────────────────────────────── */

/** Insets at each Z breakpoint — same values as `baseplateGenerator`. */
const STACK_INSET_TOP = 0;
const STACK_INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm
const STACK_INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

/**
 * Build a single pocket cutter for one cell. Multi-section loft with
 * the same five sections + two coplanar caps that
 * `baseplateGenerator.buildPocketCutter` uses, just translated UP by
 * `SOCKET_HEIGHT` so the slab sits at Z ∈ [0, SOCKET_HEIGHT] rather
 * than the baseplate's Z ∈ [-SOCKET_HEIGHT, 0].
 */
function buildLidStackPocketCutter(cellW_mm: number, cellD_mm: number): Shape3D {
  // Pocket corner radius — same as the baseplate (`SOCKET_CORNER_RADIUS`
  // = 4mm, clamped to fit small cells). This gives the wall
  // intersections between adjacent pockets the proper rounded
  // transition Gridfinity baseplates have. A small cornerR (e.g., 1mm)
  // makes the wall corners look sharp/blocky.
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  const section = (z: number, inset: number): Sketch => {
    const w = Math.max(cellW_mm - 2 * inset, 0.1);
    const d = Math.max(cellD_mm - 2 * inset, 0.1);
    const r = Math.max(cornerR - inset, 0.1);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
  };

  // Slab top sits at Z=SOCKET_HEIGHT (5mm above the lid floor); pocket
  // breakpoints walk DOWN from there mirroring the baseplate's profile.
  const TOP = SOCKET_HEIGHT;
  const s0 = section(TOP + LID_COPLANAR_MARGIN, STACK_INSET_TOP);
  const sections: Sketch[] = [
    section(TOP, STACK_INSET_TOP),
    section(TOP - CLEARANCE / 2, STACK_INSET_TOP),
    section(TOP - SOCKET_BIG_TAPER, STACK_INSET_MID),
    section(TOP - SOCKET_BIG_TAPER - (SOCKET_HEIGHT - SOCKET_TAPER_WIDTH), STACK_INSET_MID),
    section(0, STACK_INSET_BOT),
    section(-LID_COPLANAR_MARGIN, STACK_INSET_BOT),
  ];
  return s0.loftWith(sections, { ruled: true });
}

function buildStackGrid(scope: DisposalScope, inputs: LidInputs): Shape3D {
  const { cellsX, cellsY, gridUnitMm } = inputs;

  // 1. Slab — lid's outer footprint extruded UP by SOCKET_HEIGHT (5mm,
  //    matching the baseplate's slab depth). `buildOutlineDrawing(inputs, 0)`
  //    gives the full perimeter — rounded for plain bins, polygon for
  //    cellMask bins.
  const slabSketch = buildOutlineDrawing(inputs, 0).sketchOnPlane('XY', 0) as Sketch;
  let slab: Shape3D = scope.register(slabSketch.extrude(SOCKET_HEIGHT));

  // 2. Pocket cutters — one per filled cell. `forEachCell` decomposes
  //    half-bin grids into 1u + 0.5u sub-cells; we cut a pocket sized
  //    to whichever sub-cell appears at each position. Polygon
  //    (cellMask) bins skip pockets in unfilled cells so the lip
  //    pattern only covers material that actually exists.
  const halfTotalW = (cellsX * gridUnitMm) / 2;
  const halfTotalD = (cellsY * gridUnitMm) / 2;
  const pockets: Shape3D[] = [];
  forEachCell(
    cellsX,
    cellsY,
    (cell) => {
      const cellW = cell.widthUnits * gridUnitMm;
      const cellD = cell.depthUnits * gridUnitMm;
      if (inputs.cellMask) {
        const cellX = Math.round((cell.centerX + halfTotalW - gridUnitMm / 2) / gridUnitMm);
        const cellY = Math.round((cell.centerY + halfTotalD - gridUnitMm / 2) / gridUnitMm);
        if (!isCellFilled(inputs.cellMask, cellX, cellY)) return;
      }
      const pocket = buildLidStackPocketCutter(cellW, cellD);
      const positioned = scope.register(translate(pocket, [cell.centerX, cell.centerY, 0]));
      pocket.delete();
      pockets.push(positioned);
    },
    { gridUnitMm }
  );

  if (pockets.length > 0) {
    scope.register(slab);
    slab = unwrap(cutAll(slab as ValidSolid, pockets as ValidSolid[]));
  }
  return slab;
}

/* ──────────────────────────────────────────────────────────────────────
 * Magnet holes — standard Gridfinity magnet pattern.
 *
 * 4 holes per cell at ±13mm from the cell center. For polygon bins, only
 * filled cells get magnets.
 * ──────────────────────────────────────────────────────────────────────── */

function isCellFilled(mask: CellMask, cellX: number, cellY: number): boolean {
  // Each whole grid cell maps to a 2×2 mask region. Treat the whole cell as
  // filled only when ALL four mask cells are set; otherwise skip magnets to
  // avoid placing a hole that would clip the polygon boundary.
  const baseCol = cellX * 2;
  const baseRow = cellY * 2;
  for (let dr = 0; dr < 2; dr++) {
    for (let dc = 0; dc < 2; dc++) {
      const c = baseCol + dc;
      const r = baseRow + dr;
      if (c < 0 || c >= mask.cols || r < 0 || r >= mask.rows) return false;
      if (mask.cells[r * mask.cols + c] !== 1) return false;
    }
  }
  return true;
}

function cutMagnetHoles(scope: DisposalScope, body: Shape3D, inputs: LidInputs): Shape3D {
  const { cellsX, cellsY, gridUnitMm, magnetDiameter, magnetDepth, topThickness, cellMask } =
    inputs;
  const radius = magnetDiameter / 2;

  // BLIND pocket on the floor's UPPER face — opens at the floor TOP
  // (lid-local Z = 0, the visible top surface that an upper bin sits on
  // when stacked) and stops short of the floor BOTTOM by
  // LID_MAGNET_CEILING so the magnet sits in a sealed cup. The upper
  // bin's base magnets enter from above and mate with these pockets.
  // Capping at `topThickness - ceiling` is defensive in case
  // `topThickness` was bumped up by `lidTopThickness` for an oversize
  // magnet — guarantees we never poke through the cavity face. Floor
  // top gets a small coplanar margin so the cut bites cleanly through
  // the entry face.
  const cappedDepth = Math.max(0.4, Math.min(magnetDepth, topThickness - LID_MAGNET_CEILING));
  // Sketch sits below the floor top by `cappedDepth` so the extruded
  // cylinder reaches Z = 0 (top face) plus a coplanar margin above.
  const holeZ = -cappedDepth;
  const holeHeight = cappedDepth + LID_COPLANAR_MARGIN;

  // Build all cylinder cutters first, then apply them in a single cutAll.
  // Faster than per-magnet cut() for non-trivial lids — a 10×10 polygon lid
  // has ~400 holes; per-cut would be 400 boolean ops vs one batched op here.
  const cutters: Shape3D[] = [];
  // forEachCell handles fractional dimensions (half-bin mode): it decomposes
  // the lid footprint into 1u full cells + a trailing 0.5u half-cell. Skip
  // half-cells — Gridfinity doesn't define magnet positions for fractional
  // cells (matches `socketBuilder.buildBaseSocket`), so the lid magnets line
  // up with the bin's base sockets.
  const halfTotalW = (cellsX * gridUnitMm) / 2;
  const halfTotalD = (cellsY * gridUnitMm) / 2;
  forEachCell(
    cellsX,
    cellsY,
    (cell) => {
      if (cell.widthUnits !== 1 || cell.depthUnits !== 1) return;
      if (cellMask) {
        // Convert full-cell center → integer cellMask cell index.
        const cellX = Math.round((cell.centerX + halfTotalW - gridUnitMm / 2) / gridUnitMm);
        const cellY = Math.round((cell.centerY + halfTotalD - gridUnitMm / 2) / gridUnitMm);
        if (!isCellFilled(cellMask, cellX, cellY)) return;
      }
      for (const [ox, oy] of LID_MAGNET_OFFSETS) {
        const cylinder = drawCircle(radius)
          .sketchOnPlane('XY', holeZ)
          .extrude(holeHeight) as Shape3D;
        cutters.push(
          scope.register(translate(cylinder, [cell.centerX + ox, cell.centerY + oy, 0]))
        );
      }
    },
    { gridUnitMm }
  );

  if (cutters.length === 0) return body;

  scope.register(body);
  return unwrap(cutAll(body as ValidSolid, cutters as ValidSolid[]));
}

/**
 * Build the click-lock lid as a single brepjs solid in lid-local coordinates.
 *
 * Caller is responsible for the returned solid's lifetime; this function
 * uses an internal `withScope` so all intermediates are released.
 *
 * @param params bin params (reads `params.lid` and related)
 * @param originToTag optional map populated with face-origin → FeatureTag
 *   entries. Pass an empty Map to receive face-group provenance for the
 *   built lid; rails get tagged `LID_RAIL`, body shapes get `LID_BODY`,
 *   so consumers can render the lid with rail-precision hover effects.
 */
export function buildLid(params: BinParams, originToTag?: Map<number, number>): Shape3D {
  const inputs = resolveLidInputs(params);

  return withScope((scope: DisposalScope) => {
    // 1. Floor + mating shell — fused into the main body
    const floor = buildLidFloor(scope, inputs);
    const matingShell = scope.register(buildMatingShell(scope, inputs));
    if (originToTag) {
      // Tag the body shapes BEFORE fusing — origins from these shapes are
      // what surface in the post-fuse face groups.
      collectOrigins(floor, FeatureTag.LID_BODY, originToTag);
      collectOrigins(matingShell, FeatureTag.LID_BODY, originToTag);
    }
    let body: Shape3D = unwrap(fuse(floor, matingShell));

    // 2. Click rails — fuse onto the mating shell from outside (tags rails).
    // Skipped entirely when no side has rails enabled, producing a
    // friction-fit lid (mating cavity still wraps the lip; just no
    // positive snap). The placement functions also gate per-side, but
    // the early skip avoids the boolean-op overhead for friction-fit lids.
    const { clickRails } = inputs;
    const anyRail = clickRails.front || clickRails.back || clickRails.left || clickRails.right;
    if (anyRail) {
      body = addClickRails(scope, body, inputs, originToTag);
    }

    // 3. Optional Gridfinity stack grid on top
    if (inputs.stackableTop) {
      const stackGrid = scope.register(buildStackGrid(scope, inputs));
      if (originToTag) {
        collectOrigins(stackGrid, FeatureTag.LID_BODY, originToTag);
      }
      scope.register(body);
      body = unwrap(fuse(body, stackGrid));
    }

    // 4. Optional magnet holes through the floor
    if (inputs.magnetHoles) {
      body = cutMagnetHoles(scope, body, inputs);
    }

    return body as ValidSolid;
  });
}
