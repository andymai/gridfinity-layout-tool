/**
 * Fast 2D checks on a solid bin's pockets as they are cut, clearance and entry
 * edge included: pockets that merge or leave a thin wall between them, pockets
 * that cut into the bin's wall or sit under its stacking lip, and floors too
 * thin to print well. Warnings only; nothing here stops an export.
 *
 * Pockets whose drawn outlines already overlap are left alone: a stepped pocket
 * or a finger cut over its pocket overlaps on purpose, and the overlap shows.
 *
 * Everything is measured at the surface. Two pockets leaning toward each other
 * can still meet below it, which these checks do not see.
 */

import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { DEFAULT_GROUP_OP, resolveCutoutLeanDeg } from '@/features/bin-designer/types';
import { expandCutoutArray, expandCutoutGroup } from '@/shared/utils/cutoutArray';
import { cutoutDepthFrame, floorUnderCutout, isThroughCut } from '@/shared/utils/cutoutDepth';
import { clearedProfile, entryChamferWidth } from '@/shared/utils/cutoutFit';
import { cutoutOutlineRing, meshOutlineRings } from '@/shared/utils/cutoutOutline';
import { cavityCornerRadiusMm } from '@/shared/utils/insideWallObstacles';
import { lipInnerReachMm } from '@/shared/utils/lipNotchPlan';
import { effectiveOpenSides } from '@/shared/utils/cutoutOpenSides';
import { offsetClosedPolygon } from '@/shared/utils/polygonOffset';
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

interface Placed extends PlacedCopy {
  /** As drawn: what decides whether two pockets overlap on purpose. */
  readonly drawn: readonly (readonly Pt[])[];
  readonly drawnBox: Box;
  /** As cut at the surface: clearance and the entry edge's flare included. */
  readonly rings: readonly (readonly Pt[])[];
  readonly box: Box;
  /**
   * Rounded growth still to add around {@link rings}: a mesh imprint's
   * dilation, which offsetting its outline would square off at the corners.
   */
  readonly pad: number;
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

/**
 * The outline a cut takes at the surface. A drawn shape is cut at its cleared
 * size (for a polygon a uniform scale), a path is offset and a mesh dilated by
 * its clearance, and then every outline is offset again by its entry edge,
 * the way the builder flares it, so a polygon's corners reach furthest.
 */
function cutRingsOf(
  c: Cutout,
  drawn: Pt[][],
  board: CutoutBoard
): { readonly rings: Pt[][]; readonly pad: number } {
  const { clearance, w, d } = clearedProfile(c);
  const offsetBy = (rings: Pt[][], by: number) => ({
    rings: by > 0 ? rings.map((ring) => offsetClosedPolygon(ring, by)) : rings,
    pad: 0,
  });
  const entry = entryChamferWidth(c);
  if (c.shape === 'mesh') return { rings: drawn, pad: clearance + entry };
  if (c.shape === 'path') return offsetBy(drawn, clearance + entry);
  if (clearance === 0) return offsetBy(drawn, entry);
  const cleared = {
    ...c,
    x: c.x - (w - c.width) / 2,
    y: c.y - (d - c.depth) / 2,
    width: w,
    depth: d,
  };
  return offsetBy(ringsOf(cleared, board), entry);
}

export interface PlacedCopy {
  readonly cutout: Cutout;
  /** The stored cutout the copy comes from. */
  readonly owner: string;
  /** One pocket: an ungrouped copy, or one copy of a union group. */
  readonly unit: string;
}

/**
 * Every pocket the cutouts cut, one entry per placed copy, with repeats and
 * union groups expanded the way the generator cuts them: a legacy group can
 * hold its repeat on one member, and the others are copied on it.
 */
export function placedCopies(cutouts: readonly Cutout[]): PlacedCopy[] {
  const copies: PlacedCopy[] = [];
  const groups = new Map<string, Cutout[]>();
  for (const c of cutouts) {
    if (c.hidden === true || c.shape === 'text') continue;
    if (c.groupId === null) {
      for (const inst of expandCutoutArray(c))
        copies.push({ cutout: inst, owner: c.id, unit: inst.id });
      continue;
    }
    const members = groups.get(c.groupId);
    if (members) members.push(c);
    else groups.set(c.groupId, [c]);
  }
  for (const [groupId, members] of groups) {
    if ((members[0].groupOp ?? DEFAULT_GROUP_OP) !== 'union') continue;
    expandCutoutGroup(members).forEach((copy, k) => {
      copy.forEach((m, i) =>
        copies.push({ cutout: m, owner: members[i].id, unit: `${groupId}#${k}` })
      );
    });
  }
  return copies;
}

function placePockets(cutouts: readonly Cutout[], board: CutoutBoard): Placed[] {
  return placedCopies(cutouts).flatMap(({ cutout, owner, unit }): Placed[] => {
    const drawn = ringsOf(cutout, board).filter((r) => r.length >= 3);
    if (drawn.length === 0) return [];
    const cut = cutRingsOf(cutout, drawn, board);
    const rings = cut.rings.filter((r) => r.length >= 3);
    if (rings.length === 0) return [];
    return [
      {
        cutout,
        owner,
        unit,
        drawn,
        drawnBox: boxOf(drawn),
        rings,
        box: boxOf(rings),
        pad: cut.pad,
      },
    ];
  });
}

function interiorCornerRadius(params: BinParams, board: CutoutBoard): number {
  return Math.max(0, Math.min(cavityCornerRadiusMm(params), board.width / 2, board.depth / 2));
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
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  // Pockets that overlap on purpose, by whole pocket: a union is one cavity,
  // so overlapping any member exempts the pocket from all of them.
  const overlapping = new Set<string>();
  const near: (readonly [Placed, Placed])[] = [];
  for (let i = 0; i < pockets.length; i++) {
    for (let j = i + 1; j < pockets.length; j++) {
      const a = pockets[i];
      const b = pockets[j];
      if (a.unit === b.unit || boxGap(a.box, b.box) >= MIN_MATERIAL_MM + a.pad + b.pad) continue;
      // Crossing edges meet inside each other's box, so no reach is needed.
      if (ringsGap(a.drawn, a.drawnBox, b.drawn, b.drawnBox, 0) === 0 || nested(a.drawn, b.drawn)) {
        overlapping.add(pairKey(a.unit, b.unit));
      } else {
        near.push([a, b]);
      }
    }
  }
  for (const [a, b] of near) {
    if (overlapping.has(pairKey(a.unit, b.unit))) continue;
    const ids = a.owner === b.owner ? [a.owner] : [a.owner, b.owner].sort();
    // A cut that swallows the other whole is a merge, however far apart
    // their outlines run.
    if (nested(a.rings, b.rings)) {
      book.note('merge', ids, [a.cutout.id, b.cutout.id], 0);
      continue;
    }
    const pads = a.pad + b.pad;
    const left = ringsGap(a.rings, a.box, b.rings, b.box, MIN_MATERIAL_MM + pads) - pads;
    if (left >= MIN_MATERIAL_MM) continue;
    book.note(left <= 0 ? 'merge' : 'thin', ids, [a.cutout.id, b.cutout.id], left);
  }
}

/**
 * How far a point inside the bin's outer outline is from it: a rounded
 * rectangle one wall out from the interior, its corners one wall rounder.
 */
function toOuterFace(p: Pt, w: number, d: number, wall: number, radius: number): number {
  const qx = Math.abs(p.x - w / 2) - (w / 2 + wall - radius);
  const qy = Math.abs(p.y - d / 2) - (d / 2 + wall - radius);
  return radius - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0);
}

/**
 * The corners of what is left of the rings once clipped to the interior box,
 * as the builder clips every pocket tool. The distance to the outer face is
 * least at one of them, since it falls toward that face in a straight line.
 */
function clippedCorners(rings: readonly (readonly Pt[])[], w: number, d: number): Pt[] {
  const eps = 1e-9;
  const inBox = (q: Pt) => q.x >= -eps && q.x <= w + eps && q.y >= -eps && q.y <= d + eps;
  const out: Pt[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (inBox(a)) out.push(a);
      for (const [axis, at] of [
        ['x', 0],
        ['x', w],
        ['y', 0],
        ['y', d],
      ] as const) {
        const da = a[axis] - at;
        const db = b[axis] - at;
        if (da < 0 === db < 0 || da === db) continue;
        const t = da / (da - db);
        const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if (inBox(q)) out.push(q);
      }
    }
  }
  for (const corner of [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d },
  ]) {
    if (rings.some((ring) => pointInRing(ring, corner))) out.push(corner);
  }
  return out;
}

function nearestSide(p: Pt, w: number, d: number): 'left' | 'right' | 'front' | 'back' {
  const sides = [
    ['left', p.x],
    ['right', w - p.x],
    ['front', p.y],
    ['back', d - p.y],
  ] as const;
  return sides.reduce((best, side) => (side[1] < best[1] ? side : best))[0];
}

/**
 * Whether the cut opens through that wall to the top the full width of the
 * pocket, taking the lip with it there: by the generator's own rule, since a
 * leaning pocket keeps no exit. The generator holds an exit to the pocket's
 * span, so a width at least that wide is the whole span; a narrower keyhole
 * leaves the lip either side.
 */
function opensThrough(p: Placed, side: string, params: BinParams): boolean {
  const span =
    side === 'left' || side === 'right'
      ? p.drawnBox.maxY - p.drawnBox.minY
      : p.drawnBox.maxX - p.drawnBox.minX;
  return effectiveOpenSides(p.cutout, params).some(
    (s) => s.side === side && !s.tunnel && (s.widthMm === undefined || s.widthMm >= span - 1e-6)
  );
}

/**
 * A rectangular interior: the builder clips every pocket tool to its box, so a
 * straight wall keeps its full thickness and only a rounded corner, which
 * that box overhangs, can be cut thin. Material is read to the outer face.
 */
function checkBoxWalls(
  pockets: readonly Placed[],
  params: BinParams,
  board: CutoutBoard,
  book: IssueBook
): void {
  const { width: w, depth: d } = board;
  const wall = params.wallThickness;
  const inner = interiorCornerRadius(params, board);
  const radius = inner + wall;
  const lipReach = params.base.stackingLip ? lipInnerReachMm(params) : 0;
  const needed = Math.max(lipReach, MIN_MATERIAL_MM);
  // A rounded corner stands in from its bounding box by up to r(√2 − 1).
  const cornerSlack = inner * (Math.SQRT2 - 1);
  for (const p of pockets) {
    if (isCutoutOffBoard(p.cutout, board)) continue;
    const inset = Math.min(p.box.minX, p.box.minY, w - p.box.maxX, d - p.box.maxY);
    if (wall + inset - p.pad - cornerSlack >= needed) continue;
    let least = Infinity;
    let at: Pt | null = null;
    for (const q of clippedCorners(p.rings, w, d)) {
      // A mesh imprint's dilation comes after the clip: the generator subtracts
      // the imprint whole, so the wall does not stop it.
      const m = toOuterFace(q, w, d, wall, radius) - p.pad;
      if (m < least) {
        least = m;
        at = q;
      }
    }
    if (!at) continue;
    if (least < MIN_MATERIAL_MM) {
      book.note('wall', [p.owner], [p.cutout.id], least);
    } else if (least < lipReach && !opensThrough(p, nearestSide(at, w, d), params)) {
      book.note('lip', [p.owner], [p.cutout.id], lipReach - least);
    }
  }
}

/**
 * A custom footprint's walls follow the generator's tolerance-inset perimeter,
 * not the placement grid the editor holds, so they are left unchecked rather
 * than read wrongly; its pockets still get the pair and floor checks.
 */
function checkWalls(
  pockets: readonly Placed[],
  params: BinParams,
  board: CutoutBoard,
  book: IssueBook
): void {
  if (!board.mask) checkBoxWalls(pockets, params, board, book);
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
