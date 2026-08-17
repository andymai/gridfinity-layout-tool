/**
 * Containment checks for the LID's board: a rounded window with magnet keep-outs.
 *
 * The bin's board is a rectangle (or a cell mask, see `maskFit`). The lid's is
 * neither — `lidCutoutWindow` describes a rounded rectangle, and a magnetic lid
 * hangs a retention boss inside it that a hole must leave intact. The worker
 * already clips both (`buildClipBoundary` intersects the window and subtracts
 * the bosses), correctly and silently: the shape draws as if it will cut
 * cleanly and the printed part comes out with an unexplained disc-shaped island
 * in the middle of the slot.
 *
 * Both are ONE region here, for the same reason the worker builds one boundary:
 * a shape tucked into a rounded corner and a shape lying over a boss are the
 * same defect (material the cut will not reach), they get the same cue, and a
 * caller that had to ask two questions could answer one and forget the other.
 *
 * Precision matches `maskFit`'s: a bounding box is a fast ACCEPT and nothing
 * more. Rejecting on the box would flag a small circle tucked neatly into a
 * rounded corner, and an over-flag with a one-click clamp attached moves a shape
 * the user placed deliberately.
 */

import polygonClipping, { type MultiPolygon } from 'polygon-clipping';
import type { Cutout } from '@/features/bin-designer/types';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import type { LidCutoutKeepout, LidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
import { getCutoutOutline } from './cutoutOutline';
import { getCutoutBounds } from './maskFit';
import { translateCutout } from './cutoutHelpers';
import type { Bounds } from './geometryCore';

/** Tolerance (mm) for a flush edge, matching `OFF_BOARD_EPSILON`. */
const EPSILON = 0.01;

/** Leftover area (mm²) below which a clip result is float noise, as in `maskFit`. */
const RESIDUAL_AREA_EPSILON = 1e-6;

/** Segments per 90° of arc. Smooth enough that the polygon is not what decides a verdict. */
const ARC_SEGMENTS = 16;

type Ring = [number, number][];

/** Rounded-rect ring over `[0, spanW] × [0, spanD]`, counter-clockwise. */
function roundedRectRing(spanW: number, spanD: number, radius: number): Ring {
  const r = Math.max(0, Math.min(radius, spanW / 2, spanD / 2));
  if (r <= 0) {
    return [
      [0, 0],
      [spanW, 0],
      [spanW, spanD],
      [0, spanD],
    ];
  }
  // Each corner's arc centre, paired with the angle its sweep starts at.
  const corners: Array<{ cx: number; cy: number; from: number }> = [
    { cx: spanW - r, cy: r, from: -Math.PI / 2 },
    { cx: spanW - r, cy: spanD - r, from: 0 },
    { cx: r, cy: spanD - r, from: Math.PI / 2 },
    { cx: r, cy: r, from: Math.PI },
  ];
  const ring: Ring = [];
  for (const { cx, cy, from } of corners) {
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
      const a = from + (i / ARC_SEGMENTS) * (Math.PI / 2);
      ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return ring;
}

/** Polygonal disc for a keep-out, grown by nothing: the margin is already in `r`. */
function keepoutRing(k: LidCutoutKeepout): Ring {
  const segments = ARC_SEGMENTS * 4;
  const ring: Ring = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push([k.x + k.r * Math.cos(a), k.y + k.r * Math.sin(a)]);
  }
  return ring;
}

/**
 * The placeable region: the rounded window less every magnet boss.
 *
 * Memoized on the window object, which `CutoutWorkspace` already memoizes on
 * `params` — a drag re-asks this on every pointer move, and the difference is
 * the expensive half.
 */
const regionCache = new WeakMap<LidCutoutWindow, MultiPolygon>();

export function lidWindowRegion(window: LidCutoutWindow): MultiPolygon {
  const cached = regionCache.get(window);
  if (cached) return cached;
  const outer: MultiPolygon = [[roundedRectRing(window.spanW, window.spanD, window.cornerRadius)]];
  const region =
    window.keepouts.length === 0
      ? outer
      : polygonClipping.difference(
          outer,
          ...window.keepouts.map((k): MultiPolygon => [[keepoutRing(k)]])
        );
  regionCache.set(window, region);
  return region;
}

/** Whether `bounds` sits inside the window's plain extent, ignoring corners and bosses. */
function boundsInSpan(b: Bounds, window: LidCutoutWindow): boolean {
  return (
    b.minX >= -EPSILON &&
    b.minY >= -EPSILON &&
    b.maxX <= window.spanW + EPSILON &&
    b.maxY <= window.spanD + EPSILON
  );
}

/** Whether `bounds` clears every keep-out disc (box test — a fast accept only). */
function boundsClearOfKeepouts(b: Bounds, window: LidCutoutWindow): boolean {
  return window.keepouts.every(
    (k) =>
      b.maxX <= k.x - k.r + EPSILON ||
      b.minX >= k.x + k.r - EPSILON ||
      b.maxY <= k.y - k.r + EPSILON ||
      b.minY >= k.y + k.r - EPSILON
  );
}

/**
 * Whether one cutout instance lies entirely in the placeable region.
 *
 * The box is tried first and, when a plain rectangle with no rounding is in
 * play, is the whole answer. Only a shape near a rounded corner or a boss pays
 * for the clip.
 */
export function cutoutFitsInLidWindow(
  cutout: Cutout,
  window: LidCutoutWindow,
  meshAssets?: Readonly<Record<string, MeshAsset>>
): boolean {
  const bounds = getCutoutBounds(cutout);
  if (!boundsInSpan(bounds, window)) return false;
  // Inside the span, clear of every boss box, and no corner to round into: the
  // box has proven it without a clip.
  if (boundsClearOfKeepouts(bounds, window)) {
    const r = window.cornerRadius;
    if (r <= 0) return true;
    const inCornerBand =
      (bounds.minX < r || bounds.maxX > window.spanW - r) &&
      (bounds.minY < r || bounds.maxY > window.spanD - r);
    if (!inCornerBand) return true;
  }

  const rings = getCutoutOutline(cutout, meshAssets);
  // Too degenerate to outline (empty path, zero-sized box). The box verdict is
  // all there is, and it already said the extent is fine.
  if (!rings || rings.length === 0) return true;
  const subject: MultiPolygon = rings.map((ring) => [
    ring.map((p): [number, number] => [p.x, p.y]),
  ]);
  try {
    return (
      totalArea(polygonClipping.difference(subject, lidWindowRegion(window))) <=
      RESIDUAL_AREA_EPSILON
    );
  } catch {
    // polygon-clipping rejects degenerate or self-intersecting rings, which a
    // freeform pen path can be. Keep the box verdict rather than flagging a
    // shape the user cannot then fix.
    return true;
  }
}

/** Net covered area of a multipolygon (shoelace; holes come back negative). */
function totalArea(polygons: MultiPolygon): number {
  let area = 0;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let i = 0, n = ring.length; i < n; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[(i + 1) % n];
        area += (x1 * y2 - x2 * y1) / 2;
      }
    }
  }
  return area;
}

/** Shift bringing `[min,max]` inside `[0,extent]`; pin the min edge when oversized. */
function fitAxis(min: number, max: number, extent: number): number {
  if (max - min > extent) return -min;
  if (min < 0) return -min;
  if (max > extent) return extent - max;
  return 0;
}

function shift(b: Bounds, dx: number, dy: number): Bounds {
  return { minX: b.minX + dx, minY: b.minY + dy, maxX: b.maxX + dx, maxY: b.maxY + dy };
}

/**
 * Candidate translations that might bring a stray shape back in, nearest first
 * at the call site.
 *
 * Every candidate is geometrically motivated rather than sampled: the plain
 * span fit for a shape dragged off the edge, the four minimal axis moves that
 * clear each boss, and inward nudges for a shape poking out of a rounded
 * corner. A grid search over the window would be both slower and less
 * predictable, and "no candidate fits" is a perfectly good answer — the shape
 * stays flagged for the user to place by hand, exactly as a masked board does.
 */
function candidateOffsets(
  union: Bounds,
  window: LidCutoutWindow
): Array<{ dx: number; dy: number }> {
  const base = {
    dx: fitAxis(union.minX, union.maxX, window.spanW),
    dy: fitAxis(union.minY, union.maxY, window.spanD),
  };
  const candidates = [base];
  const fitted = shift(union, base.dx, base.dy);

  const clampBoth = (dx: number, dy: number): { dx: number; dy: number } => {
    const moved = shift(union, dx, dy);
    return {
      dx: dx + fitAxis(moved.minX, moved.maxX, window.spanW),
      dy: dy + fitAxis(moved.minY, moved.maxY, window.spanD),
    };
  };

  for (const k of window.keepouts) {
    // The minimal move on each axis that puts the footprint clear of this boss.
    const clears = [
      { dx: base.dx + (k.x - k.r - EPSILON - fitted.maxX), dy: base.dy },
      { dx: base.dx + (k.x + k.r + EPSILON - fitted.minX), dy: base.dy },
      { dx: base.dx, dy: base.dy + (k.y - k.r - EPSILON - fitted.maxY) },
      { dx: base.dx, dy: base.dy + (k.y + k.r + EPSILON - fitted.minY) },
    ];
    for (const c of clears) candidates.push(clampBoth(c.dx, c.dy));
  }

  const r = window.cornerRadius;
  if (r > 0) {
    // Push off a rounded corner: the shape has to come in by at most the
    // corner's sagitta on one axis or the other.
    for (const step of [r / 4, r / 2, r]) {
      for (const [sx, sy] of [
        [step, 0],
        [-step, 0],
        [0, step],
        [0, -step],
        [step, step],
        [-step, step],
        [step, -step],
        [-step, -step],
      ]) {
        candidates.push(clampBoth(base.dx + sx, base.dy + sy));
      }
    }
  }

  return candidates;
}

/**
 * Nearest translation bringing every instance inside the window and clear of
 * the bosses, or `null` when no candidate does.
 *
 * `null` is a real answer, not a failure: a shape wider than the gap between two
 * bosses has nowhere to go, and leaving it flagged for manual repair is what a
 * masked board already does in the same situation.
 */
export function lidWindowOffset(
  instances: readonly Cutout[],
  window: LidCutoutWindow,
  meshAssets?: Readonly<Record<string, MeshAsset>>
): { dx: number; dy: number } | null {
  if (instances.length === 0) return null;
  const union = instances.map(getCutoutBounds).reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.minX),
    minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX),
    maxY: Math.max(acc.maxY, b.maxY),
  }));

  let best: { dx: number; dy: number } | null = null;
  let bestDist = Infinity;
  for (const c of candidateOffsets(union, window)) {
    const dist = c.dx * c.dx + c.dy * c.dy;
    if (dist >= bestDist) continue;
    // `translateCutout`, not a spread: a path's outline is absolute points, so
    // bumping x/y alone moves the metadata and leaves the silhouette behind.
    const fits = instances.every((inst) =>
      cutoutFitsInLidWindow(translateCutout(inst, c.dx, c.dy), window, meshAssets)
    );
    if (!fits) continue;
    best = c;
    bestDist = dist;
  }
  return best;
}
