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

function fitSteps(run: readonly Pt[], tolerance: number, curves: boolean): Step[] {
  const end = run[run.length - 1];
  if (run.length <= 2 || chordDeviation(run) <= tolerance) return [{ to: end }];
  if (!curves)
    return simplifyRdp(run, tolerance)
      .slice(1)
      .map((to) => ({ to }));
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
  if (cubics.length === 0)
    return simplifyRdp(run, tolerance)
      .slice(1)
      .map((to) => ({ to }));
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
  /** Square nearly square straight runs to these axes, at this angle; null leaves them. */
  readonly axisAngle: number | null;
  /** The corner window, in mm. */
  readonly window: number;
}

/**
 * A dense closed ring as path points: corners kept, each run between them
 * fitted on its own, nearly square straight runs squared to the axes.
 */
export function fitRing(ring: readonly Pt[], options: FitOptions): PathPoint[] {
  const { tolerance, curves, axisAngle, window } = options;
  const corners = findCorners(ring, window);
  const closed = corners.length === 0;
  const stops = closed ? [0] : corners;
  const runs = stops.map((from, k) => slice(ring, from, stops[(k + 1) % stops.length]));
  const lines = runs.map((run) =>
    axisAngle === null || closed ? null : squaredLine(run, axisAngle, tolerance)
  );
  // Each corner moves onto the squared runs either side of it.
  const at = stops.map((index, k) => {
    const before = lines[(k - 1 + stops.length) % stops.length];
    const after = lines[k];
    if (before && after) return intersect(before, after) ?? project(ring[index], after);
    if (after) return project(ring[index], after);
    if (before) return project(ring[index], before);
    return ring[index];
  });
  const steps: Step[] = [];
  runs.forEach((run, k) => {
    const start = at[k];
    const stop = at[(k + 1) % stops.length];
    if (lines[k]) {
      steps.push({ to: stop });
      return;
    }
    const moved = [start, ...run.slice(1, -1), stop];
    steps.push(...fitSteps(moved, tolerance, curves));
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
