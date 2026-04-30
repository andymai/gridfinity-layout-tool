/**
 * Edge-line geometry for baseplate visualization.
 *
 * Generates contour loops at face boundaries (outer perimeter, pocket
 * openings, pocket floors, magnet holes) procedurally from params — produces
 * the same visual "sketch look" as BREP topology edges without the cost of
 * meshEdges() on the BREP solid.
 */

import type { BaseplateParams } from '@/shared/types/bin';
import {
  SOCKET_HEIGHT,
  PLATE_CORNER_RADIUS,
  MAGNET_FLOOR,
  MAGNET_OFFSETS,
  INSET_BOT,
  pocketCornerRadius,
  forEachCell,
} from './generatorTypes';
import type { ForEachCellOptions } from './generatorTypes';

/** Segments per rounded corner arc for edge lines */
const EDGE_CORNER_SEGMENTS = 4;

/** Segments per magnet hole circle for edge lines (matches 10° angular tolerance) */
const EDGE_CIRCLE_SEGMENTS = 36;

/**
 * Generate points for a rounded rectangle centered at origin (CCW from +Z).
 * Used for computing edge line contours — matches the same profile as the BREP
 * slab and pocket geometry without requiring BREP edge extraction.
 */
function edgeRoundedRect(
  w: number,
  d: number,
  r: number,
  segments: number
): ReadonlyArray<readonly [number, number]> {
  const hw = w / 2;
  const hd = d / 2;
  const effectiveR = Math.max(Math.min(r, hw - 0.01, hd - 0.01), 0);

  if (effectiveR < 0.01) {
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ];
  }

  const pts: Array<[number, number]> = [];
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [-hw + effectiveR, -hd + effectiveR, Math.PI],
    [hw - effectiveR, -hd + effectiveR, (3 * Math.PI) / 2],
    [hw - effectiveR, hd - effectiveR, 0],
    [-hw + effectiveR, hd - effectiveR, Math.PI / 2],
  ];

  for (const [cx, cy, startAngle] of corners) {
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (i / segments) * (Math.PI / 2);
      pts.push([cx + effectiveR * Math.cos(angle), cy + effectiveR * Math.sin(angle)]);
    }
  }
  return pts;
}

/**
 * Generate a rounded rectangle with selective corner rounding.
 * Only rounds corners where both adjacent edges are exterior.
 */
function edgeRoundedRectSelective(
  w: number,
  d: number,
  r: number,
  segments: number,
  edges?: BaseplateParams['edges']
): ReadonlyArray<readonly [number, number]> {
  if (
    !edges ||
    (edges.left === 'exterior' &&
      edges.right === 'exterior' &&
      edges.front === 'exterior' &&
      edges.back === 'exterior')
  ) {
    return edgeRoundedRect(w, d, r, segments);
  }

  const hw = w / 2;
  const hd = d / 2;
  const effectiveR = Math.max(Math.min(r, hw - 0.01, hd - 0.01), 0);

  const roundFL = edges.left === 'exterior' && edges.front === 'exterior' && effectiveR > 0.01;
  const roundFR = edges.right === 'exterior' && edges.front === 'exterior' && effectiveR > 0.01;
  const roundBR = edges.right === 'exterior' && edges.back === 'exterior' && effectiveR > 0.01;
  const roundBL = edges.left === 'exterior' && edges.back === 'exterior' && effectiveR > 0.01;

  const pts: Array<[number, number]> = [];
  const cornerDefs: ReadonlyArray<readonly [number, number, number, boolean]> = [
    [-hw + effectiveR, -hd + effectiveR, Math.PI, roundFL],
    [hw - effectiveR, -hd + effectiveR, (3 * Math.PI) / 2, roundFR],
    [hw - effectiveR, hd - effectiveR, 0, roundBR],
    [-hw + effectiveR, hd - effectiveR, Math.PI / 2, roundBL],
  ];
  const sharp: ReadonlyArray<readonly [number, number]> = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];

  for (let c = 0; c < 4; c++) {
    const [cx, cy, startAngle, shouldRound] = cornerDefs[c];
    if (shouldRound) {
      for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (i / segments) * (Math.PI / 2);
        pts.push([cx + effectiveR * Math.cos(angle), cy + effectiveR * Math.sin(angle)]);
      }
    } else {
      pts.push([sharp[c][0], sharp[c][1]]);
    }
  }
  return pts;
}

/** Push a closed polygon as line segments into an edge buffer. */
function pushEdgeLoop(
  buf: number[],
  pts: ReadonlyArray<readonly [number, number]>,
  z: number,
  ox: number,
  oy: number
): void {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    buf.push(pts[i][0] + ox, pts[i][1] + oy, z, pts[j][0] + ox, pts[j][1] + oy, z);
  }
}

/**
 * Compute the arc–straight transition points of a rounded rectangle.
 *
 * These are the 8 points (2 per corner) where arc segments meet straight
 * segments — exactly where BREP topology would place vertical edges because
 * the adjacent flat-wall and curved-corner faces meet at a sharp angle.
 *
 * For a sharp (unrounded) corner, only 1 point is returned for that corner.
 */
function roundedRectTransitionPts(w: number, d: number, r: number): Array<[number, number]> {
  const hw = w / 2;
  const hd = d / 2;
  const effectiveR = Math.max(Math.min(r, hw - 0.01, hd - 0.01), 0);

  if (effectiveR < 0.01) {
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ];
  }

  return [
    // Bottom-left corner (arc from π to 3π/2)
    [-hw, -hd + effectiveR],
    [-hw + effectiveR, -hd],
    // Bottom-right corner (arc from 3π/2 to 2π)
    [hw - effectiveR, -hd],
    [hw, -hd + effectiveR],
    // Top-right corner (arc from 0 to π/2)
    [hw, hd - effectiveR],
    [hw - effectiveR, hd],
    // Top-left corner (arc from π/2 to π)
    [-hw + effectiveR, hd],
    [-hw, hd - effectiveR],
  ];
}

/**
 * Transition points for a rounded rectangle with selective corner rounding.
 * Returns 1 point per sharp corner, 2 per rounded corner.
 */
function roundedRectTransitionPtsSelective(
  w: number,
  d: number,
  r: number,
  edges?: BaseplateParams['edges']
): Array<[number, number]> {
  if (
    !edges ||
    (edges.left === 'exterior' &&
      edges.right === 'exterior' &&
      edges.front === 'exterior' &&
      edges.back === 'exterior')
  ) {
    return roundedRectTransitionPts(w, d, r);
  }

  const hw = w / 2;
  const hd = d / 2;
  const effectiveR = Math.max(Math.min(r, hw - 0.01, hd - 0.01), 0);

  const roundFL = edges.left === 'exterior' && edges.front === 'exterior' && effectiveR > 0.01;
  const roundFR = edges.right === 'exterior' && edges.front === 'exterior' && effectiveR > 0.01;
  const roundBR = edges.right === 'exterior' && edges.back === 'exterior' && effectiveR > 0.01;
  const roundBL = edges.left === 'exterior' && edges.back === 'exterior' && effectiveR > 0.01;

  const pts: Array<[number, number]> = [];

  if (roundFL) {
    pts.push([-hw, -hd + effectiveR], [-hw + effectiveR, -hd]);
  } else {
    pts.push([-hw, -hd]);
  }
  if (roundFR) {
    pts.push([hw - effectiveR, -hd], [hw, -hd + effectiveR]);
  } else {
    pts.push([hw, -hd]);
  }
  if (roundBR) {
    pts.push([hw, hd - effectiveR], [hw - effectiveR, hd]);
  } else {
    pts.push([hw, hd]);
  }
  if (roundBL) {
    pts.push([-hw + effectiveR, hd], [-hw, hd - effectiveR]);
  } else {
    pts.push([-hw, hd]);
  }

  return pts;
}

/**
 * Push vertical edge lines connecting transition points between two Z levels.
 * Each pair of corresponding top/bottom points gets a vertical line segment.
 */
function pushVerticalEdges(
  buf: number[],
  topPts: ReadonlyArray<readonly [number, number]>,
  botPts: ReadonlyArray<readonly [number, number]>,
  zTop: number,
  zBot: number,
  ox: number,
  oy: number
): void {
  const n = Math.min(topPts.length, botPts.length);
  for (let i = 0; i < n; i++) {
    buf.push(
      topPts[i][0] + ox,
      topPts[i][1] + oy,
      zTop,
      botPts[i][0] + ox,
      botPts[i][1] + oy,
      zBot
    );
  }
}

/**
 * Compute edge line vertices procedurally from baseplate params.
 *
 * Generates contour loops at face boundaries (outer perimeter, pocket openings,
 * pocket floors, magnet holes) to produce the same visual "sketch look" as BREP
 * topology edges — without the cost of meshEdges().
 */
export function computeBaseplateEdgeLines(params: BaseplateParams): Float32Array {
  const {
    width,
    depth,
    gridUnitMm,
    magnetHoles,
    magnetDiameter,
    magnetDepth,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
    fractionalEdgeX,
    fractionalEdgeY,
    edges,
  } = params;

  const floorDepth = magnetHoles ? MAGNET_FLOOR + magnetDepth : 0;
  const totalHeight = SOCKET_HEIGHT + floorDepth;
  const totalW = width * gridUnitMm + paddingLeft + paddingRight;
  const totalD = depth * gridUnitMm + paddingFront + paddingBack;
  const maxRadius = Math.min(totalW, totalD) / 2 - 0.1;
  const cornerR = Math.min(PLATE_CORNER_RADIUS, maxRadius);
  const slabOffsetX = (paddingRight - paddingLeft) / 2;
  const slabOffsetY = (paddingBack - paddingFront) / 2;

  const buf: number[] = [];

  // ── Outer perimeter: horizontal contours + vertical corner edges ──
  const outerPts = edgeRoundedRectSelective(totalW, totalD, cornerR, EDGE_CORNER_SEGMENTS, edges);
  pushEdgeLoop(buf, outerPts, totalHeight, slabOffsetX, slabOffsetY);
  pushEdgeLoop(buf, outerPts, 0, slabOffsetX, slabOffsetY);

  // Vertical edges at outer perimeter corners (wall is not tapered, same XY at top and bottom)
  const outerTransition = roundedRectTransitionPtsSelective(totalW, totalD, cornerR, edges);
  pushVerticalEdges(
    buf,
    outerTransition,
    outerTransition,
    totalHeight,
    0,
    slabOffsetX,
    slabOffsetY
  );

  // ── Pocket openings, floors, and vertical wall edges for each cell ──
  const cellOpts: ForEachCellOptions = { fractionalEdgeX, fractionalEdgeY, gridUnitMm };
  forEachCell(
    width,
    depth,
    (cell) => {
      const cellW = cell.widthUnits * gridUnitMm;
      const cellD = cell.depthUnits * gridUnitMm;
      const cr = pocketCornerRadius(cellW, cellD);

      pushEdgeLoop(
        buf,
        edgeRoundedRect(cellW, cellD, cr, EDGE_CORNER_SEGMENTS),
        totalHeight,
        cell.centerX,
        cell.centerY
      );

      const botW = cellW - 2 * INSET_BOT;
      const botD = cellD - 2 * INSET_BOT;
      const botR = Math.max(cr - INSET_BOT, 0.1);
      const pocketFloorZ = floorDepth > 0 ? floorDepth : 0;

      if (floorDepth > 0) {
        pushEdgeLoop(
          buf,
          edgeRoundedRect(botW, botD, botR, EDGE_CORNER_SEGMENTS),
          floorDepth,
          cell.centerX,
          cell.centerY
        );
      }

      const topTransition = roundedRectTransitionPts(cellW, cellD, cr);
      const botTransition = roundedRectTransitionPts(botW, botD, botR);
      pushVerticalEdges(
        buf,
        topTransition,
        botTransition,
        totalHeight,
        pocketFloorZ,
        cell.centerX,
        cell.centerY
      );
    },
    cellOpts
  );

  if (magnetHoles) {
    const magnetRadius = magnetDiameter / 2;
    const circlePts: Array<[number, number]> = [];
    for (let i = 0; i < EDGE_CIRCLE_SEGMENTS; i++) {
      const angle = (i / EDGE_CIRCLE_SEGMENTS) * Math.PI * 2;
      circlePts.push([magnetRadius * Math.cos(angle), magnetRadius * Math.sin(angle)]);
    }

    forEachCell(
      width,
      depth,
      (cell) => {
        if (cell.widthUnits < 1 || cell.depthUnits < 1) return;
        for (const [dx, dy] of MAGNET_OFFSETS) {
          pushEdgeLoop(buf, circlePts, floorDepth, cell.centerX + dx, cell.centerY + dy);
          pushEdgeLoop(buf, circlePts, MAGNET_FLOOR, cell.centerX + dx, cell.centerY + dy);
        }
      },
      cellOpts
    );
  }

  return new Float32Array(buf);
}
