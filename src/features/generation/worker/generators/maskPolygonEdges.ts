/**
 * Map a rectangular bin side (front/back/left/right) to a polygon edge for
 * non-rectangular bin footprints.
 *
 * Used by feature builders (wall cutouts, eventually handles) that position
 * their geometry by side on the bounding box. For a custom shape, each side
 * may correspond to one or more external polygon edges; this module picks the
 * outermost one (extreme perpendicular coordinate), tiebreaking by length.
 *
 * Coordinate conventions match `maskPolygon.ts`: the input loop comes from
 * `maskToPolygon` in grid-unit coordinates (origin at mask bottom-left, CCW).
 * The resolver returns centered-mm coordinates (matching the existing wall
 * cutout builder's "bin centered at origin" frame).
 */

import { MASK_CELL_SIZE, maskToPolygon, type CellMask } from '@/shared/utils/cellMask';
import { CLEARANCE } from './generatorConstants';
import { resolvePitch, type GridUnitInput } from './gridPitch';

export type WallSideKey = 'front' | 'back' | 'left' | 'right';

/**
 * Resolved placement geometry for a wall-sided feature on a polygon footprint.
 *
 * Matches the shape of the rect-bin entries in wallCutoutBuilder's `sides`
 * array so the two code paths can share the downstream loop.
 */
export interface PolygonSideGeometry {
  readonly key: WallSideKey;
  /** Effective inner wall span in mm — the basis for percentage widths. */
  readonly wallSpan: number;
  /** Cutout anchor X in centered mm (bin origin at 0,0). */
  readonly x: number;
  /** Cutout anchor Y in centered mm. */
  readonly y: number;
  /** Rotation in degrees: 0 for horizontal walls (front/back), 90 for vertical. */
  readonly rotateZ: number;
}

interface SideConfig {
  readonly dxMatch: -1 | 0 | 1;
  readonly dyMatch: -1 | 0 | 1;
  readonly perpAxis: 'x' | 'y';
  /** +1 means prefer higher perpendicular coord, -1 means lower. */
  readonly extremeSign: -1 | 1;
  readonly rotateZ: number;
}

/**
 * CCW polygon edge directions that face each side (outward normal points "out"
 * the named side). For a CCW outer loop, interior is on the LEFT of each edge
 * direction, so an edge going +X has its interior above (normal -Y = front face),
 * meaning the edge itself IS the front wall.
 */
const SIDE_CONFIG: Record<WallSideKey, SideConfig> = {
  front: { dxMatch: 1, dyMatch: 0, perpAxis: 'y', extremeSign: -1, rotateZ: 0 },
  back: { dxMatch: -1, dyMatch: 0, perpAxis: 'y', extremeSign: 1, rotateZ: 0 },
  left: { dxMatch: 0, dyMatch: -1, perpAxis: 'x', extremeSign: -1, rotateZ: 90 },
  right: { dxMatch: 0, dyMatch: 1, perpAxis: 'x', extremeSign: 1, rotateZ: 90 },
};

interface PolygonEdgeRaw {
  /** Edge midpoint in grid units. */
  readonly midU: { readonly x: number; readonly y: number };
  /** Edge length in grid units. */
  readonly spanU: number;
  /** Fixed perpendicular coordinate (constant along the edge). */
  readonly perpU: number;
}

/**
 * Per-mask side cache — feature builders (wall cutouts, handles, wall
 * patterns) and `wallPatterns.collectPolygonWallSegments` all invoke
 * `findPolygonEdgeForSide` once per cardinal direction. A single generation
 * produces up to ~16 redundant calls for the same (mask, side) pair; this
 * WeakMap collapses them to one scan per side.
 */
type SideEdgeResults = Partial<Record<WallSideKey, PolygonEdgeRaw | null>>;
const maskSideEdgeCache = new WeakMap<CellMask, SideEdgeResults>();

/**
 * Find the polygon edge that best represents `side` on a custom mask.
 *
 * Returns null when no polygon edge faces the requested direction — which
 * can happen for pathological shapes where the mask has no axis-aligned wall
 * facing that side. Callers are expected to silently skip placement in that
 * case (matching the generator's existing out-of-polygon clip semantics).
 *
 * Exported for unit testing; production code should prefer `resolvePolygonSideGeometry`.
 */
export function findPolygonEdgeForSide(mask: CellMask, side: WallSideKey): PolygonEdgeRaw | null {
  const cached = maskSideEdgeCache.get(mask);
  if (cached && side in cached) {
    return cached[side] ?? null;
  }

  const loops = maskToPolygon(mask);
  const outer = loops[0];
  if (outer.length < 3) {
    const entry = cached ?? {};
    entry[side] = null;
    maskSideEdgeCache.set(mask, entry);
    return null;
  }

  const config = SIDE_CONFIG[side];
  let best: PolygonEdgeRaw | null = null;

  for (let i = 0; i < outer.length; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % outer.length];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    if (dx !== config.dxMatch || dy !== config.dyMatch) continue;

    const spanU = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    const perpU = config.perpAxis === 'y' ? a.y : a.x;
    const midU = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const candidate: PolygonEdgeRaw = { midU, spanU, perpU };

    if (!best) {
      best = candidate;
      continue;
    }
    // Ranking: (1) more extreme perpendicular coord, (2) longer span, (3) lower
    // midpoint along the edge direction. (3) makes the result deterministic for
    // symmetric shapes (e.g. U-shape back = left arm, not traversal-dependent).
    const extremeDelta = (perpU - best.perpU) * config.extremeSign;
    if (extremeDelta > 1e-9) {
      best = candidate;
    } else if (extremeDelta > -1e-9) {
      if (spanU > best.spanU + 1e-9) {
        best = candidate;
      } else if (spanU > best.spanU - 1e-9) {
        // Deterministic tiebreak on midpoint coordinate along the edge axis.
        const edgeAxisCoord = config.perpAxis === 'y' ? midU.x : midU.y;
        const bestAxisCoord = config.perpAxis === 'y' ? best.midU.x : best.midU.y;
        if (edgeAxisCoord < bestAxisCoord) best = candidate;
      }
    }
  }

  const entry = cached ?? {};
  entry[side] = best;
  maskSideEdgeCache.set(mask, entry);
  return best;
}

/**
 * Resolve the placement geometry for a wall-sided feature on a polygon bin.
 *
 * Mirrors the rect-bin entries in wallCutoutBuilder: the returned {x, y}
 * coordinates are in centered mm (bin origin at 0,0), and `wallSpan` is the
 * inner-face span (the basis for percentage cutout widths). Both derivations
 * match the rect-bin case when the mask is fully filled.
 *
 * Returns null when no edge faces the requested side — caller silently skips.
 */
export function resolvePolygonSideGeometry(
  mask: CellMask,
  gridUnitMm: GridUnitInput,
  wallThickness: number,
  side: WallSideKey
): PolygonSideGeometry | null {
  const edge = findPolygonEdgeForSide(mask, side);
  if (!edge) return null;

  // Per-axis pitch — X scales width/columns, Y scales depth/rows (equal for a
  // square grid). Front/back walls run along X, left/right walls along Y.
  const { x: unitX, y: unitY } = resolvePitch(gridUnitMm);
  const spanUnit = side === 'front' || side === 'back' ? unitX : unitY;

  // halfWidthMm / halfDepthMm match maskPolygon.ts loopToMm — the mask spans
  // the FULL grid-unit extent (outer body plus CLEARANCE/2 on each side).
  const halfWidthMm = (mask.cols * MASK_CELL_SIZE * unitX) / 2;
  const halfDepthMm = (mask.rows * MASK_CELL_SIZE * unitY) / 2;

  // Edge midpoint in centered mm space.
  const outerX = edge.midU.x * unitX - halfWidthMm;
  const outerY = edge.midU.y * unitY - halfDepthMm;

  // Inset inward by (wallThickness + CLEARANCE/2) so cutout lands at the
  // inner wall face — same as rect-bin case where y = -innerD/2.
  const inset = wallThickness + CLEARANCE / 2;
  let x = outerX;
  let y = outerY;
  switch (side) {
    case 'front':
      y += inset;
      break;
    case 'back':
      y -= inset;
      break;
    case 'left':
      x += inset;
      break;
    case 'right':
      x -= inset;
      break;
  }

  // Inner span derivation: the raw polygon edge spans `spanU * gridUnitMm`
  // mm (mask extent). The bin body is inset by CLEARANCE/2 on each side, and
  // the wall further by wallThickness. So inner span = raw - CLEARANCE - 2*wall.
  // Matches rect-bin's innerW = outerW - 2*wall exactly when the mask is a
  // full rectangle. For non-convex neighbors the inner face is technically
  // longer; we approximate uniformly here (error bounded by wallThickness,
  // generator clips against the real bin body at the 3D stage).
  const wallSpan = edge.spanU * spanUnit - CLEARANCE - 2 * wallThickness;

  // A degenerate (non-positive) span violates the PolygonSideGeometry contract
  // and would flow downstream as negative cutout/handle widths. This can happen
  // with a small per-axis pitch (e.g. a 1mm Y grid unit for left/right walls) on
  // a short edge. Return null so callers skip placement, matching the !edge case.
  if (wallSpan <= 0) return null;

  return {
    key: side,
    wallSpan,
    x,
    y,
    rotateZ: SIDE_CONFIG[side].rotateZ,
  };
}
