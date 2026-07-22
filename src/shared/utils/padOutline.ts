/**
 * Compose per-side baseplate padding into any drawer outline.
 *
 * Padding grows the baseplate outward from the grid on each side. A plain
 * rectangle just adds the paddings to the total extent (`buildFullParams`); a
 * corner-cut shape re-inscribes its cuts on the padded rectangle. Every other
 * authoring surface (painted cells, traced footprints, freehand pen shapes with
 * arcs and diagonals) has no parametric form, so its padding is applied
 * edge-by-edge: each boundary edge translates outward along its normal by that
 * side's padding — including the interior edges of a concave notch, which face
 * outward toward the drawer wall. Arcs are flattened first so one algorithm
 * covers them all; the offset amount for an edge is the padding rectangle's
 * support in the edge's outward-normal direction, which reduces exactly to the
 * per-side value for an axis-aligned edge and interpolates for a diagonal.
 *
 * The result is emitted in the same plate-local frame the resolver's other
 * paths use: origin at the padded plate's bottom-left, spanning
 * `[0, totalW] × [0, totalD]`, with the original grid region offset by
 * `(paddingLeft, paddingFront)`.
 *
 * Returns `null` when a padding is negative, an edge is degenerate, or the
 * paddings are large enough to fold the loop (a collapsed notch/slot or a
 * mitre spike self-intersects) — the caller then leaves the shape unpadded.
 */

import type { DrawerOutline, OutlineVertex } from '@/core/types';
import { flattenOutline, polylineSignedArea, type OutlinePoint } from './drawerOutlineGeometry';
import { isSelfIntersecting } from './drawerOutline';

export interface SidePadding {
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
}

/** Consecutive points closer than this (mm) are merged before offsetting. */
const COINCIDENT_EPS = 1e-3;

/** Offset lines with a cross product below this are treated as parallel. */
const PARALLEL_EPS = 1e-9;

interface OffsetLine {
  readonly px: number;
  readonly py: number;
  readonly dx: number;
  readonly dy: number;
}

/** Drop consecutive coincident points (and the wrap-around duplicate). */
function dedupe(pts: readonly OutlinePoint[]): OutlinePoint[] {
  const out: OutlinePoint[] = [];
  for (const p of pts) {
    const last = out.at(-1);
    if (last === undefined || Math.hypot(last.x - p.x, last.y - p.y) >= COINCIDENT_EPS) {
      out.push({ x: p.x, y: p.y });
    }
  }
  while (
    out.length > 1 &&
    Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < COINCIDENT_EPS
  ) {
    out.pop();
  }
  return out;
}

/** Intersection of two offset lines, or null when they are parallel. */
function intersect(a: OffsetLine, b: OffsetLine): OutlinePoint | null {
  const denom = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(denom) < PARALLEL_EPS) return null;
  const s = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / denom;
  return { x: a.px + s * a.dx, y: a.py + s * a.dy };
}

/**
 * Per-side padding (mm) composed into an arbitrary outline. See the module
 * doc. `null` when the paddings degenerate or fold the loop.
 */
export function padOutline(outline: DrawerOutline, padding: SidePadding): DrawerOutline | null {
  const { left, right, front, back } = padding;
  if (left === 0 && right === 0 && front === 0 && back === 0) return outline;
  if (!(left >= 0 && right >= 0 && front >= 0 && back >= 0)) return null;

  const pts = dedupe(flattenOutline(outline));
  const n = pts.length;
  if (n < 3) return null;

  // Offset each edge outward along its normal as an infinite line. On a CCW
  // loop the interior is left of travel, so the outward normal is travel
  // rotated clockwise: (dx,dy) → (dy,−dx). The offset distance is the support
  // of the padding rectangle [−left, right] × [−front, back] in that normal.
  const lines: OffsetLine[] = new Array<OffsetLine>(n);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < COINCIDENT_EPS) return null;
    dx /= len;
    dy /= len;
    const nx = dy;
    const ny = -dx;
    const d = (nx >= 0 ? nx * right : -nx * left) + (ny >= 0 ? ny * back : -ny * front);
    lines[i] = { px: a.x + nx * d, py: a.y + ny * d, dx, dy };
  }

  // Each padded vertex is where the offset lines of its two edges meet. When
  // those edges are parallel and codirectional (a collinear vertex), the lines
  // coincide, so the vertex sits at the outgoing line's start (the original
  // point already offset by that edge). Anti-parallel edges fold back — reject.
  const out: OutlineVertex[] = new Array<OutlineVertex>(n);
  for (let i = 0; i < n; i++) {
    const incoming = lines[(i - 1 + n) % n];
    const outgoing = lines[i];
    let p = intersect(incoming, outgoing);
    if (p === null) {
      if (incoming.dx * outgoing.dx + incoming.dy * outgoing.dy <= 0) return null;
      p = { x: outgoing.px, y: outgoing.py };
    }
    out[i] = { x: p.x + left, y: p.y + front };
  }

  if (polylineSignedArea(out) <= 0 || isSelfIntersecting(out)) return null;
  return { vertices: out };
}
