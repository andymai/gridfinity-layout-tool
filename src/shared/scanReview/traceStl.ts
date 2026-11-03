/**
 * Traced tools as one STL: each outline extruded to a thickness, its islands
 * open through it, as a body to subtract from a bin in CAD. Kept apart from
 * `traceExport` so three loads only when an STL is asked for.
 */

import { ShapeUtils, Vector2 } from 'three';
import { buildSTLBuffer } from '@/shared/generation/export';

interface Pt {
  readonly x: number;
  readonly y: number;
}

export interface ExtrudedTool {
  readonly outline: readonly Pt[];
  readonly islands: readonly (readonly Pt[])[];
}

type V3 = readonly [number, number, number];

/**
 * `ring` without the points the triangulation passes over: repeats, and
 * points dead in line with both neighbours, as a spur's tip is.
 */
function pruned(ring: readonly Pt[]): Vector2[] {
  let points = ring.map((p) => new Vector2(p.x, p.y));
  let changed = true;
  while (changed && points.length >= 3) {
    changed = false;
    const kept: Vector2[] = [];
    for (let i = 0; i < points.length; i++) {
      const prev = kept.length > 0 ? kept[kept.length - 1] : points[points.length - 1];
      const p = points[i];
      const next = points[(i + 1) % points.length];
      const inLine = (p.y - prev.y) * (next.x - p.x) - (p.x - prev.x) * (next.y - p.y) === 0;
      if (p.equals(next) || inLine) changed = true;
      else kept.push(p);
    }
    points = kept;
  }
  return points;
}

function signedArea(ring: readonly Vector2[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j].x - ring[i].x) * (ring[j].y + ring[i].y);
  }
  return sum / 2;
}

/**
 * `ring` split into simple loops at each point it passes through again, as a
 * traced outline does where it pinches at a pixel corner. Left whole, the
 * lobes meeting there would share an edge between four faces, which CAD
 * reads as a broken solid.
 */
function loops(ring: readonly Vector2[]): Vector2[][] {
  const out: Vector2[][] = [];
  const stack: Vector2[] = [];
  const at = new Map<string, number>();
  const key = (p: Vector2) => `${p.x},${p.y}`;
  for (const p of ring) {
    const first = at.get(key(p));
    if (first === undefined) {
      at.set(key(p), stack.length);
      stack.push(p);
      continue;
    }
    const loop = stack.splice(first + 1);
    for (const q of loop) at.delete(key(q));
    out.push([stack[first], ...loop]);
  }
  out.push(stack);
  return out.filter((loop) => loop.length >= 3 && signedArea(loop) !== 0);
}

/** How far a pinch point steps into each loop that meets there (mm): far below any print. */
const PINCH_STEP = 1e-3;

/**
 * `rings` with every point two of them share stepped a hair into each, so
 * loops split at a pinch no longer meet there.
 */
function parted(rings: readonly Vector2[][]): Vector2[][] {
  const key = (p: Vector2) => `${p.x},${p.y}`;
  const count = new Map<string, number>();
  for (const ring of rings) for (const p of ring) count.set(key(p), (count.get(key(p)) ?? 0) + 1);
  return rings.map((ring) => {
    const sense = Math.sign(signedArea(ring));
    return ring.map((p, i) => {
      if ((count.get(key(p)) ?? 0) < 2) return p;
      const a = p
        .clone()
        .sub(ring[(i - 1 + ring.length) % ring.length])
        .normalize();
      const b = ring[(i + 1) % ring.length].clone().sub(p).normalize();
      // The inside lies left of the way a counter-clockwise ring runs.
      let step = new Vector2(-(a.y + b.y), a.x + b.x);
      if (step.lengthSq() < 1e-18) step = new Vector2(-a.y, a.x);
      return p.clone().addScaledVector(step.normalize(), PINCH_STEP * sense);
    });
  });
}

/** A point inside the simple ring `loop`. */
function inside(loop: Vector2[]): Vector2 {
  const [[a, b, c]] = ShapeUtils.triangulateShape([...loop], []);
  return new Vector2(
    (loop[a].x + loop[b].x + loop[c].x) / 3,
    (loop[a].y + loop[b].y + loop[c].y) / 3
  );
}

function contains(ring: readonly Vector2[], p: Vector2): boolean {
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

/**
 * A tool's outline and islands as simple solids, each with the holes inside
 * it. A loop of the outline wound against it is a bay its pinch closed off,
 * so it is a hole too.
 */
function solids(tool: ExtrudedTool): { outline: Vector2[]; islands: Vector2[][] }[] {
  const outer = parted(loops(pruned(tool.outline)));
  if (outer.length === 0) return [];
  const sense = Math.sign(
    signedArea(outer.reduce((a, b) => (Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a)))
  );
  const parts = outer.filter((loop) => Math.sign(signedArea(loop)) === sense);
  const holes = [
    ...outer.filter((loop) => Math.sign(signedArea(loop)) !== sense),
    ...tool.islands.flatMap((ring) => {
      const pieces = parted(loops(pruned(ring)));
      const biggest = pieces.reduce<Vector2[] | null>(
        (a, b) => (!a || Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a),
        null
      );
      const own = biggest ? Math.sign(signedArea(biggest)) : 0;
      return pieces.filter((loop) => Math.sign(signedArea(loop)) === own);
    }),
  ];
  return parts.map((outline) => ({
    outline,
    islands: holes.filter((hole) => contains(outline, inside(hole))),
  }));
}

/** Faces flatter than this (twice their area, mm²) are left out, caps and edges alike. */
const FLAT = 1e-12;

const turn = (a: Vector2, b: Vector2, c: Vector2): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Each tool as a closed solid from z 0 to `thicknessMm`, Y up, millimetres. */
export function extrudedStl(tools: readonly ExtrudedTool[], thicknessMm: number): ArrayBuffer {
  const vertices: number[] = [];
  const normals: number[] = [];
  const triangle = (a: V3, b: V3, c: V3): void => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length < FLAT) return;
    vertices.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) normals.push(nx / length, ny / length, nz / length);
  };

  for (const { outline, islands } of tools.flatMap(solids)) {
    // Triangulation can drop a repeated closing point, so the faces index the
    // rings as it leaves them.
    const faces = ShapeUtils.triangulateShape(outline, islands);
    const points = [...outline, ...islands.flat()];
    const caps: [Vector2, Vector2, Vector2][] = [];
    for (const [i, j, k] of faces) {
      const t = turn(points[i], points[j], points[k]);
      if (t > FLAT) caps.push([points[i], points[j], points[k]]);
      else if (t < -FLAT) caps.push([points[i], points[k], points[j]]);
    }
    // The walls stand on the caps' own boundary, the edges no other cap face
    // runs back along, so they meet the caps edge for edge however the rings
    // touch or spur.
    const edge = (p: Vector2, q: Vector2) => `${p.x},${p.y}>${q.x},${q.y}`;
    const edges = new Set(caps.flatMap(([a, b, c]) => [edge(a, b), edge(b, c), edge(c, a)]));
    for (const [a, b, c] of caps) {
      triangle([a.x, a.y, thicknessMm], [b.x, b.y, thicknessMm], [c.x, c.y, thicknessMm]);
      triangle([a.x, a.y, 0], [c.x, c.y, 0], [b.x, b.y, 0]);
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, a],
      ] as const) {
        if (edges.has(edge(q, p))) continue;
        triangle([p.x, p.y, 0], [q.x, q.y, 0], [q.x, q.y, thicknessMm]);
        triangle([p.x, p.y, 0], [q.x, q.y, thicknessMm], [p.x, p.y, thicknessMm]);
      }
    }
  }
  return buildSTLBuffer(new Float32Array(vertices), new Float32Array(normals), 'traced-tools');
}
