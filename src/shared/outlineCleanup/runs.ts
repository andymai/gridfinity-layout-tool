/**
 * A closed outline as corners and the runs between them, each run fitted as
 * straight lines or as curves. Fitting run by run keeps every corner sharp:
 * a curve fitter handed the whole loop would round them off, since it joins
 * its pieces smoothly.
 */

import fitCurve from 'fit-curve';
import { simplifyRdp } from '@/shared/scanTrace/simplify';
import type { PathPoint } from '@/shared/types/bin';

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** A turn sharper than this, in degrees, over the corner window is a corner. */
const CORNER_TURN_DEG = 35;
/** How far a run may stray from its chord, in mm, and still read as straight. */
const STRAIGHT_MM = 0.4;
/** A straight run within this many degrees of an axis is squared to it. */
const STRAIGHTEN_DEG = 7;
/** Shorter straight runs are not squared: a short facet's angle is mostly noise. */
const MIN_STRAIGHTEN_MM = 3;

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: Pt): number => Math.hypot(v.x, v.y);

/** Arc length at each point, with the closing edge's end as a last entry. */
function arcLengths(ring: readonly Pt[]): number[] {
  const s = [0];
  for (let i = 0; i < ring.length; i++) {
    s.push(s[i] + len(sub(ring[(i + 1) % ring.length], ring[i])));
  }
  return s;
}

/** The point at arc position `pos` around the ring, wrapping either way. */
function pointAt(ring: readonly Pt[], s: readonly number[], pos: number): Pt {
  const perimeter = s[ring.length];
  const at = ((pos % perimeter) + perimeter) % perimeter;
  let lo = 0;
  let hi = ring.length;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid] <= at) lo = mid;
    else hi = mid;
  }
  const a = ring[lo];
  const b = ring[(lo + 1) % ring.length];
  const span = s[lo + 1] - s[lo];
  const t = span > 0 ? (at - s[lo]) / span : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Indices of the ring's corners: points where the outline turns by more than
 * a corner's worth across `window` mm either side, keeping only the sharpest
 * within a window of one another.
 */
export function findCorners(ring: readonly Pt[], window: number): number[] {
  const n = ring.length;
  if (n < 5) return [];
  const s = arcLengths(ring);
  const w = Math.min(window, s[n] / 6);
  if (!(w > 0)) return [];
  const turn = ring.map((p, i) => {
    const a = sub(p, pointAt(ring, s, s[i] - w));
    const b = sub(pointAt(ring, s, s[i] + w), p);
    const la = len(a);
    const lb = len(b);
    if (la === 0 || lb === 0) return 0;
    const cos = (a.x * b.x + a.y * b.y) / (la * lb);
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  });
  const perimeter = s[n];
  const forward = (from: number, to: number): number => {
    const d = s[to] - s[from];
    return d >= 0 ? d : d + perimeter;
  };
  const beats = (j: number, i: number): boolean =>
    turn[j] > turn[i] || (turn[j] === turn[i] && j < i);
  const corners: number[] = [];
  for (let i = 0; i < n; i++) {
    if (turn[i] < CORNER_TURN_DEG) continue;
    let peak = true;
    for (let k = 1; k < n && peak; k++) {
      const ahead = (i + k) % n;
      const behind = (i - k + n) % n;
      const near = forward(i, ahead) <= w;
      const nearBehind = forward(behind, i) <= w;
      if (!near && !nearBehind) break;
      if ((near && beats(ahead, i)) || (nearBehind && beats(behind, i))) peak = false;
    }
    if (peak) corners.push(i);
  }
  return corners;
}

/** The points from `from` to `to` around the ring, both ends included. */
function slice(ring: readonly Pt[], from: number, to: number): Pt[] {
  const out: Pt[] = [];
  const n = ring.length;
  for (let i = from; ; i = (i + 1) % n) {
    out.push(ring[i]);
    if (i === to && out.length > 1) break;
  }
  return out;
}

/** The farthest any point of `run` lies from the chord joining its ends. */
function chordDeviation(run: readonly Pt[]): number {
  const a = run[0];
  const b = run[run.length - 1];
  const d = sub(b, a);
  const l = len(d);
  let worst = 0;
  for (const p of run) {
    const e = sub(p, a);
    worst = Math.max(worst, l === 0 ? len(e) : Math.abs(e.x * d.y - e.y * d.x) / l);
  }
  return worst;
}

/** A straight line, squared to an axis, as a point on it and its direction. */
interface Line {
  readonly at: Pt;
  readonly dir: Pt;
}

/**
 * The axis-square line through `run`, when the run is straight, long enough,
 * and within a few degrees of `axisAngle` or square to it.
 */
function squaredLine(run: readonly Pt[], axisAngle: number, tolerance: number): Line | null {
  const a = run[0];
  const b = run[run.length - 1];
  const length = len(sub(b, a));
  if (length < MIN_STRAIGHTEN_MM) return null;
  if (chordDeviation(run) > Math.max(tolerance, STRAIGHT_MM)) return null;
  const angle = Math.atan2(b.y - a.y, b.x - a.x) - axisAngle;
  const quarter = Math.PI / 2;
  const nearest = Math.round(angle / quarter) * quarter;
  if (Math.abs(angle - nearest) > (STRAIGHTEN_DEG * Math.PI) / 180) return null;
  const snapped = nearest + axisAngle;
  const mean = run.reduce((m, p) => ({ x: m.x + p.x / run.length, y: m.y + p.y / run.length }), {
    x: 0,
    y: 0,
  });
  return { at: mean, dir: { x: Math.cos(snapped), y: Math.sin(snapped) } };
}

function intersect(l1: Line, l2: Line): Pt | null {
  const cross = l1.dir.x * l2.dir.y - l1.dir.y * l2.dir.x;
  if (Math.abs(cross) < 1e-9) return null;
  const d = sub(l2.at, l1.at);
  const t = (d.x * l2.dir.y - d.y * l2.dir.x) / cross;
  return { x: l1.at.x + l1.dir.x * t, y: l1.at.y + l1.dir.y * t };
}

function project(p: Pt, line: Line): Pt {
  const d = sub(p, line.at);
  const t = d.x * line.dir.x + d.y * line.dir.y;
  return { x: line.at.x + line.dir.x * t, y: line.at.y + line.dir.y * t };
}

/** One step from the previous point: a line, or a cubic with its two control points. */
interface Step {
  readonly to: Pt;
  readonly c1?: Pt;
  readonly c2?: Pt;
}

type Cubic = number[][];

function offsetFrom(p: Pt, a: Pt, b: Pt): number {
  const d = sub(b, a);
  const l = len(d);
  const e = sub(p, a);
  return l === 0 ? len(e) : (e.x * d.y - e.y * d.x) / l;
}

/** Indices Ramer-Douglas-Peucker keeps along an open run, both ends included. */
function rdpIndices(run: readonly Pt[], tolerance: number): number[] {
  const n = run.length;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  for (let top = stack.pop(); top; top = stack.pop()) {
    const [a, b] = top;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(offsetFrom(run[i], run[a], run[b]));
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > tolerance) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i] === 1) out.push(i);
  return out;
}

/** Shortest stretch, in mm, kept as a straight piece of its own. */
const MIN_LINE_MM = 3;
/**
 * A stretch is straight when a parabola fitted along it bows by at most this
 * share of the tolerance: a straight line then stays within the tolerance
 * too. Fitting the bow, rather than reading offsets from the chord, keeps a
 * noisy edge straight even when the corners it runs between sit off its line.
 */
const BOW_SHARE = 0.5;

/** A stretch of a run, straight or curved, its ends shared with its neighbours. */
interface Piece {
  readonly points: readonly Pt[];
  readonly straight: boolean;
}

/** The bow of the least-squares parabola through `points`, across its chord, in mm. */
function bow(points: readonly Pt[]): number {
  const a = points[0];
  const b = points[points.length - 1];
  const length = len(sub(b, a));
  const dir = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  // Normal equations for v = p u^2 + q u + r, with u spanning -1 to 1.
  const s = [0, 0, 0, 0, 0];
  const t = [0, 0, 0];
  for (const pt of points) {
    const e = sub(pt, a);
    const u = (2 * (e.x * dir.x + e.y * dir.y)) / length - 1;
    const v = e.x * -dir.y + e.y * dir.x;
    for (let k = 0, uk = 1; k < 5; k++, uk *= u) {
      s[k] += uk;
      if (k < 3) t[k] += uk * v;
    }
  }
  const m = [
    [s[4], s[3], s[2], t[2]],
    [s[3], s[2], s[1], t[1]],
    [s[2], s[1], s[0], t[0]],
  ];
  for (let c = 0; c < 3; c++) {
    let pivot = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
    [m[c], m[pivot]] = [m[pivot], m[c]];
    if (Math.abs(m[c][c]) < 1e-12) return 0;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k];
    }
  }
  return Math.abs(m[0][3] / m[0][0]);
}

function isStraight(points: readonly Pt[], tolerance: number): boolean {
  const a = points[0];
  const b = points[points.length - 1];
  if (len(sub(b, a)) < MIN_LINE_MM) return false;
  return points.length < 4 || bow(points) <= BOW_SHARE * tolerance;
}

/**
 * A run split into its straight pieces and the curved spans between them,
 * so a fitted curve never bends a straight edge and a straight edge stays
 * one line however its curve-fitted neighbours fall.
 */
function piecesOf(run: readonly Pt[], tolerance: number, between: boolean): Piece[] {
  if (run.length <= 2) return [{ points: run, straight: true }];
  // A whole run between two corners that stays within the tolerance of its
  // chord is a straight edge, whatever its noise looks like across it.
  if (
    between &&
    chordDeviation(run) <= tolerance &&
    len(sub(run[run.length - 1], run[0])) >= MIN_LINE_MM
  ) {
    return [{ points: run, straight: true }];
  }
  const kept = rdpIndices(run, tolerance);
  const out: Piece[] = [];
  let curved: number | null = null;
  for (let k = 0; k + 1 < kept.length; k++) {
    const a = kept[k];
    const b = kept[k + 1];
    const stretch = run.slice(a, b + 1);
    if (isStraight(stretch, tolerance)) {
      if (curved !== null) out.push({ points: run.slice(curved, a + 1), straight: false });
      curved = null;
      out.push({ points: stretch, straight: true });
    } else if (curved === null) {
      curved = a;
    }
  }
  if (curved !== null) out.push({ points: run.slice(curved), straight: false });
  return out;
}

function fitSteps(run: readonly Pt[], tolerance: number, curves: boolean): Step[] {
  const end = run[run.length - 1];
  const lines = () =>
    simplifyRdp(run, tolerance)
      .slice(1)
      .map((to) => ({ to }));
  if (run.length <= 2) return [{ to: end }];
  if (!curves) return lines();
  const points: number[][] = [];
  for (const p of run) {
    const last = points.at(-1);
    if (!last || last[0] !== p.x || last[1] !== p.y) points.push([p.x, p.y]);
  }
  let cubics: Cubic[];
  try {
    cubics = points.length >= 2 ? fitCurve(points, tolerance * tolerance) : [];
  } catch {
    cubics = [];
  }
  if (cubics.length === 0) return lines();
  return cubics.map((b, i) => ({
    to: i === cubics.length - 1 ? end : { x: b[3][0], y: b[3][1] },
    c1: { x: b[1][0], y: b[1][1] },
    c2: { x: b[2][0], y: b[2][1] },
  }));
}

export interface FitOptions {
  /** How far, in mm, the fitted outline may stray from the dense one. */
  readonly tolerance: number;
  readonly curves: boolean;
  /** Square nearly square straight edges to these axes, at this angle; null leaves them. */
  readonly axisAngle: number | null;
  /** The corner window, in mm. */
  readonly window: number;
}

/**
 * A dense closed ring as path points: corners kept, straight edges kept
 * straight and, when asked, squared to the axes, the curved spans between
 * them fitted as curves or fine straight steps.
 */
export function fitRing(ring: readonly Pt[], options: FitOptions): PathPoint[] {
  const { tolerance, curves, axisAngle, window } = options;
  const corners = findCorners(ring, window);
  const stops = corners.length === 0 ? [0] : corners;
  const pieces = stops.flatMap((from, k) =>
    piecesOf(slice(ring, from, stops[(k + 1) % stops.length]), tolerance, corners.length > 0)
  );
  const m = pieces.length;
  const lines = pieces.map((piece) =>
    piece.straight && axisAngle !== null ? squaredLine(piece.points, axisAngle, tolerance) : null
  );
  // Where each piece starts, moved onto the squared lines either side of it.
  const at = pieces.map((piece, k) => {
    const before = lines[(k - 1 + m) % m];
    const after = lines[k];
    const p = piece.points[0];
    if (before && after) return intersect(before, after) ?? project(p, after);
    if (after) return project(p, after);
    if (before) return project(p, before);
    return p;
  });
  const steps: Step[] = [];
  pieces.forEach((piece, k) => {
    const stop = at[(k + 1) % m];
    if (piece.straight) {
      steps.push({ to: stop });
      return;
    }
    steps.push(...fitSteps([at[k], ...piece.points.slice(1, -1), stop], tolerance, curves));
  });
  return toPathPoints(at[0], steps);
}

function toPathPoints(start: Pt, steps: readonly Step[]): PathPoint[] {
  const points: { x: number; y: number; in: Pt | null; out: Pt | null }[] = [
    { x: start.x, y: start.y, in: null, out: null },
  ];
  for (const step of steps) {
    const prev = points[points.length - 1];
    if (step.c1) prev.out = sub(step.c1, prev);
    points.push({
      x: step.to.x,
      y: step.to.y,
      in: step.c2 ? sub(step.c2, step.to) : null,
      out: null,
    });
  }
  // The last step comes back to the start: its handle belongs to the first point.
  const last = points.pop();
  if (last && points.length > 0) points[0].in = last.in;
  const handle = (v: Pt | null) => (v && (v.x !== 0 || v.y !== 0) ? { dx: v.x, dy: v.y } : null);
  return points.map((p) => ({
    x: p.x,
    y: p.y,
    handleIn: handle(p.in),
    handleOut: handle(p.out),
    symmetric: false,
  }));
}
