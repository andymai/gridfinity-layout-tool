/**
 * A bin's top as flat outlines, for cutting a shadow board or a foam insert:
 * the bin's footprint and every opening its pockets make in the fill top.
 *
 * Everything is in millimetres in the bin-centred model frame, Y up. Openings
 * are what the top surface loses: every repeat copy, every group resolved by
 * its own boolean, and overlapping pockets merged into one outline, so a
 * stepped pocket or a finger cut is cut once. They are the shapes as drawn,
 * or grown by each pocket's clearance the way the generator grows it; entry
 * edges, depths and leans have no outline of their own.
 */

import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { DEFAULT_GROUP_OP } from '@/features/bin-designer/types';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { expandCutoutArray, expandCutoutGroup } from '@/shared/utils/cutoutArray';
import { clearedProfile } from '@/shared/utils/cutoutFit';
import { isPartialMask, MASK_CELL_SIZE, maskToPolygon } from '@/shared/utils/cellMask';
import { fitTestFootprintBox } from '@/shared/utils/fitTestPlan';
import { offsetClosedPolygon } from '@/shared/utils/polygonOffset';
import { combineGroupPolygons } from '../booleanGeometry';
import { getCutoutOutline } from '../cutoutOutline';

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export interface ShadowBoardPlan {
  /** The bin's footprint: one ring, or a custom footprint's outer ring and its holes. */
  readonly outline: readonly Pt[][];
  /** The openings, each an outer ring and the islands left inside it. */
  readonly openings: readonly Pt[][][];
}

export interface ShadowBoardOptions {
  /** Grow each pocket by its insertion clearance, as the generator cuts it. */
  readonly clearance: boolean;
}

/** Chords per quarter circle on the footprint's rounded corners. */
const CORNER_SEGMENTS = 16;

const toRing = (pts: readonly Pt[]): Ring => pts.map((p) => [p.x, p.y]);
const fromRing = (ring: Ring): Pt[] => {
  // polygon-clipping closes its rings by repeating the first point.
  const last = ring.at(-1);
  const repeated = ring.length > 1 && last && ring[0][0] === last[0] && ring[0][1] === last[1];
  return (repeated ? ring.slice(0, -1) : ring).map(([x, y]) => ({ x, y }));
};

/** A shape at a new size about the same centre. */
function resized(c: Cutout, width: number, depth: number): Cutout {
  return { ...c, x: c.x - (width - c.width) / 2, y: c.y - (depth - c.depth) / 2, width, depth };
}

/**
 * A cutout's outline in the editor frame, grown by its clearance when asked:
 * a path or a mesh imprint by the full clearance all round, a round, slot or
 * polygon to its cleared size; a rectangle takes none.
 */
function openingRings(c: Cutout, params: BinParams, clearance: boolean): Pt[][] {
  const rings = (shape: Cutout) =>
    (getCutoutOutline(shape, params.meshAssets) ?? []).filter((r) => r.length >= 3);
  if (!clearance) return rings(c);
  const cleared = clearedProfile(c);
  if (cleared.clearance === 0) return rings(c);
  if (c.shape === 'path' || c.shape === 'mesh') {
    return rings(c).map((r) => offsetClosedPolygon(r, cleared.clearance));
  }
  return rings(resized(c, cleared.w, cleared.d));
}

function polygonOf(c: Cutout, params: BinParams, clearance: boolean): Polygon | null {
  const rings = openingRings(c, params, clearance);
  if (rings.length === 0) return null;
  // A mesh silhouette can be several rings; as separate outers they union.
  const [first, ...rest] = rings.map((r) => [toRing(r)] as Polygon);
  return rest.length === 0 ? first : (polygonClipping.union(first, ...rest)[0] ?? null);
}

/** Every opening in the editor frame, before anything is merged. */
function openingPolygons(params: BinParams, clearance: boolean): MultiPolygon {
  const shapes = params.cutouts.filter((c) => c.hidden !== true && c.shape !== 'text');
  const out: MultiPolygon = [];
  const groups = new Map<string, Cutout[]>();
  for (const c of shapes) {
    if (c.groupId === null) {
      for (const copy of expandCutoutArray(c)) {
        const polygon = polygonOf(copy, params, clearance);
        if (polygon) out.push(polygon);
      }
      continue;
    }
    const members = groups.get(c.groupId);
    if (members) members.push(c);
    else groups.set(c.groupId, [c]);
  }
  for (const members of groups.values()) {
    const op = members[0].groupOp ?? DEFAULT_GROUP_OP;
    for (const copy of expandCutoutGroup(members)) {
      const entries = copy.flatMap((cutout) => {
        const polygon = polygonOf(cutout, params, clearance);
        return polygon ? [{ cutout, polygon }] : [];
      });
      out.push(...(combineGroupPolygons(entries, op) ?? []));
    }
  }
  return out;
}

function roundedRect(minX: number, minY: number, maxX: number, maxY: number, r: number): Pt[] {
  const radius = Math.max(0, Math.min(r, (maxX - minX) / 2, (maxY - minY) / 2));
  const corners = [
    { cx: maxX - radius, cy: minY + radius, from: -Math.PI / 2 },
    { cx: maxX - radius, cy: maxY - radius, from: 0 },
    { cx: minX + radius, cy: maxY - radius, from: Math.PI / 2 },
    { cx: minX + radius, cy: minY + radius, from: Math.PI },
  ];
  return corners.flatMap(({ cx, cy, from }) =>
    Array.from({ length: CORNER_SEGMENTS + 1 }, (_, i) => {
      const a = from + (i / CORNER_SEGMENTS) * (Math.PI / 2);
      return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
    })
  );
}

/**
 * A grid-aligned loop moved `d` toward the material on its left, which is how
 * `maskToPolygon` hands back both the outer loop and its holes.
 */
function insetRectilinear(loop: readonly Pt[], d: number): Pt[] {
  const n = loop.length;
  const left = (a: Pt, b: Pt): Pt => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  };
  return loop.map((p, i) => {
    const before = left(loop[(i - 1 + n) % n], p);
    const after = left(p, loop[(i + 1) % n]);
    const straight = Math.abs(before.x - after.x) + Math.abs(before.y - after.y) < 1e-9;
    const mx = straight ? before.x : before.x + after.x;
    const my = straight ? before.y : before.y + after.y;
    return { x: p.x + d * mx, y: p.y + d * my };
  });
}

/** The bin's footprint in the model frame. */
function footprint(params: BinParams): Pt[][] {
  const clearance = GRIDFINITY.TOLERANCE / 2;
  if (isPartialMask(params.cellMask)) {
    const mask = params.cellMask;
    // Loops come back in grid units, the mask spanning the whole footprint.
    const unitX = params.gridUnitMm;
    const unitY = params.gridUnitMmY ?? params.gridUnitMm;
    const halfW = (mask.cols * MASK_CELL_SIZE * unitX) / 2;
    const halfD = (mask.rows * MASK_CELL_SIZE * unitY) / 2;
    return maskToPolygon(mask).map((loop) =>
      insetRectilinear(
        loop.map((p) => ({ x: p.x * unitX - halfW, y: p.y * unitY - halfD })),
        clearance
      )
    );
  }
  const box = fitTestFootprintBox(params);
  return [roundedRect(box.minX, box.minY, box.maxX, box.maxY, GRIDFINITY.BOX_CORNER_RADIUS)];
}

export function planShadowBoard(params: BinParams, options: ShadowBoardOptions): ShadowBoardPlan {
  const { innerW, innerD, offsetX, offsetY } = cutoutInterior(params);
  const polygons = openingPolygons(params, options.clearance);
  const merged =
    polygons.length > 0 ? polygonClipping.union(polygons[0], ...polygons.slice(1)) : [];
  const toModel = (p: Pt): Pt => ({ x: p.x - innerW / 2 + offsetX, y: p.y - innerD / 2 + offsetY });
  return {
    outline: footprint(params),
    openings: merged.map((polygon) => polygon.map((ring) => fromRing(ring).map(toModel))),
  };
}
