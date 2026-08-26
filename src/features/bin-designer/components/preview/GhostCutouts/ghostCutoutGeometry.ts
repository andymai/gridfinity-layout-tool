/**
 * Shared outline geometry for cutout ghosts, in whatever frame the caller hands
 * it. Used by the bin's interior ghost and the lid's plate ghost.
 *
 * The wireframe follows the TOOL the worker will subtract, not the nominal
 * box: each shape's real footprint (corner radius, stadium ends, polygon
 * sides, path outline), every repeat instance, and the lean tilt. A leaned
 * pocket is the straight tool rotated about its own mouth, so the opening ring
 * stays in the surface plane stretched by 1/cos(lean) along the tilt axis, the
 * floor ring rides the rotation, and the connecting edges run along the tool's
 * slanted sides. Insertion clearance and the entry chamfer are deliberately
 * not drawn — the editor shows nominal sizes everywhere (see
 * `cutoutToPolygon`), and the chamfer only flares the top rim.
 */

import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { Cutout } from '@/features/bin-designer/types';
import { DEFAULT_POLYGON_SIDES, resolveCutoutLeanDeg } from '@/features/bin-designer/types';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import {
  clampPolygonSides,
  regularPolygonPoints,
  slotCornerRadius,
} from '@/shared/utils/cutoutPolygon';
import {
  flattenPath,
  MIN_PATH_POINTS,
} from '@/features/bin-designer/components/panel/CutoutsSection/pathGeometry';

/** Number of segments for circle approximation */
const CIRCLE_SEGMENTS = 24;

/** Segments per 90° corner arc of a rounded rectangle. */
const CORNER_SEGMENTS = 6;

/** Roughly how many top-to-floor edges to draw around each outline. */
const VERTICAL_EDGE_TARGET = 8;

interface OutlinePoint {
  readonly x: number;
  readonly y: number;
}

function rectOutline(width: number, depth: number, cornerRadius: number): OutlinePoint[] {
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.max(0, Math.min(cornerRadius, hw, hd));
  if (r === 0) {
    return [
      { x: -hw, y: -hd },
      { x: hw, y: -hd },
      { x: hw, y: hd },
      { x: -hw, y: hd },
    ];
  }
  const points: OutlinePoint[] = [];
  const arc = (acx: number, acy: number, startAngle: number): void => {
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const a = startAngle + (Math.PI / 2) * (i / CORNER_SEGMENTS);
      points.push({ x: acx + r * Math.cos(a), y: acy + r * Math.sin(a) });
    }
  };
  arc(-hw + r, -hd + r, Math.PI);
  arc(hw - r, -hd + r, -Math.PI / 2);
  arc(hw - r, hd - r, 0);
  arc(-hw + r, hd - r, Math.PI / 2);
  return points;
}

function ellipseOutline(rx: number, ry: number): OutlinePoint[] {
  const points: OutlinePoint[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    points.push({ x: rx * Math.cos(a), y: ry * Math.sin(a) });
  }
  return points;
}

/**
 * Unrotated footprint outline relative to the cutout's box center — the frame
 * the worker builds its tool in, so the lean and plan rotation applied on top
 * compose exactly like `applyCutoutLean` + the tool's Z rotation.
 *
 * Paths flatten to their polyline (the worker's bbox fallback covers the
 * degenerate ones); a mesh imprint keeps its footprint rectangle, the only
 * outline cheaply known here.
 */
function localOutline(cutout: Cutout): OutlinePoint[] | null {
  const { width, depth } = cutout;
  switch (cutout.shape) {
    case 'circle':
      return ellipseOutline(width / 2, depth / 2);
    case 'polygon': {
      const pts = regularPolygonPoints(
        clampPolygonSides(cutout.sides ?? DEFAULT_POLYGON_SIDES),
        width,
        depth
      );
      return pts.length >= 3 ? pts : rectOutline(width, depth, 0);
    }
    case 'slot':
    case 'knifeSlot':
      return rectOutline(width, depth, slotCornerRadius(width, depth));
    case 'path': {
      if (!cutout.path || cutout.path.length < MIN_PATH_POINTS) return null;
      const flat = flattenPath(cutout.path);
      if (flat.length < 3) return rectOutline(width, depth, 0);
      const cx = cutout.x + width / 2;
      const cy = cutout.y + depth / 2;
      return flat.map((p) => ({ x: p.x - cx, y: p.y - cy }));
    }
    case 'rectangle':
      return rectOutline(width, depth, cutout.cornerRadius);
    case 'mesh':
      return rectOutline(width, depth, 0);
    case 'text':
      // Caption only — no cavity for the ghost to show.
      return null;
  }
}

function emitCutout(
  positions: number[],
  cutout: Cutout,
  originX: number,
  originY: number,
  surfaceZ: number
): void {
  if (cutout.width <= 0 || cutout.depth <= 0 || cutout.cutDepth <= 0) return;
  const outline = localOutline(cutout);
  if (!outline) return;

  const cx = originX + cutout.x + cutout.width / 2;
  const cy = originY + cutout.y + cutout.depth / 2;
  const lean = (resolveCutoutLeanDeg(cutout) * Math.PI) / 180;
  const sinL = Math.sin(lean);
  const cosL = Math.cos(lean);
  // Stored rotation is clockwise-positive; the CCW math below takes the
  // negated angle, same as every renderer and the worker's tool rotation.
  const rad = (-cutout.rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const depth = cutout.cutDepth;

  const n = outline.length;
  const top: number[] = [];
  const bottom: number[] = [];
  for (const p of outline) {
    // Opening ring: the tilted prism crossed with the mouth plane is the
    // footprint stretched by 1/cos(lean) along the local tilt (+Y) axis.
    const topY = p.y / cosL;
    // Floor ring: the prism's bottom cap rotated about the mouth — shifted
    // along the tilt axis and itself tilted out of horizontal.
    const botY = p.y * cosL + depth * sinL;
    const botZ = surfaceZ + p.y * sinL - depth * cosL;
    top.push(cx + p.x * cosR - topY * sinR, cy + p.x * sinR + topY * cosR, surfaceZ);
    bottom.push(cx + p.x * cosR - botY * sinR, cy + p.x * sinR + botY * cosR, botZ);
  }

  const seg = (ring: number[], i: number, j: number): void => {
    positions.push(
      ring[i * 3],
      ring[i * 3 + 1],
      ring[i * 3 + 2],
      ring[j * 3],
      ring[j * 3 + 1],
      ring[j * 3 + 2]
    );
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    seg(top, i, j);
    seg(bottom, i, j);
  }
  // Slanted side edges connecting the two rings, a handful around the outline.
  const step = Math.max(1, Math.round(n / VERTICAL_EDGE_TARGET));
  for (let i = 0; i < n; i += step) {
    positions.push(top[i * 3], top[i * 3 + 1], top[i * 3 + 2]);
    positions.push(bottom[i * 3], bottom[i * 3 + 1], bottom[i * 3 + 2]);
  }
}

/**
 * Raw segment endpoints (x,y,z triples, two per segment) for every cutout's
 * ghost. A repeat master expands to every instance, since the worker cuts them
 * all. Exposed apart from the geometry so the placement math is testable
 * without a GL context.
 */
export function buildCutoutGhostPositions(
  cutoutsToRender: readonly Cutout[],
  originX: number,
  originY: number,
  surfaceZ: number
): number[] {
  const positions: number[] = [];
  for (const master of cutoutsToRender) {
    for (const cutout of expandCutoutArray(master)) {
      emitCutout(positions, cutout, originX, originY, surfaceZ);
    }
  }
  return positions;
}

/**
 * Line segments outlining each cutout at the surface it is cut from and again at
 * its own depth, plus edges between the two.
 *
 * Takes the surface PLANE rather than a floor and a wall height, because the two
 * hosts arrive at it differently: a bin cutout starts at the solid fill surface,
 * a lid cutout at the plate's own host face. Everything below that is identical,
 * which is the reason this is shared rather than reimplemented per host.
 */
export function buildCutoutGeometry(
  cutoutsToRender: readonly Cutout[],
  originX: number,
  originY: number,
  surfaceZ: number
): LineSegmentsGeometry | null {
  const positions = buildCutoutGhostPositions(cutoutsToRender, originX, originY, surfaceZ);
  if (positions.length === 0) return null;

  const geo = new LineSegmentsGeometry();
  geo.setPositions(positions);
  return geo;
}
