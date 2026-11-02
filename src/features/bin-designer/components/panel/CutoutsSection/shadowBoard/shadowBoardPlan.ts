/**
 * A bin's top as flat outlines, for cutting a shadow board or a foam insert:
 * the bin's footprint and every opening its pockets make in the fill top.
 *
 * Everything is in millimetres in the bin-centred model frame, Y up. Openings
 * are what the top surface loses, read the way the generator cuts it: every
 * repeat copy, every group resolved by its own boolean with mesh imprints cut
 * on their own, pockets clipped to the interior, open sides running out
 * through the wall, and overlapping pockets merged into one outline, so a
 * stepped pocket or a finger cut is cut once. They are the shapes as drawn,
 * or grown by each pocket's clearance as the generator grows it; entry edges,
 * depths and leans have no outline of their own.
 */

import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import { err, ok, type Result } from '@/core/result';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { DEFAULT_GROUP_OP, DEFAULT_KNIFE_SPEC } from '@/features/bin-designer/types';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { cutoutInterior, cutoutTaperBand } from '@/features/bin-designer/utils/binDimensions';
import { expandCutoutArray, expandCutoutGroup } from '@/shared/utils/cutoutArray';
import { clearedProfile } from '@/shared/utils/cutoutFit';
import { isPartialMask, MASK_CELL_SIZE, maskToPolygon } from '@/shared/utils/cellMask';
import { openSideChannelOutline, openSideChannels } from '@/shared/utils/cutoutOpenSides';
import {
  cutoutOutlineRing,
  meshOutlineRings,
  rotateAbout,
  type OutlineRing,
} from '@/shared/utils/cutoutOutline';
import { fitTestFootprintBox } from '@/shared/utils/fitTestPlan';
import { pathCutoutCut, pathHoleCuts } from '@/shared/utils/pathCutoutOutline';
import { slotCornerRadius } from '@/shared/utils/cutoutPolygon';
import { combineGroupPolygons } from '../booleanGeometry';

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

/**
 * Why there is nothing to save: no openings at all, or a mesh imprint whose
 * outline has not arrived, which would otherwise go out as its bounding box.
 */
export type ShadowBoardProblem = 'empty' | 'meshMissing';

/** Chords per quarter circle on the footprint's rounded corners. */
const CORNER_SEGMENTS = 16;
/** Chords round each corner of a mesh imprint's clearance. */
const ROUND_SEGMENTS = 16;

const fromRing = (ring: Ring): Pt[] => {
  // polygon-clipping closes its rings by repeating the first point.
  const last = ring.at(-1);
  const repeated = ring.length > 1 && last && ring[0][0] === last[0] && ring[0][1] === last[1];
  return (repeated ? ring.slice(0, -1) : ring).map(([x, y]) => ({ x, y }));
};

const union = (polygons: MultiPolygon): MultiPolygon =>
  polygons.length > 0 ? polygonClipping.union(polygons[0], ...polygons.slice(1)) : [];

/**
 * A ring grown round by `d`, as the generator grows a mesh imprint: the ring,
 * a band either side of every edge and a disc at every corner, merged.
 */
function roundGrown(ring: OutlineRing, d: number): MultiPolygon {
  const parts: Polygon[] = [[ring]];
  ring.forEach(([x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length];
    const len = Math.hypot(nx - x, ny - y);
    if (len > 1e-9) {
      const ox = (-(ny - y) / len) * d;
      const oy = ((nx - x) / len) * d;
      parts.push([
        [
          [x + ox, y + oy],
          [nx + ox, ny + oy],
          [nx - ox, ny - oy],
          [x - ox, y - oy],
        ],
      ]);
    }
    parts.push([
      Array.from({ length: ROUND_SEGMENTS }, (_, k): [number, number] => {
        const a = (k / ROUND_SEGMENTS) * 2 * Math.PI;
        return [x + d * Math.cos(a), y + d * Math.sin(a)];
      }),
    ]);
  });
  return union(parts);
}

/**
 * A path as the generator cuts it: its clearance held back where the outline
 * is too tight for it, its islands shrunk by the same clearance, and its box
 * when the path cannot be outlined at all.
 */
function pathRings(c: Cutout, clearance: number): OutlineRing[] {
  const cut = pathCutoutCut(c, clearance, 0);
  if (!cut) {
    const box = cutoutOutlineRing({ ...c, shape: 'rectangle', cornerRadius: 0 });
    return box ? [box] : [];
  }
  const cx = c.x + c.width / 2;
  const cy = c.y + c.depth / 2;
  const turn = (ring: readonly { x: number; y: number }[]): OutlineRing =>
    ring.map((p) => rotateAbout(cx + p.x, cy + p.y, cx, cy, c.rotation));
  return [turn(cut.base), ...pathHoleCuts(c, clearance, 0).map((island) => turn(island.base))];
}

/**
 * A cutout's opening in the editor frame, grown by its clearance when asked:
 * a path or a mesh imprint by the clearance all round, a round, slot or
 * polygon to its cleared size; a rectangle takes none. A mesh imprint can be
 * several separate outlines. Null when a mesh imprint's outline is missing.
 */
function openingOf(c: Cutout, params: BinParams, clearance: boolean): MultiPolygon | null {
  const grow = clearance ? clearedProfile(c) : { clearance: 0, w: c.width, d: c.depth };
  if (c.shape === 'mesh') {
    const asset = c.meshId === undefined ? undefined : params.meshAssets?.[c.meshId];
    const rings = meshOutlineRings(c, asset);
    if (rings.length === 0) return null;
    return union(
      rings.flatMap((r) => (grow.clearance > 0 ? roundGrown(r, grow.clearance) : [[r]]))
    );
  }
  if (c.shape === 'path') {
    const rings = pathRings(c, grow.clearance).filter((r) => r.length >= 3);
    return rings.length > 0 ? [rings] : [];
  }
  const ring = cutoutOutlineRing({
    ...c,
    x: c.x - (grow.w - c.width) / 2,
    y: c.y - (grow.d - c.depth) / 2,
    width: grow.w,
    depth: grow.d,
  });
  return ring && ring.length >= 3 ? [[ring]] : [];
}

interface Openings {
  /** Profile pockets, which the generator keeps inside the interior. */
  readonly pockets: MultiPolygon;
  /** Mesh imprints, cut from the whole bin with no interior clip. */
  readonly imprints: MultiPolygon;
  /** Members of groups whose boolean leaves nothing, so no channel is cut for them. */
  readonly emptyOwners: ReadonlySet<string>;
}

/**
 * Every opening in the editor frame, before anything is merged, or null when
 * a mesh imprint's outline is missing. A mesh imprint is cut on its own, never
 * inside its group's boolean, as the generator cuts it.
 */
function openingPolygons(params: BinParams, clearance: boolean): Openings | null {
  const shapes = params.cutouts.filter((c) => c.hidden !== true && c.shape !== 'text');
  const pockets: MultiPolygon = [];
  const imprints: MultiPolygon = [];
  const emptyOwners = new Set<string>();
  const add = (c: Cutout): boolean => {
    const opening = openingOf(c, params, clearance);
    if (!opening) return false;
    (c.shape === 'mesh' ? imprints : pockets).push(...opening);
    return true;
  };
  const groups = new Map<string, Cutout[]>();
  for (const c of shapes) {
    if (c.groupId === null) {
      if (!expandCutoutArray(c).every(add)) return null;
      continue;
    }
    const members = groups.get(c.groupId);
    if (members) members.push(c);
    else groups.set(c.groupId, [c]);
  }
  for (const members of groups.values()) {
    const op = members[0].groupOp ?? DEFAULT_GROUP_OP;
    let built = false;
    for (const copy of expandCutoutGroup(members)) {
      if (!copy.filter((m) => m.shape === 'mesh').every(add)) return null;
      const entries = copy
        .filter((m) => m.shape !== 'mesh')
        .flatMap((cutout) => {
          const polygon = (openingOf(cutout, params, clearance) ?? []).at(0);
          return polygon ? [{ cutout, polygon }] : [];
        });
      const result = combineGroupPolygons(entries, op) ?? [];
      if (result.length > 0) built = true;
      pockets.push(...result);
    }
    if (!built) for (const m of members) emptyOwners.add(m.id);
  }
  return { pockets, imprints, emptyOwners };
}

/** Longer than any bin is wide, so a knife slot's exit always clears the wall (mm). */
const KNIFE_EXIT_REACH_MARGIN = 50;

/**
 * Where pockets run out through the wall, in the editor frame: open sides
 * that open the top (a tunnel stays under it), and knife slots with an open
 * end. The generator cuts neither through a tapered wall.
 */
function exitPolygons(
  params: BinParams,
  innerW: number,
  innerD: number,
  emptyOwners: ReadonlySet<string>
): MultiPolygon {
  if (cutoutTaperBand(params)) return [];
  const sides: MultiPolygon = openSideChannels(params, emptyOwners)
    .filter((ch) => !ch.tunnel)
    .map((ch) => [
      openSideChannelOutline(ch, { innerW, innerD, wallThickness: params.wallThickness }),
    ]);
  const knives: MultiPolygon = [];
  for (const master of params.cutouts) {
    if (master.shape !== 'knifeSlot' || master.groupId !== null || master.hidden === true) continue;
    const openEnd = (master.knife ?? DEFAULT_KNIFE_SPEC).openEnd;
    if (openEnd === undefined) continue;
    for (const c of expandCutoutArray(master)) {
      if (c.rotation % 90 !== 0) continue;
      // From inside the slot's round end, out along its length through the wall.
      const reach = innerW + innerD + KNIFE_EXIT_REACH_MARGIN;
      const near = c.width / 2 - slotCornerRadius(c.width, c.depth);
      const dir = openEnd === 'end' ? 1 : -1;
      const cx = c.x + c.width / 2;
      const cy = c.y + c.depth / 2;
      const ring: Ring = [
        [near, -c.depth / 2],
        [near + reach, -c.depth / 2],
        [near + reach, c.depth / 2],
        [near, c.depth / 2],
      ].map(([x, y]) => rotateAbout(cx + dir * x, cy + y, cx, cy, c.rotation));
      knives.push([ring]);
    }
  }
  return [...sides, ...knives];
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

export function planShadowBoard(
  params: BinParams,
  options: ShadowBoardOptions
): Result<ShadowBoardPlan, ShadowBoardProblem> {
  const { innerW, innerD, offsetX, offsetY } = cutoutInterior(params);
  const found = openingPolygons(params, options.clearance);
  if (!found) return err('meshMissing');

  const toModel = (polygons: MultiPolygon): MultiPolygon =>
    polygons.map((polygon) =>
      polygon.map((ring) =>
        ring.map(([x, y]): [number, number] => [x - innerW / 2 + offsetX, y - innerD / 2 + offsetY])
      )
    );
  const outline = footprint(params);
  const footprintPolygon: Polygon = outline.map((ring) =>
    ring.map((p): [number, number] => [p.x, p.y])
  );
  const interior: Polygon = [
    [
      [0, 0],
      [innerW, 0],
      [innerW, innerD],
      [0, innerD],
    ],
  ];
  // Profile pockets stay inside the interior; imprints and wall exits are cut
  // from the whole bin, and nothing is cut where the bin has no material.
  const inside = polygonClipping.intersection(union(found.pockets), interior);
  const cut = union([
    ...toModel(inside),
    ...toModel(found.imprints),
    ...toModel(exitPolygons(params, innerW, innerD, found.emptyOwners)),
  ]);
  const openings = cut.length > 0 ? polygonClipping.intersection(cut, footprintPolygon) : [];
  if (openings.length === 0) return err('empty');
  return ok({
    outline,
    openings: openings.map((polygon) => polygon.map(fromRing)),
  });
}
