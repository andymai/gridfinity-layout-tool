/**
 * Grab an edge and pull it, with the outline nearby following less the
 * farther it is: the fix for a traced edge that came out a little off.
 *
 * Only the stretch of ring around the grab moves, out to the first point on
 * each side that lies beyond the radius. Those two points stay where they
 * are, so the rest of the outline, and every point placed on it by hand, is
 * untouched. The stretch is sampled densely while it moves, then fitted again
 * with curves so it comes back with few points. No React, no store.
 */

import type { PathPoint } from '@/features/bin-designer/types';
import { MAX_PATH_POINTS } from '@/features/bin-designer/types';
import { EDIT_FIT_MM, fitRing, fitRun, type Pt } from '@/shared/outlineCleanup';
import { evaluateSegmentPoint, flattenSegment, splitBezierSegment } from '../pathGeometrySegments';

export const FALLOFF_MIN_MM = 1;
export const FALLOFF_MAX_MM = 100;
export const DEFAULT_FALLOFF_MM = 10;

/** Each `[` or `]` changes the radius by this factor. */
const FALLOFF_STEP = 1.25;

/** Spacing of the samples a moving stretch is drawn with, in mm. */
const SAMPLE_MM = 0.25;

/** Each retry for a stretch fitted past the point limit loosens the fit by this much. */
const LOOSEN = 1.5;
const MAX_LOOSENINGS = 12;

/** The radius one `[` (smaller) or `]` (larger) press away. */
export function nextFalloff(mm: number, grow: boolean): number {
  const next = grow ? mm * FALLOFF_STEP : mm / FALLOFF_STEP;
  return Math.round(Math.min(FALLOFF_MAX_MM, Math.max(FALLOFF_MIN_MM, next)) * 10) / 10;
}

export interface FalloffGrab {
  /** Where the edge was grabbed, in the path's frame. */
  readonly grab: Pt;
  readonly radius: number;
  /** The anchor the moving stretch starts at. */
  readonly from: number;
  /** How many segments the stretch spans; the whole ring when `closed`. */
  readonly segments: number;
  readonly closed: boolean;
  /** The stretch, sampled densely from anchor `from` on. An open stretch ends on its last anchor. */
  readonly samples: readonly Pt[];
  /** How far each sample follows the pointer, from 1 at the grab to 0 at the radius. */
  readonly weights: readonly number[];
  /** Where on the ring each sample lies: `k` segments on from `from`, at `t` along it. */
  readonly params: readonly { readonly k: number; readonly t: number }[];
  /** Samples that are sharp anchors inside the stretch, so the fit keeps them sharp. */
  readonly corners: readonly number[];
}

/** 1 at the grab, easing to 0 at the radius and beyond. */
function weight(distance: number, radius: number): number {
  const u = distance / radius;
  return u >= 1 ? 0 : (1 - u * u) ** 2;
}

const isCorner = (p: PathPoint): boolean => p.handleIn === null && p.handleOut === null;

function segmentLength(ring: readonly PathPoint[], index: number): number {
  const pts = flattenSegment(ring, index, 20);
  let sum = 0;
  for (let i = 1; i < pts.length; i++) {
    sum += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return sum;
}

/**
 * The stretch a grab on segment `segment` at `t` moves, or null for a ring too
 * small to have one.
 */
export function startFalloff(
  ring: readonly PathPoint[],
  segment: number,
  t: number,
  radius: number
): FalloffGrab | null {
  const n = ring.length;
  if (n < 2 || segment < 0 || segment >= n) return null;
  const grab = evaluateSegmentPoint(ring, segment, t);
  const at = (i: number) => ring[((i % n) + n) % n];
  const near = (i: number) => Math.hypot(at(i).x - grab.x, at(i).y - grab.y) < radius;
  let back = 0;
  while (back < n && near(segment - back)) back++;
  let ahead = 0;
  while (ahead < n && near(segment + 1 + ahead)) ahead++;
  const closed = back + ahead + 1 >= n;
  const from = closed ? 0 : (((segment - back) % n) + n) % n;
  const segments = closed ? n : back + ahead + 1;

  const samples: Pt[] = [];
  const params: { k: number; t: number }[] = [];
  const corners: number[] = [];
  for (let k = 0; k < segments; k++) {
    const index = (from + k) % n;
    if (k > 0 && isCorner(ring[index])) corners.push(samples.length);
    const steps = Math.max(1, Math.ceil(segmentLength(ring, index) / SAMPLE_MM));
    for (let s = 0; s < steps; s++) {
      samples.push(evaluateSegmentPoint(ring, index, s / steps));
      params.push({ k, t: s / steps });
    }
  }
  if (!closed) {
    samples.push({ x: at(from + segments).x, y: at(from + segments).y });
    params.push({ k: segments - 1, t: 1 });
  }
  const weights = samples.map((p) => weight(Math.hypot(p.x - grab.x, p.y - grab.y), radius));
  return { grab, radius, from, segments, closed, samples, weights, params, corners };
}

function movedSamples(grab: FalloffGrab, dx: number, dy: number): Pt[] {
  return grab.samples.map((p, i) => ({
    x: p.x + dx * grab.weights[i],
    y: p.y + dy * grab.weights[i],
  }));
}

const corner = (p: Pt): PathPoint => ({
  x: p.x,
  y: p.y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

/** The anchors after the stretch, back round to the one before it. */
function untouched(ring: readonly PathPoint[], grab: FalloffGrab): PathPoint[] {
  const n = ring.length;
  return Array.from(
    { length: n - grab.segments - 1 },
    (_, k) => ring[(grab.from + grab.segments + 1 + k) % n]
  );
}

/** The ring as it looks mid-drag: the stretch as dense corners, the rest as it was. */
export function falloffPreview(
  ring: readonly PathPoint[],
  grab: FalloffGrab,
  dx: number,
  dy: number
): PathPoint[] {
  const moved = movedSamples(grab, dx, dy).map(corner);
  if (grab.closed) return moved;
  const n = ring.length;
  const first = { ...ring[grab.from], handleOut: null, symmetric: false };
  const last = { ...ring[(grab.from + grab.segments) % n], handleIn: null, symmetric: false };
  return [first, ...moved.slice(1, -1), last, ...untouched(ring, grab)];
}

/** An open stretch fitted piece by piece between its sharp corners, so they stay sharp. */
function fitStretch(
  moved: readonly Pt[],
  corners: readonly number[],
  tolerance: number
): PathPoint[] {
  const cuts = [0, ...corners, moved.length - 1];
  const out: PathPoint[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const piece = fitRun(moved.slice(cuts[k], cuts[k + 1] + 1), tolerance);
    if (piece.length === 0) continue;
    if (out.length > 0) {
      // The piece starts on the corner the last one ended on: one point, two handles.
      const joint = out[out.length - 1];
      out[out.length - 1] = { ...joint, handleOut: piece[0].handleOut };
      out.push(...piece.slice(1));
    } else {
      out.push(...piece);
    }
  }
  return out;
}

/**
 * The ends of an open stretch that the pull does not reach, kept as they
 * were. The stretch's first and last segments are split where the pull starts
 * to move them, so only the part that moved is fitted again: fitting the still
 * parts too spends points on edges that did not change.
 */
interface Trimmed {
  /** The stretch's first anchor, its outgoing handle cut to the still part. */
  readonly start: PathPoint;
  /** Where the pull starts, with the still part's incoming handle. */
  readonly enter: PathPoint | null;
  /** Where the pull ends, with the still part's outgoing handle. */
  readonly leave: PathPoint | null;
  /** The stretch's last anchor, its incoming handle cut to the still part. */
  readonly end: PathPoint;
  /** The samples that moved, from the one at `enter` to the one at `leave`. */
  readonly first: number;
  readonly last: number;
}

function trim(ring: readonly PathPoint[], grab: FalloffGrab): Trimmed {
  const n = ring.length;
  const moving = grab.weights.map((w) => w > 0);
  const first = Math.max(0, moving.indexOf(true) - 1);
  const last = Math.min(grab.samples.length - 1, moving.lastIndexOf(true) + 1);
  let start = ring[grab.from];
  let end = ring[(grab.from + grab.segments) % n];
  let enter: PathPoint | null = null;
  let leave: PathPoint | null = null;
  const t0 = grab.params[first].t;
  const t1 = grab.params[last].t;
  if (grab.segments === 1) {
    // One segment holds both ends: split it at the entry, then the rest at the exit.
    let rest = end;
    if (first > 0 && t0 > 0) {
      const cut = splitBezierSegment(start, end, t0);
      start = cut.before;
      enter = cut.mid;
      rest = cut.after;
    }
    if (last < grab.samples.length - 1 && t1 < 1) {
      const from = enter ?? start;
      const cut = splitBezierSegment(from, rest, enter ? (t1 - t0) / (1 - t0) : t1);
      if (enter) enter = cut.before;
      else start = cut.before;
      leave = cut.mid;
      end = cut.after;
    } else {
      end = rest;
    }
    return { start, enter, leave, end, first, last };
  }
  if (first > 0 && t0 > 0) {
    const cut = splitBezierSegment(start, ring[(grab.from + 1) % n], t0);
    start = cut.before;
    enter = cut.mid;
  }
  if (last < grab.samples.length - 1 && t1 < 1) {
    const cut = splitBezierSegment(ring[(grab.from + grab.segments - 1) % n], end, t1);
    leave = cut.mid;
    end = cut.after;
  }
  return { start, enter, leave, end, first, last };
}

/**
 * The ring with the stretch moved by (dx, dy) at the grab and fitted with
 * curves, or null when no fit keeps the ring under the point limit.
 */
export function falloffCommit(
  ring: readonly PathPoint[],
  grab: FalloffGrab,
  dx: number,
  dy: number
): PathPoint[] | null {
  const moved = movedSamples(grab, dx, dy);
  const cut = grab.closed ? null : trim(ring, grab);
  let tolerance = EDIT_FIT_MM;
  for (let attempt = 0; attempt <= MAX_LOOSENINGS; attempt++, tolerance *= LOOSEN) {
    if (!cut) {
      const fitted = fitRing(moved, {
        tolerance,
        curves: true,
        axisAngle: null,
        window: Math.max(1, 3 * tolerance),
      });
      if (fitted.length <= MAX_PATH_POINTS) return fitted.length >= 2 ? fitted : null;
      continue;
    }
    const corners = grab.corners
      .filter((c) => c > cut.first && c < cut.last)
      .map((c) => c - cut.first);
    const fitted = fitStretch(moved.slice(cut.first, cut.last + 1), corners, tolerance);
    if (fitted.length < 2) return null;
    const rest = untouched(ring, grab);
    const ends = (cut.enter ? 1 : 0) + (cut.leave ? 1 : 0);
    if (fitted.length + ends + rest.length > MAX_PATH_POINTS) continue;
    // The fit's first and last points sit where the still parts meet it; each
    // takes the fit's handle on its moving side and keeps the still side's.
    const head = cut.enter
      ? [cut.start, { ...cut.enter, handleOut: fitted[0].handleOut, symmetric: false }]
      : [{ ...cut.start, handleOut: fitted[0].handleOut, symmetric: false }];
    const tailHandle = fitted[fitted.length - 1].handleIn;
    const tail = cut.leave
      ? [{ ...cut.leave, handleIn: tailHandle, symmetric: false }, cut.end]
      : [{ ...cut.end, handleIn: tailHandle, symmetric: false }];
    return [...head, ...fitted.slice(1, -1), ...tail, ...rest];
  }
  return null;
}
