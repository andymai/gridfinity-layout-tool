/**
 * A pocket split by a straight line into sides A and B, each cut to its own
 * depth from the same top. The line lives in the cutout's own frame (mm from
 * its centre, before it is turned), so it moves and turns with the pocket.
 */

import type { Cutout } from '@/shared/types/bin';
import { resolveCutoutLeanDeg } from '@/shared/types/bin';
import { cutoutOutlineRing, rotateAbout } from './cutoutOutline';
import { pathCutoutOutline } from './pathCutoutOutline';
import { expandCutoutArray } from './cutoutArray';

type Split = NonNullable<Cutout['split']>;

export interface SplitPt {
  readonly x: number;
  readonly y: number;
}

export type SplitBlock = 'shape' | 'group' | 'tilt' | 'through';
/** Why a line cannot split a pocket: it does not cross it cleanly, or leaves a sliver. */
export type SplitProblem = 'crossings' | 'small';

const SPLIT_SHAPES: readonly Cutout['shape'][] = ['rectangle', 'circle', 'slot', 'polygon', 'path'];
/** Smaller than this, a side is a sliver no tool sits in (mm²). */
const MIN_SIDE_AREA_MM2 = 0.25;

/**
 * Why a cutout cannot be split, or null when it can. A group's cavity is no
 * one member's, a leaning pocket's sides would need their own lean, and a
 * through cut has no floor to step.
 */
export function splitBlockedReason(
  c: Pick<Cutout, 'shape' | 'groupId' | 'leanDeg' | 'depthMode' | 'finger'>
): SplitBlock | null {
  if (!SPLIT_SHAPES.includes(c.shape) || c.finger !== undefined) return 'shape';
  if (c.groupId !== null) return 'group';
  if (resolveCutoutLeanDeg(c) !== 0) return 'tilt';
  if (c.depthMode === 'through') return 'through';
  return null;
}

/** The pocket's drawn outline in its own frame. */
export function splitOutline(c: Cutout): SplitPt[] | null {
  if (c.shape === 'path') {
    const outline = pathCutoutOutline(c);
    return outline ? outline.map((p) => ({ x: p.x, y: p.y })) : null;
  }
  const ring = cutoutOutlineRing({ ...c, x: -c.width / 2, y: -c.depth / 2, rotation: 0 });
  return ring ? ring.map(([x, y]) => ({ x, y })) : null;
}

/** A world point (the editor's interior frame) in the cutout's own frame. */
export function toSplitFrame(c: Cutout, x: number, y: number): SplitPt {
  const cx = c.x + c.width / 2;
  const cy = c.y + c.depth / 2;
  const [rx, ry] = rotateAbout(x, y, cx, cy, -c.rotation);
  return { x: rx - cx, y: ry - cy };
}

/** A point in the cutout's own frame, placed in the editor's interior frame. */
export function fromSplitFrame(c: Cutout, p: SplitPt): SplitPt {
  const cx = c.x + c.width / 2;
  const cy = c.y + c.depth / 2;
  const [x, y] = rotateAbout(cx + p.x, cy + p.y, cx, cy, c.rotation);
  return { x, y };
}

/** Positive left of `a` to `b`. */
function sideOf(p: SplitPt, a: SplitPt, b: SplitPt): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

/** Where the line through `a` and `b` crosses each outline edge, as points. */
function crossings(ring: readonly SplitPt[], a: SplitPt, b: SplitPt): SplitPt[] {
  const out: SplitPt[] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const sp = sideOf(p, a, b);
    const sq = sideOf(q, a, b);
    // Each edge owns its start point only, so a vertex on the line counts once.
    if ((sp >= 0 && sq < 0) || (sp < 0 && sq >= 0)) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return out;
}

/** The part of `ring` left of `a` to `b`. */
function leftOf(ring: readonly SplitPt[], a: SplitPt, b: SplitPt): SplitPt[] {
  const out: SplitPt[] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const sp = sideOf(p, a, b);
    const sq = sideOf(q, a, b);
    if (sp >= 0) out.push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return out;
}

function area(ring: readonly SplitPt[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return Math.abs(sum) / 2;
}

export interface SplitSides {
  readonly a: SplitPt[];
  readonly b: SplitPt[];
  /** Where the line meets the outline, from the end nearer `a` to the end nearer `b`. */
  readonly ends: readonly [SplitPt, SplitPt];
}

/**
 * The two sides a line cuts a pocket into, in the cutout's own frame, or why
 * it cannot: the line has to cross the outline exactly twice, and leave more
 * than a sliver either side.
 */
export function splitSides(c: Cutout, line: Pick<Split, 'a' | 'b'>): SplitSides | SplitProblem {
  const outline = splitOutline(c);
  const { a, b } = line;
  if (!outline || Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) return 'crossings';
  const hits = crossings(outline, a, b);
  if (hits.length !== 2) return 'crossings';
  const sideA = leftOf(outline, a, b);
  const sideB = leftOf(outline, b, a);
  if (area(sideA) < MIN_SIDE_AREA_MM2 || area(sideB) < MIN_SIDE_AREA_MM2) return 'small';
  const along = (p: SplitPt) => (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
  const [first, second] = along(hits[0]) <= along(hits[1]) ? hits : [hits[1], hits[0]];
  return { a: sideA, b: sideB, ends: [first, second] };
}

/**
 * The split the builder should cut, or null when it cuts the pocket whole: no
 * split, a blocked pocket, a line that no longer divides it, or two sides that
 * already sit at one depth.
 */
export function effectiveSplit(c: Cutout): Split | null {
  const split = c.split;
  if (!split || splitBlockedReason(c) !== null) return null;
  if (Math.abs(split.cutDepth - c.cutDepth) < 1e-6) return null;
  return typeof splitSides(c, split) === 'string' ? null : split;
}

export function shallowerDepth(c: Cutout): number {
  const split = effectiveSplit(c);
  return split ? Math.min(c.cutDepth, split.cutDepth) : c.cutDepth;
}

export function deeperDepth(c: Cutout): number {
  const split = effectiveSplit(c);
  return split ? Math.max(c.cutDepth, split.cutDepth) : c.cutDepth;
}

/** How deep the pocket is cut under `p`, a point in its own frame. */
export function depthAt(c: Cutout, p: SplitPt): number {
  const split = effectiveSplit(c);
  if (!split) return c.cutDepth;
  return onSideB(split, p) ? split.cutDepth : c.cutDepth;
}

/** Whether `p`, in the cutout's own frame, lies on side B; the line itself is A's. */
export function onSideB(split: Pick<Split, 'a' | 'b'>, p: SplitPt): boolean {
  return sideOf(p, split.a, split.b) < 0;
}

export function sideBShare(c: Cutout): number {
  const split = effectiveSplit(c);
  if (!split) return 0;
  const sides = splitSides(c, split);
  if (typeof sides === 'string') return 0;
  const a = area(sides.a);
  const b = area(sides.b);
  return b / (a + b);
}

/**
 * `split` with a depth edit for side B applied, read the way a pocket's own
 * depth edit is: a depth typed without a mode means a fixed depth, so a floor
 * mode that would re-derive it straight away is dropped.
 */
export function patchSplit(
  split: Split,
  patch: Partial<Pick<Cutout, 'cutDepth' | 'depthMode' | 'floorMm'>>
): Split {
  const next: { -readonly [K in keyof Split]: Split[K] } = { ...split };
  if (patch.cutDepth !== undefined) next.cutDepth = patch.cutDepth;
  if ('floorMm' in patch) next.floorMm = patch.floorMm;
  if ('depthMode' in patch) next.depthMode = patch.depthMode === 'floor' ? 'floor' : undefined;
  const typedDepth = patch.cutDepth !== undefined && !('depthMode' in patch);
  const { depthMode, floorMm, ...fixed } = next;
  if (!typedDepth && depthMode !== undefined) {
    return floorMm === undefined ? { ...fixed, depthMode } : { ...fixed, depthMode, floorMm };
  }
  return fixed;
}

/**
 * A redrawn line, its direction turned to agree with the old one so A and B
 * stay where they were. Exactly across it, the turn that keeps the old start
 * on the right decides.
 */
export function alignedSplitLine(
  old: Pick<Split, 'a' | 'b'> | undefined,
  a: SplitPt,
  b: SplitPt
): { readonly a: SplitPt; readonly b: SplitPt } {
  if (!old) return { a, b };
  const ox = old.b.x - old.a.x;
  const oy = old.b.y - old.a.y;
  const nx = b.x - a.x;
  const ny = b.y - a.y;
  const dot = ox * nx + oy * ny;
  const scale = Math.hypot(ox, oy) * Math.hypot(nx, ny);
  const flip = Math.abs(dot) > 1e-9 * scale ? dot < 0 : ox * ny - oy * nx < 0;
  return flip ? { a: b, b: a } : { a, b };
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Side B's depth on a first split: half the pocket's, to the half millimetre. */
function firstSideBDepth(c: Cutout): number {
  return Math.max(0.5, Math.round(c.cutDepth) / 2);
}

function inside(ring: readonly SplitPt[], p: SplitPt): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      hit = !hit;
    }
  }
  return hit;
}

/** Whether the segment from `p` to `q` crosses the outline or lies in it. */
function segmentMeets(ring: readonly SplitPt[], p: SplitPt, q: SplitPt): boolean {
  for (let i = 0; i < ring.length; i++) {
    const r = ring[i];
    const s = ring[(i + 1) % ring.length];
    if (sideOf(r, p, q) * sideOf(s, p, q) <= 0 && sideOf(p, r, s) * sideOf(q, r, s) <= 0) {
      return true;
    }
  }
  return inside(ring, p);
}

/**
 * The split a line drawn in the editor from `start` to `end` makes, or why it
 * cannot split the pocket. A repeat takes the line from the copy the drawn
 * segment crosses, as every copy shares the master's frame; only a drag that
 * touches none falls back to the first copy its extension crosses. A redrawn
 * split keeps its depths, and its sides stay where they were.
 */
export function drawnSplit(c: Cutout, start: SplitPt, end: SplitPt): Split | SplitProblem {
  const copies = c.array ? expandCutoutArray(c) : [c];
  const outline = splitOutline(c);
  const touched = outline
    ? copies.filter((copy) =>
        segmentMeets(
          outline,
          toSplitFrame(copy, start.x, start.y),
          toSplitFrame(copy, end.x, end.y)
        )
      )
    : [];
  let problem: SplitProblem = 'crossings';
  for (const copy of [...touched, ...copies.filter((x) => !touched.includes(x))]) {
    const line = alignedSplitLine(
      c.split,
      toSplitFrame(copy, start.x, start.y),
      toSplitFrame(copy, end.x, end.y)
    );
    const sides = splitSides(c, line);
    if (sides === 'small') problem = sides;
    if (typeof sides === 'string') continue;
    const [a, b] = sides.ends;
    return {
      ...(c.split ?? { cutDepth: firstSideBDepth(c) }),
      a: { x: round3(a.x), y: round3(a.y) },
      b: { x: round3(b.x), y: round3(b.y) },
    };
  }
  return problem;
}
