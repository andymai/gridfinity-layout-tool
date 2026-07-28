/**
 * Polygon-mask containment checks for cutouts.
 *
 * The cutout editor accepts placements only where every mask cell the cutout
 * covers is filled. Wall-thickness offset between interior and outer grid
 * coords is ignored — it's <5% of a mask cell and this check is purely UX
 * (the generator silently clips out-of-polygon geometry regardless).
 *
 * A bounding box decides this only for a *rectangular* board, where the box of
 * a shape that fits is itself always inside. A masked board is concave, so the
 * box test is a fast **accept** and nothing more — an L-shaped cutout sitting
 * happily inside an L-shaped bin has a box that spans the notch. When the box
 * test fails the real silhouette (`getCutoutOutline`) is clipped against the
 * filled region instead.
 */

import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import type { Cutout } from '@/features/bin-designer/types';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import type { CellMask } from '@/shared/utils/cellMask';
import { getCutoutOutline } from './cutoutOutline';
import { getRotatedBounds, rotatePoint, type Bounds } from './geometry';
import { getPathBounds, flattenPath } from './pathGeometry';

/**
 * Effective axis-aligned footprint of a cutout: true vertex bounds for path
 * shapes (whose `width`/`depth` metadata can lag the actual points) and the
 * rotated bounds for everything else.
 *
 * Path shapes render rotated about their geometric center, so a non-zero
 * rotation is applied to the flattened outline before taking the AABB —
 * otherwise a rotated path whose unrotated bounds fit could overhang the board.
 */
export function getCutoutBounds(cutout: Cutout): Bounds {
  if (cutout.shape !== 'path' || !cutout.path) return getRotatedBounds(cutout);
  const base = getPathBounds(cutout.path);
  if (!cutout.rotation) return base;
  const cx = (base.minX + base.maxX) / 2;
  const cy = (base.minY + base.maxY) / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of flattenPath(cutout.path)) {
    const r = rotatePoint(p.x, p.y, cx, cy, cutout.rotation);
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x > maxX) maxX = r.x;
    if (r.y > maxY) maxY = r.y;
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : base;
}

/** Tolerance for mask-cell boundary rounding (mm). */
const MASK_FIT_EPSILON = 0.01;

/**
 * Mm-per-mask-cell in the editor's interior coordinate system. X and Y scales
 * differ whenever `params.width !== params.depth` (non-square bins), since the
 * interior is shrunk by wall thickness + baseplate tolerance — an absolute mm
 * amount — on both axes. Callers derive from `binWidth/mask.cols` (= editor mm
 * per mask column) and `binDepth/mask.rows` to keep validator and polygon
 * rendering aligned.
 */
export interface MaskCellSize {
  readonly cellMmX: number;
  readonly cellMmY: number;
}

/**
 * Check whether an axis-aligned rectangle (in bin-interior mm) lies entirely
 * within the filled region of a cellMask polygon.
 *
 * Every mask cell the rect overlaps must be filled — straddling an unfilled
 * cell (a concave notch) is rejected.
 */
export function rectFitsInMask(
  mask: CellMask,
  xMm: number,
  yMm: number,
  widthMm: number,
  depthMm: number,
  cellSize: MaskCellSize
): boolean {
  const { cellMmX, cellMmY } = cellSize;
  const colStart = Math.floor((xMm + MASK_FIT_EPSILON) / cellMmX);
  const rowStart = Math.floor((yMm + MASK_FIT_EPSILON) / cellMmY);
  const colEnd = Math.ceil((xMm + widthMm - MASK_FIT_EPSILON) / cellMmX);
  const rowEnd = Math.ceil((yMm + depthMm - MASK_FIT_EPSILON) / cellMmY);
  if (colStart < 0 || rowStart < 0 || colEnd > mask.cols || rowEnd > mask.rows) {
    return false;
  }
  for (let r = rowStart; r < rowEnd; r++) {
    for (let c = colStart; c < colEnd; c++) {
      if (mask.cells[r * mask.cols + c] !== 1) return false;
    }
  }
  return true;
}

/**
 * Filled region of a mask as a clipping polygon, in bin-interior mm.
 *
 * Each cell is grown by {@link MASK_FIT_EPSILON} before the union so a flush
 * outline isn't rejected on float noise — the same slack `rectFitsInMask`
 * grants by shrinking its query rect.
 */
function buildFilledRegion(mask: CellMask, cellSize: MaskCellSize): MultiPolygon {
  const { cellMmX, cellMmY } = cellSize;
  const rects: Polygon[] = [];
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      if (mask.cells[r * mask.cols + c] !== 1) continue;
      const x0 = c * cellMmX - MASK_FIT_EPSILON;
      const y0 = r * cellMmY - MASK_FIT_EPSILON;
      const x1 = (c + 1) * cellMmX + MASK_FIT_EPSILON;
      const y1 = (r + 1) * cellMmY + MASK_FIT_EPSILON;
      rects.push([
        [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ],
      ]);
    }
  }
  if (rects.length === 0) return [];
  return polygonClipping.union(rects[0], ...rects.slice(1));
}

/**
 * Memoized per mask instance: a drag re-checks the same board on every pointer
 * move. `CellMask.cells` is contractually never mutated in place, so the object
 * identity is a sound cache key (see `cellMask.ts`).
 */
const filledRegionCache = new WeakMap<CellMask, Map<string, MultiPolygon>>();

function filledRegion(mask: CellMask, cellSize: MaskCellSize): MultiPolygon {
  let byCellSize = filledRegionCache.get(mask);
  if (!byCellSize) {
    byCellSize = new Map<string, MultiPolygon>();
    filledRegionCache.set(mask, byCellSize);
  }
  const key = `${cellSize.cellMmX}:${cellSize.cellMmY}`;
  const cached = byCellSize.get(key);
  if (cached) return cached;
  const region = buildFilledRegion(mask, cellSize);
  byCellSize.set(key, region);
  return region;
}

/**
 * Leftover area (mm²) below which a clip result is float noise rather than a
 * real overhang. Genuine sub-epsilon overhangs are already absorbed by the
 * region's epsilon growth, so anything surviving that is either noise or real.
 */
const RESIDUAL_AREA_EPSILON = 1e-6;

function totalArea(polygons: MultiPolygon): number {
  let area = 0;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      // Shoelace. Outer rings come back CCW (positive), holes CW (negative),
      // so the running sum is the net covered area.
      for (let i = 0, n = ring.length; i < n; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[(i + 1) % n];
        area += (x1 * y2 - x2 * y1) / 2;
      }
    }
  }
  return area;
}

/** True when none of a cutout's silhouette rings escape the filled region. */
function outlineFitsInMask(
  cutout: Cutout,
  mask: CellMask,
  cellSize: MaskCellSize,
  meshAssets: Readonly<Record<string, MeshAsset>> | undefined
): boolean {
  const rings = getCutoutOutline(cutout, meshAssets);
  if (!rings || rings.length === 0) return false;
  const region = filledRegion(mask, cellSize);
  if (region.length === 0) return false;
  const subject: MultiPolygon = rings.map((ring) => [
    ring.map((p): [number, number] => [p.x, p.y]),
  ]);
  try {
    return totalArea(polygonClipping.difference(subject, region)) <= RESIDUAL_AREA_EPSILON;
  } catch {
    // polygon-clipping rejects degenerate/self-intersecting rings, which a
    // freeform pen path can be. Falling back to the bounding-box verdict keeps
    // the drag loop alive and only ever errs toward rejecting the placement.
    return false;
  }
}

/**
 * Check whether a cutout fits within the mask polygon.
 *
 * The bounding box (`getRotatedBounds()` for parametric shapes, true vertex
 * bounds for paths) is tried first: a box inside the filled region proves the
 * shape inside it is too, give or take the sub-epsilon slack both checks grant.
 * Only when that fails does the real silhouette get clipped against the region,
 * so concave boards accept the concave shapes that genuinely nest into them.
 *
 * `meshAssets` supplies the stored silhouette for `mesh` cutouts; without it a
 * mesh imprint is validated by its footprint rectangle.
 */
export function cutoutFitsInMask(
  cutout: Cutout,
  mask: CellMask,
  cellSize: MaskCellSize,
  meshAssets?: Readonly<Record<string, MeshAsset>>
): boolean {
  const { minX, minY, maxX, maxY } = getCutoutBounds(cutout);
  if (rectFitsInMask(mask, minX, minY, maxX - minX, maxY - minY, cellSize)) return true;
  return outlineFitsInMask(cutout, mask, cellSize, meshAssets);
}
