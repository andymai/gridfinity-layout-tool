/**
 * Silhouette rings for cutout containment checks, in absolute interior mm and
 * already rotated.
 *
 * Placement against a non-rectangular (masked) board can't be decided from an
 * axis-aligned box: an L-shaped path inside an L-shaped bin has a bbox that
 * covers the notch even though every point of the outline sits on the board.
 * These rings are what `maskFit` tests when the box check is inconclusive.
 *
 * Every ring is a **superset** of the shape it stands for, so a placement built
 * on it never overhangs in the generated geometry: curved spans are sampled on
 * a *circumscribing* polygon, and a mesh imprint with no stored silhouette
 * falls back to its footprint rectangle.
 *
 * Rings are returned in the same frame `getCutoutBounds` measures, so the box
 * check stays a sound fast-accept for the outline check.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { DEFAULT_POLYGON_SIDES, MIN_PATH_POINTS } from '@/features/bin-designer/types';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import {
  clampPolygonSides,
  regularPolygonPoints,
  slotCornerRadius,
} from '@/shared/utils/cutoutPolygon';
import { rotatePoint } from './geometryCore';
import { getPathBounds, flattenPath } from './pathGeometry';
import type { Point2D } from './pathGeometryBezier';

/** Samples per full turn for curved spans. Corner arcs use a quarter of these,
 *  so both share one angular step — and therefore one inflation factor. */
const ARC_SEGMENTS_PER_TURN = 64;
const CORNER_SEGMENTS = ARC_SEGMENTS_PER_TURN / 4;

/**
 * Radial scale turning an inscribed sampled arc into a circumscribing one.
 * Without it a sampled curve reads ~0.1% smaller than the curve itself and the
 * validator would accept placements that clip in the generated mesh.
 */
const ARC_INFLATION = 1 / Math.cos(Math.PI / ARC_SEGMENTS_PER_TURN);

/** Minimum vertices for a ring to bound any area. */
const MIN_RING_POINTS = 3;

function rotateRing(
  points: readonly Point2D[],
  cx: number,
  cy: number,
  degrees: number
): Point2D[] {
  if (!degrees) return [...points];
  // Stored rotation is clockwise-positive and `rotatePoint` is CCW, so the
  // ring takes the negated angle — the convention of `rotatePair`
  // (booleanGeometry) and the worker's `rotate(shape, -rotation)`. Rotating
  // CCW would validate a mirror image of every asymmetric silhouette.
  return points.map((p) => rotatePoint(p.x, p.y, cx, cy, -degrees));
}

function ellipseRing(cx: number, cy: number, rx: number, ry: number): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < ARC_SEGMENTS_PER_TURN; i++) {
    const a = (i / ARC_SEGMENTS_PER_TURN) * Math.PI * 2;
    points.push({
      x: cx + rx * ARC_INFLATION * Math.cos(a),
      y: cy + ry * ARC_INFLATION * Math.sin(a),
    });
  }
  return points;
}

/**
 * Rounded-rectangle ring, CCW from the bottom-left corner arc. The inflated
 * corner radius also pushes each arc's endpoints outward along the straight
 * edges' normals, so the straight spans stay outside the true profile too.
 */
function roundedRectRing(
  x: number,
  y: number,
  width: number,
  depth: number,
  radius: number
): Point2D[] {
  const r = Math.max(0, Math.min(radius, width / 2, depth / 2));
  if (r === 0) {
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + depth },
      { x, y: y + depth },
    ];
  }
  const ri = r * ARC_INFLATION;
  const points: Point2D[] = [];
  const arc = (acx: number, acy: number, startAngle: number): void => {
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const a = startAngle + (Math.PI / 2) * (i / CORNER_SEGMENTS);
      points.push({ x: acx + ri * Math.cos(a), y: acy + ri * Math.sin(a) });
    }
  };
  arc(x + r, y + r, Math.PI);
  arc(x + width - r, y + r, -Math.PI / 2);
  arc(x + width - r, y + depth - r, 0);
  arc(x + r, y + depth - r, Math.PI / 2);
  return points;
}

/**
 * Stored top-down silhouette of a mesh imprint, mapped from the asset's
 * `[0..sizeMm]` frame onto the cutout's footprint box. Returns `null` when the
 * asset is unavailable so the caller can fall back to the footprint rectangle.
 * Holes were already dropped at import, so each ring is an independent island.
 */
function meshRings(
  cutout: Cutout,
  meshAssets: Readonly<Record<string, MeshAsset>> | undefined
): Point2D[][] | null {
  const asset = cutout.meshId !== undefined ? meshAssets?.[cutout.meshId] : undefined;
  if (!asset || asset.sizeMm.x <= 0 || asset.sizeMm.y <= 0) return null;
  const scaleX = cutout.width / asset.sizeMm.x;
  const scaleY = cutout.depth / asset.sizeMm.y;
  const rings = asset.outlines
    .filter((ring) => ring.length >= MIN_RING_POINTS)
    .map((ring) => ring.map((p) => ({ x: cutout.x + p.x * scaleX, y: cutout.y + p.y * scaleY })));
  return rings.length > 0 ? rings : null;
}

/**
 * Silhouette of a cutout as one or more closed rings. Returns `null` for
 * cutouts too degenerate to outline (empty path, zero-sized box), leaving the
 * caller to keep whatever verdict the bounding box gave.
 *
 * `clearance` is deliberately not applied: the editor validates the nominal
 * size the user entered, matching `cutoutToPolygon` and the on-screen outline.
 */
export function getCutoutOutline(
  cutout: Cutout,
  meshAssets?: Readonly<Record<string, MeshAsset>>
): Point2D[][] | null {
  if (cutout.shape === 'path') {
    if (!cutout.path || cutout.path.length < MIN_PATH_POINTS) return null;
    const flat = flattenPath(cutout.path);
    if (flat.length < MIN_RING_POINTS) return null;
    // Paths rotate about their own vertex-bounds center (see `PathShapeMesh`),
    // not the width/depth box, whose metadata can lag the actual points.
    const b = getPathBounds(cutout.path);
    return [rotateRing(flat, (b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, cutout.rotation)];
  }

  if (cutout.width <= 0 || cutout.depth <= 0) return null;

  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;

  let rings: Point2D[][] | null;
  switch (cutout.shape) {
    case 'circle':
      rings = [ellipseRing(cx, cy, cutout.width / 2, cutout.depth / 2)];
      break;
    case 'polygon': {
      const pts = regularPolygonPoints(
        clampPolygonSides(cutout.sides ?? DEFAULT_POLYGON_SIDES),
        cutout.width,
        cutout.depth
      );
      rings =
        pts.length >= MIN_RING_POINTS ? [pts.map((p) => ({ x: cx + p.x, y: cy + p.y }))] : null;
      break;
    }
    case 'slot':
    case 'knifeSlot':
      rings = [
        roundedRectRing(
          cutout.x,
          cutout.y,
          cutout.width,
          cutout.depth,
          slotCornerRadius(cutout.width, cutout.depth)
        ),
      ];
      break;
    case 'mesh':
      rings = meshRings(cutout, meshAssets) ??
        // No stored silhouette reachable — the footprint box is the only
        // outline we can vouch for, which is the pre-outline behaviour.
        [roundedRectRing(cutout.x, cutout.y, cutout.width, cutout.depth, 0)];
      break;
    case 'rectangle':
      rings = [
        roundedRectRing(cutout.x, cutout.y, cutout.width, cutout.depth, cutout.cornerRadius),
      ];
      break;
    case 'text':
      // The estimated caption box — a selection frame, not a cut outline.
      rings = [roundedRectRing(cutout.x, cutout.y, cutout.width, cutout.depth, 0)];
      break;
  }

  if (!rings) return null;
  return rings.map((ring) => rotateRing(ring, cx, cy, cutout.rotation));
}
