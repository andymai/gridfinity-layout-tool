/**
 * Click rails — snap features extruded along each straight wall of the lid.
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
 */

import { draw, unwrap, fuse, translate, rotate } from 'brepjs';
import type { Shape3D, DisposalScope, Drawing } from 'brepjs';
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
} from './lidConstants';
import { maskToPolygon, MASK_CELL_SIZE } from '@/shared/utils/cellMask';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import { LID_MIN_RAIL_LENGTH as MIN_RAIL_LENGTH } from '@/shared/types/bin';
import type { LidInputs } from './lidInputs';

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
  return scope.register(sketch.extrude(length));
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
 *  - Honors `disabledRails` (per-side conflict overrides driven by
 *    labels, wall cutouts, and intruding handles)
 */
function railPlacementsForPolygon(inputs: LidInputs): RailPlacement[] {
  const {
    cellMask,
    gridUnitMm,
    gridUnitMmY,
    lidCornerR,
    fitClearance,
    disabledRails,
    clickRails,
    clickRailCoverage,
  } = inputs;
  if (!cellMask) return [];

  const loops = maskToPolygon(cellMask);
  const outer = loops[0];
  // Non-square grids stretch mask columns by X and rows by Y independently.
  const halfWidthMm = (cellMask.cols * MASK_CELL_SIZE * gridUnitMm) / 2;
  const halfDepthMm = (cellMask.rows * MASK_CELL_SIZE * gridUnitMmY) / 2;

  const verticesMm = outer.map((p) => ({
    x: p.x * gridUnitMm - halfWidthMm,
    y: p.y * gridUnitMmY - halfDepthMm,
  }));

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

    const edgeDirX = Math.sign(dx);
    const edgeDirY = Math.sign(dy);
    // Outward normal: right-perpendicular of edge direction (CCW polygon).
    const outX = edgeDirY;
    const outY = -edgeDirX;
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

    if (!clickRails[side]) continue;
    if (disabledRails.has(side)) continue;

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
  const { lidOuterW, lidOuterD, lidCornerR, disabledRails, clickRails, clickRailCoverage } = inputs;
  const { outerOffsetX: offX, outerOffsetY: offY } = inputs;
  // Rail spans wall length minus corner radii on both ends, then shrunk
  // to `clickRailCoverage` (centered on the wall) to save filament.
  const railLengthX = (lidOuterW - 2 * lidCornerR) * clickRailCoverage;
  const railLengthY = (lidOuterD - 2 * lidCornerR) * clickRailCoverage;
  // Wall midlines, shifted by the overhang offset so rails ride the lid's
  // (possibly off-center) perimeter rather than the nominal socket grid.
  const corneredOuterX = lidOuterW / 2 - lidCornerR;
  const corneredOuterY = lidOuterD / 2 - lidCornerR;

  const placements: RailPlacement[] = [];

  const wantBack = clickRails.back && !disabledRails.has('back') && railLengthX >= MIN_RAIL_LENGTH;
  const wantFront =
    clickRails.front && !disabledRails.has('front') && railLengthX >= MIN_RAIL_LENGTH;
  const wantRight =
    clickRails.right && !disabledRails.has('right') && railLengthY >= MIN_RAIL_LENGTH;
  const wantLeft = clickRails.left && !disabledRails.has('left') && railLengthY >= MIN_RAIL_LENGTH;

  if (wantBack) {
    placements.push({
      centerX: offX,
      centerY: corneredOuterY + offY,
      length: railLengthX,
      rotationDeg: 0,
    });
  }
  if (wantFront) {
    placements.push({
      centerX: offX,
      centerY: -corneredOuterY + offY,
      length: railLengthX,
      rotationDeg: 180,
    });
  }
  if (wantRight) {
    placements.push({
      centerX: corneredOuterX + offX,
      centerY: offY,
      length: railLengthY,
      rotationDeg: -90,
    });
  }
  if (wantLeft) {
    placements.push({
      centerX: -corneredOuterX + offX,
      centerY: offY,
      length: railLengthY,
      rotationDeg: 90,
    });
  }

  return placements;
}

export function addClickRails(
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
    if (originToTag) {
      collectOrigins(positioned, FeatureTag.LID_RAIL, originToTag);
    }
    scope.register(result);
    result = unwrap(fuse(result, positioned));
  }
  return result;
}
