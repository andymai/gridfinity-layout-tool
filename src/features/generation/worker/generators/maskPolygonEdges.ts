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

import { MASK_CELL_SIZE, type CellMask } from '@/shared/utils/cellMask';
import { maskEdgesMm, outermostEdgeForSide } from '@/shared/utils/maskEdgeGeometry';
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
  readonly perpAxis: 'x' | 'y';
  readonly rotateZ: number;
}

/**
 * Which axis is perpendicular to each side's wall, and how a feature authored
 * along +X is rotated onto it. Which EDGE faces each side now lives in
 * `outermostEdgeForSide`, so the direction table is not duplicated here.
 */
const SIDE_CONFIG: Record<WallSideKey, SideConfig> = {
  front: { perpAxis: 'y', rotateZ: 0 },
  back: { perpAxis: 'y', rotateZ: 0 },
  left: { perpAxis: 'x', rotateZ: 90 },
  right: { perpAxis: 'x', rotateZ: 90 },
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

  // Selected at UNIT pitch, which reproduces the historical grid-unit ranking
  // exactly and is what this function's grid-unit contract is stated in. The
  // choice is pitch-independent anyway — every candidate for one side runs
  // along the same axis, so a per-axis scale cannot reorder them — but reading
  // it at unit pitch keeps the conversion below a plain recentring.
  const edges = maskEdgesMm(mask, 1, 1);
  const chosen = outermostEdgeForSide(edges, side);

  let best: PolygonEdgeRaw | null = null;
  if (chosen) {
    const halfW = (mask.cols * MASK_CELL_SIZE) / 2;
    const halfD = (mask.rows * MASK_CELL_SIZE) / 2;
    const midU = { x: chosen.midX + halfW, y: chosen.midY + halfD };
    best = {
      midU,
      spanU: chosen.length,
      // Constant along an axis-aligned edge, so the midpoint carries it.
      perpU: SIDE_CONFIG[side].perpAxis === 'y' ? midU.y : midU.x,
    };
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
