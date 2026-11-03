import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import { mirrorSymmetry } from '@/shared/scanTrace/symmetry';
import type { Pt } from './runs';

/** A pocket's outline and the islands standing in it, as dense closed rings. */
export interface Region {
  readonly outline: readonly Pt[];
  readonly holes: readonly (readonly Pt[])[];
}

export type MirrorAxisKind = 'detected' | 'vertical' | 'horizontal';

/**
 * Which half becomes both: the one on the low side of the axis (smaller x
 * across an upright axis, smaller y across a level one), the high side, or
 * the two averaged.
 */
export type MirrorKeep = 'low' | 'high' | 'average';

export interface MirrorAxis {
  readonly origin: Pt;
  /** The axis's direction, in radians. */
  readonly angle: number;
}

/**
 * How far past the axis, in mm, the kept half reaches. Its mirror image then
 * overlaps it instead of meeting it along the axis, an edge the two would
 * share only to rounding, which the boolean union can fail on.
 */
const AXIS_OVERLAP_MM = 1e-3;

/** Spacing, in mm, the outline is sampled at to average it with its mirror. */
const AVERAGE_STEP_MM = 0.25;
const MAX_AVERAGE_POINTS = 4000;

/** The axis is nearer upright than level, so its sides read as left and right. */
export function axisIsUpright(axis: MirrorAxis): boolean {
  return Math.abs(Math.sin(axis.angle)) > Math.abs(Math.cos(axis.angle));
}

function bounds(ring: readonly Pt[]) {
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function mirrorAxis(outline: readonly Pt[], kind: MirrorAxisKind): MirrorAxis {
  if (kind === 'detected') {
    const { angle, center } = mirrorSymmetry(outline);
    return { origin: center, angle };
  }
  const b = bounds(outline);
  const origin = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  return { origin, angle: kind === 'vertical' ? Math.PI / 2 : 0 };
}

function reflect(p: Pt, axis: MirrorAxis): Pt {
  const dx = p.x - axis.origin.x;
  const dy = p.y - axis.origin.y;
  const cos2 = Math.cos(2 * axis.angle);
  const sin2 = Math.sin(2 * axis.angle);
  return { x: axis.origin.x + dx * cos2 + dy * sin2, y: axis.origin.y + dx * sin2 - dy * cos2 };
}

/** The axis's normal, turned to point along +x across an upright axis and +y across a level one. */
function normal(axis: MirrorAxis): Pt {
  const n = { x: -Math.sin(axis.angle), y: Math.cos(axis.angle) };
  const flip = axisIsUpright(axis) ? n.x < 0 : n.y < 0;
  return flip ? { x: -n.x, y: -n.y } : n;
}

const toRing = (ring: readonly Pt[]): Ring => ring.map((p) => [p.x, p.y] as [number, number]);
const fromRing = (ring: Ring): Pt[] => {
  const points = ring.map(([x, y]) => ({ x, y }));
  const first = points[0];
  const last = points.at(-1);
  // polygon-clipping closes each ring by repeating its first point.
  if (last && points.length > 1 && last.x === first.x && last.y === first.y) points.pop();
  return points;
};

function ringArea(ring: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** The kept half of `region`, joined to its mirror image. */
function keepHalf(region: Region, axis: MirrorAxis, keep: 'low' | 'high'): Region | null {
  const b = bounds(region.outline);
  const reach = 10 * Math.hypot(b.maxX - b.minX, b.maxY - b.minY) + 10;
  const dir = { x: Math.cos(axis.angle), y: Math.sin(axis.angle) };
  const n = normal(axis);
  const side = keep === 'low' ? -1 : 1;
  const o = {
    x: axis.origin.x - n.x * side * AXIS_OVERLAP_MM,
    y: axis.origin.y - n.y * side * AXIS_OVERLAP_MM,
  };
  const half: Ring = [
    [o.x - dir.x * reach, o.y - dir.y * reach],
    [o.x + dir.x * reach, o.y + dir.y * reach],
    [o.x + dir.x * reach + n.x * reach * side, o.y + dir.y * reach + n.y * reach * side],
    [o.x - dir.x * reach + n.x * reach * side, o.y - dir.y * reach + n.y * reach * side],
  ];
  const shape: Polygon = [toRing(region.outline), ...region.holes.map(toRing)];
  let joined: MultiPolygon;
  try {
    const kept = polygonClipping.intersection(shape, [half]);
    const mirrored: MultiPolygon = kept.map((poly) =>
      poly.map((ring) =>
        ring.map(([x, y]) => {
          const r = reflect({ x, y }, axis);
          return [r.x, r.y] as [number, number];
        })
      )
    );
    joined = polygonClipping.union(kept, mirrored);
  } catch {
    return null;
  }
  const largest = joined
    .map((poly) => poly.map(fromRing))
    .reduce<Pt[][] | null>(
      (best, poly) => (!best || ringArea(poly[0]) > ringArea(best[0]) ? poly : best),
      null
    );
  if (!largest || largest[0].length < 3) return null;
  return { outline: largest[0], holes: largest.slice(1).filter((h) => h.length >= 3) };
}

function resample(ring: readonly Pt[]): Pt[] {
  let perimeter = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const count = Math.min(
    MAX_AVERAGE_POINTS,
    Math.max(ring.length, Math.ceil(perimeter / AVERAGE_STEP_MM))
  );
  const step = perimeter / count;
  const out: Pt[] = [];
  let edge = 0;
  let along = 0;
  for (let k = 0; k < count; k++) {
    const target = k * step;
    for (;;) {
      const a = ring[edge % ring.length];
      const b = ring[(edge + 1) % ring.length];
      const span = Math.hypot(b.x - a.x, b.y - a.y);
      if (along + span >= target || edge >= ring.length) {
        const t = span > 0 ? (target - along) / span : 0;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        break;
      }
      along += span;
      edge++;
    }
  }
  return out;
}

function closestOn(p: Pt, ring: readonly Pt[]): Pt {
  let best = ring[0];
  let bestD = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    const q = { x: a.x + dx * t, y: a.y + dy * t };
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/**
 * `region` made mirror-symmetric about `axis`. Keeping a side keeps its
 * islands and mirrors them too; averaging evens out the outline and leaves
 * the islands where they are. Null when the axis misses the pocket.
 */
export function mirrorRegion(region: Region, axis: MirrorAxis, keep: MirrorKeep): Region | null {
  if (keep !== 'average') return keepHalf(region, axis, keep);
  const sampled = resample(region.outline);
  const reflected = sampled.map((p) => reflect(p, axis));
  const outline = sampled.map((p) => {
    const m = closestOn(p, reflected);
    return { x: (p.x + m.x) / 2, y: (p.y + m.y) / 2 };
  });
  // Pairing each point with its nearest mirror point evens the outline out
  // but leaves it only nearly symmetric; one half of it, mirrored, is exact.
  const even = keepHalf({ outline, holes: [] }, axis, 'low');
  return { outline: even?.outline ?? outline, holes: region.holes };
}
