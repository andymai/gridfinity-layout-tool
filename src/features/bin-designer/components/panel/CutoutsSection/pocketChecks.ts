/**
 * Fast 2D checks on a solid bin's pockets as they are cut, clearance and entry
 * edge included: pockets that merge or leave a thin wall between them, pockets
 * that cut into the bin's wall or sit under its stacking lip, and floors too
 * thin to print well. Warnings only; nothing here stops an export.
 *
 * Pockets whose drawn outlines already overlap are left alone: a stepped pocket
 * or a finger cut over its pocket overlaps on purpose, and the overlap shows.
 */

import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { DEFAULT_GROUP_OP, resolveCutoutLeanDeg } from '@/features/bin-designer/types';
import { MASK_CELL_SIZE, maskToPolygon } from '@/shared/utils/cellMask';
import { expandCutoutArray, expandCutoutGroup } from '@/shared/utils/cutoutArray';
import { cutoutDepthFrame, floorUnderCutout, isThroughCut } from '@/shared/utils/cutoutDepth';
import { clearedProfile, entryChamferWidth } from '@/shared/utils/cutoutFit';
import { cutoutOutlineRing, meshOutlineRings } from '@/shared/utils/cutoutOutline';
import { cavityCornerRadiusMm } from '@/shared/utils/insideWallObstacles';
import { lipInnerReachMm } from '@/shared/utils/lipNotchPlan';
import { isCutoutOffBoard, type CutoutBoard } from './offBoardCutouts';

/** Three 0.4 mm perimeters: less than this between two cuts prints weak. */
export const MIN_MATERIAL_MM = 1.2;
/** Six 0.2 mm layers: a thinner floor flexes and can show light. */
export const MIN_FLOOR_MM = 1.2;

export type PocketIssueKind = 'merge' | 'wall' | 'lip' | 'thin' | 'floor';

export interface PocketIssue {
  readonly kind: PocketIssueKind;
  /** The cutouts involved, as stored: a repeat by its master. */
  readonly ids: readonly string[];
  /** The placed copies involved, for highlighting on the board. */
  readonly instanceIds: readonly string[];
  /**
   * Plastic left, in mm: between the cuts for `merge` and `thin` (zero or
   * less once they merge), in the wall for `wall` (negative once the cut
   * breaks through), under the floor for `floor`. For `lip`, how far the cut
   * reaches under the lip.
   */
  readonly mm: number;
  /** For `floor`: the change to `ids[0]` that leaves the minimum floor. */
  readonly fix?: Partial<Cutout>;
}

interface Pt {
  readonly x: number;
  readonly y: number;
}

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface Placed {
  readonly cutout: Cutout;
  /** The stored cutout the instance comes from. */
  readonly owner: string;
  /** One pocket: an instance, or one copy of a union group. */
  readonly unit: string;
  readonly rings: readonly (readonly Pt[])[];
  readonly box: Box;
  /** How far the cut stands out from the drawn outline at the surface. */
  readonly grow: number;
}

const KIND_ORDER: readonly PocketIssueKind[] = ['merge', 'wall', 'lip', 'thin', 'floor'];

function boxOf(rings: readonly (readonly Pt[])[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

function boxGap(a: Box, b: Box): number {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dy = Math.max(0, a.minY - b.maxY, b.minY - a.maxY);
  return Math.hypot(dx, dy);
}

function pointToSegment(p: Pt, a: Pt, b: Pt): number {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len2 = ex * ex + ey * ey;
  const k = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / len2));
  return Math.hypot(p.x - (a.x + ex * k), p.y - (a.y + ey * k));
}

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Distance between two segments; zero when they cross or touch. */
function segmentGap(a1: Pt, a2: Pt, b1: Pt, b2: Pt): number {
  const d1 = cross(a1, a2, b1);
  const d2 = cross(a1, a2, b2);
  const d3 = cross(b1, b2, a1);
  const d4 = cross(b1, b2, a2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return 0;
  }
  return Math.min(
    pointToSegment(a1, b1, b2),
    pointToSegment(a2, b1, b2),
    pointToSegment(b1, a1, a2),
    pointToSegment(b2, a1, a2)
  );
}

function segmentBox(a: Pt, b: Pt): Box {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

/**
 * The least distance between two sets of closed rings, looking only at edges
 * within `reach` of the other set: zero when any edges cross or touch, and
 * Infinity when nothing is that close.
 */
function ringsGap(
  a: readonly (readonly Pt[])[],
  aBox: Box,
  b: readonly (readonly Pt[])[],
  bBox: Box,
  reach: number
): number {
  const near = (rings: readonly (readonly Pt[])[], other: Box) => {
    const out: (readonly [Pt, Pt, Box])[] = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i];
        const q = ring[(i + 1) % ring.length];
        const box = segmentBox(p, q);
        if (boxGap(box, other) <= reach) out.push([p, q, box]);
      }
    }
    return out;
  };
  const sa = near(a, bBox);
  const sb = near(b, aBox);
  let best = Infinity;
  for (const [a1, a2, ab] of sa) {
    for (const [b1, b2, bb] of sb) {
      if (boxGap(ab, bb) >= best) continue;
      best = Math.min(best, segmentGap(a1, a2, b1, b2));
      if (best === 0) return 0;
    }
  }
  return best;
}

function pointInRing(ring: readonly Pt[], p: Pt): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Whether one set of rings lies inside the other, given that no edges cross. */
function nested(a: readonly (readonly Pt[])[], b: readonly (readonly Pt[])[]): boolean {
  const first = (rings: readonly (readonly Pt[])[]) => rings.find((r) => r.length > 0)?.[0];
  const pa = first(a);
  const pb = first(b);
  return (
    (pa !== undefined && b.some((ring) => pointInRing(ring, pa))) ||
    (pb !== undefined && a.some((ring) => pointInRing(ring, pb)))
  );
}

function ringsOf(c: Cutout, board: CutoutBoard): Pt[][] {
  if (c.shape === 'mesh') {
    return meshOutlineRings(c, board.meshAssets?.[c.meshId ?? '']).map((ring) =>
      ring.map(([x, y]) => ({ x, y }))
    );
  }
  const ring = cutoutOutlineRing(c);
  return ring ? [ring.map(([x, y]) => ({ x, y }))] : [];
}

/** Every pocket the cutouts cut, one entry per placed copy. */
function placePockets(cutouts: readonly Cutout[], board: CutoutBoard): Placed[] {
  const placed: Placed[] = [];
  const add = (c: Cutout, owner: string, unit: string) => {
    const rings = ringsOf(c, board).filter((r) => r.length >= 3);
    if (rings.length === 0) return;
    // A path is offset and a mesh dilated by the clearance on every side; the
    // other shapes grow by it across, half on each side.
    const { clearance } = clearedProfile(c);
    const perSide = c.shape === 'path' || c.shape === 'mesh' ? clearance : clearance / 2;
    const grow = perSide + entryChamferWidth(c);
    placed.push({ cutout: c, owner, unit, rings, box: boxOf(rings), grow });
  };
  const groups = new Map<string, Cutout[]>();
  for (const c of cutouts) {
    if (c.hidden === true || c.shape === 'text') continue;
    if (c.groupId === null) {
      for (const inst of expandCutoutArray(c)) add(inst, c.id, inst.id);
      continue;
    }
    const members = groups.get(c.groupId);
    if (members) members.push(c);
    else groups.set(c.groupId, [c]);
  }
  for (const [groupId, members] of groups) {
    if ((members[0].groupOp ?? DEFAULT_GROUP_OP) !== 'union') continue;
    expandCutoutGroup(members).forEach((copy, k) => {
      copy.forEach((m, i) => add(m, members[i].id, `${groupId}#${k}`));
    });
  }
  return placed;
}

/** The interior the pockets sit in, as rings in the editor's frame. */
function interiorRings(params: BinParams, board: CutoutBoard): Pt[][] {
  if (board.mask && board.cellSize) {
    const { cellMmX, cellMmY } = board.cellSize;
    return maskToPolygon(board.mask).map((loop) =>
      loop.map((p) => ({
        x: (p.x / MASK_CELL_SIZE) * cellMmX,
        y: (p.y / MASK_CELL_SIZE) * cellMmY,
      }))
    );
  }
  const w = board.width;
  const d = board.depth;
  const r = Math.max(0, Math.min(cavityCornerRadiusMm(params), w / 2, d / 2));
  const ring: Pt[] = [];
  const corners: readonly [number, number, number][] = [
    [w - r, r, -90],
    [w - r, d - r, 0],
    [r, d - r, 90],
    [r, r, 180],
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= 8; i++) {
      const a = ((start + (90 * i) / 8) * Math.PI) / 180;
      ring.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }
  return [ring];
}

/** Which of two readings of the same issue is worse: less plastic, or deeper under the lip. */
function worse(kind: PocketIssueKind, mm: number, than: number): boolean {
  return kind === 'lip' ? mm > than : mm < than;
}

/** One issue per kind and set of cutouts, holding the worst copy's reading. */
class IssueBook {
  private readonly byKey = new Map<string, { issue: PocketIssue; copies: Set<string> }>();

  note(
    kind: PocketIssueKind,
    ids: readonly string[],
    copies: readonly string[],
    mm: number,
    fix?: Partial<Cutout>
  ): void {
    const key = `${kind}|${ids.join('|')}`;
    const held = this.byKey.get(key);
    const issue: PocketIssue = { kind, ids, instanceIds: [], mm, ...(fix ? { fix } : {}) };
    if (!held) {
      this.byKey.set(key, { issue, copies: new Set(copies) });
      return;
    }
    for (const id of copies) held.copies.add(id);
    if (worse(kind, mm, held.issue.mm)) held.issue = issue;
  }

  all(): PocketIssue[] {
    return [...this.byKey.values()]
      .map(({ issue, copies }) => ({ ...issue, instanceIds: [...copies] }))
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.mm - b.mm);
  }
}

function checkPairs(pockets: readonly Placed[], book: IssueBook): void {
  for (let i = 0; i < pockets.length; i++) {
    for (let j = i + 1; j < pockets.length; j++) {
      const a = pockets[i];
      const b = pockets[j];
      if (a.unit === b.unit) continue;
      const reach = a.grow + b.grow + MIN_MATERIAL_MM;
      if (boxGap(a.box, b.box) >= reach) continue;
      const gap = ringsGap(a.rings, a.box, b.rings, b.box, reach);
      if (gap === 0) continue;
      const left = gap - a.grow - b.grow;
      if (left >= MIN_MATERIAL_MM || nested(a.rings, b.rings)) continue;
      const ids = a.owner === b.owner ? [a.owner] : [a.owner, b.owner].sort();
      const kind = left <= 0 ? 'merge' : 'thin';
      book.note(kind, ids, [a.cutout.id, b.cutout.id], left);
    }
  }
}

function checkWalls(
  pockets: readonly Placed[],
  params: BinParams,
  board: CutoutBoard,
  book: IssueBook
): void {
  const interior = interiorRings(params, board);
  const interiorBox = boxOf(interior);
  const lip = params.base.stackingLip
    ? Math.max(0, lipInnerReachMm(params) - params.wallThickness)
    : 0;
  for (const p of pockets) {
    if (isCutoutOffBoard(p.cutout, board)) continue;
    const reach = p.grow + Math.max(lip, MIN_MATERIAL_MM - params.wallThickness, 0);
    const inset = Math.min(
      p.box.minX - interiorBox.minX,
      p.box.minY - interiorBox.minY,
      interiorBox.maxX - p.box.maxX,
      interiorBox.maxY - p.box.maxY
    );
    if (!board.mask && inset >= reach) continue;
    const gap = ringsGap(p.rings, p.box, interior, interiorBox, reach);
    if (gap === Infinity) continue;
    const cut = gap - p.grow;
    const wallLeft = params.wallThickness + cut;
    if (cut < 0) book.note('wall', [p.owner], [p.cutout.id], wallLeft);
    else if (cut < lip) book.note('lip', [p.owner], [p.cutout.id], lip - cut);
    else if (wallLeft < MIN_MATERIAL_MM) book.note('wall', [p.owner], [p.cutout.id], wallLeft);
  }
}

function floorFix(c: Cutout, floor: number): Partial<Cutout> {
  if (c.depthMode === 'floor') return { floorMm: MIN_FLOOR_MM };
  const tilt = (resolveCutoutLeanDeg(c) * Math.PI) / 180;
  const shallower = (MIN_FLOOR_MM - floor) / Math.cos(tilt);
  return { cutDepth: Math.round(Math.max(0.5, c.cutDepth - shallower) * 100) / 100 };
}

function checkFloors(
  pockets: readonly Placed[],
  cutouts: readonly Cutout[],
  params: BinParams,
  book: IssueBook
): void {
  const frame = cutoutDepthFrame(params);
  const stored = new Map(cutouts.map((c) => [c.id, c]));
  for (const p of pockets) {
    if (p.cutout.shape === 'mesh' || isThroughCut(p.cutout, params)) continue;
    const floor = floorUnderCutout(p.cutout, frame);
    if (floor <= 0.01 || floor >= MIN_FLOOR_MM) continue;
    const owner = stored.get(p.owner);
    const fix = owner ? floorFix(owner, floor) : undefined;
    book.note('floor', [p.owner], [p.cutout.id], floor, fix);
  }
}

/** Everything worth a warning about how a solid bin's pockets will print. */
export function checkPockets(
  cutouts: readonly Cutout[],
  params: BinParams,
  board: CutoutBoard
): PocketIssue[] {
  const pockets = placePockets(cutouts, board);
  const book = new IssueBook();
  checkPairs(pockets, book);
  checkWalls(pockets, params, board, book);
  checkFloors(pockets, cutouts, params, book);
  return book.all();
}
