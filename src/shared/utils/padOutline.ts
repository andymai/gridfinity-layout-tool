/**
 * Compose per-side baseplate padding into a rectilinear drawer outline.
 *
 * Padding grows the baseplate outward from the grid on each side. For a plain
 * rectangle the baseplate resolver just adds the paddings to the total extent
 * (`buildFullParams`); for a corner-cut shape it re-inscribes the cuts on the
 * padded rectangle. A freeform *rectilinear* outline (painted cells, a traced
 * footprint) has no parametric form, so its padding is applied edge-by-edge:
 * every axis-aligned boundary edge translates outward along its normal by that
 * side's padding — including the interior edges of a concave notch, which face
 * outward toward the drawer wall and so must move too.
 *
 * The result is emitted in the same plate-local frame the resolver's other
 * paths use: origin at the padded plate's bottom-left, spanning
 * `[0, totalW] × [0, totalD]`, with the original grid region offset by
 * `(paddingLeft, paddingFront)`.
 *
 * Returns `null` when the outline isn't rectilinear (arcs or diagonal edges,
 * where per-side padding is undefined) or when the paddings are large enough
 * to collapse or cross an edge — the caller then leaves the shape unpadded.
 */

import type { DrawerOutline, OutlineVertex } from '@/core/types';
import { BULGE_EPS, polylineSignedArea, type OutlinePoint } from './drawerOutlineGeometry';
import { isSelfIntersecting } from './drawerOutline';

export interface SidePadding {
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
}

/** Edges shorter than this (mm) after offsetting are treated as collapsed. */
const MIN_EDGE_MM = 1e-3;

/** An edge is axis-aligned when its off-axis span is within this (mm). */
const AXIS_EPS = 1e-6;

type Orientation = 'horizontal' | 'vertical';

/**
 * True when every edge is axis-aligned and no vertex carries an arc bulge —
 * the only shapes for which per-side padding is well defined.
 */
export function isRectilinearOutline(outline: DrawerOutline): boolean {
  const v = outline.vertices;
  const n = v.length;
  for (let i = 0; i < n; i++) {
    if (Math.abs(v[i].bulge ?? 0) >= BULGE_EPS) return false;
    const a = v[i];
    const b = v[(i + 1) % n];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    // Exactly one axis must vary: a diagonal (both) or a zero-length edge
    // (neither) makes the loop non-rectilinear / degenerate.
    if (dx > AXIS_EPS === dy > AXIS_EPS) return false;
  }
  return true;
}

/**
 * Per-side padding (mm) composed into a rectilinear outline. See the module
 * doc. `null` when the outline isn't rectilinear or the paddings degenerate
 * the loop.
 */
export function padRectilinearOutline(
  outline: DrawerOutline,
  padding: SidePadding
): DrawerOutline | null {
  const { left, right, front, back } = padding;
  if (left === 0 && right === 0 && front === 0 && back === 0) return outline;
  if (left < 0 || right < 0 || front < 0 || back < 0) return null;
  if (!isRectilinearOutline(outline)) return null;

  const src = outline.vertices;
  const n = src.length;

  // Each edge is horizontal or vertical; record its orientation and the
  // outward-normal offset applied to its constant coordinate. On a CCW loop
  // the interior lies left of travel, so the outward normal is travel rotated
  // clockwise: +y edge → +x (right), −y → −x (left), +x → −y (front), −x → +y.
  const edges = src.map((a, i) => {
    const b = src[(i + 1) % n];
    if (Math.abs(b.x - a.x) <= AXIS_EPS) {
      const orientation: Orientation = 'vertical';
      const offset = b.y > a.y ? right : -left;
      return { orientation, offset };
    }
    const orientation: Orientation = 'horizontal';
    const offset = b.x > a.x ? -front : back;
    return { orientation, offset };
  });

  // Each vertex joins its incoming and outgoing edges — one vertical, one
  // horizontal in a rectilinear loop. Its new x rides the adjacent vertical
  // edge's offset, its new y the adjacent horizontal edge's.
  const out: OutlineVertex[] = src.map((v, i) => {
    const incoming = edges[(i - 1 + n) % n];
    const outgoing = edges[i];
    const vertical = incoming.orientation === 'vertical' ? incoming : outgoing;
    const horizontal = incoming.orientation === 'horizontal' ? incoming : outgoing;
    // Consecutive collinear edges (both same orientation) can't set one axis;
    // that axis keeps its original coordinate.
    const dx = vertical.orientation === 'vertical' ? vertical.offset : 0;
    const dy = horizontal.orientation === 'horizontal' ? horizontal.offset : 0;
    return { x: v.x + dx + left, y: v.y + dy + front };
  });

  if (!isSimpleRectilinearLoop(out, src)) return null;
  return { vertices: out };
}

/**
 * Guards against paddings that degenerate the loop: every offset edge must
 * keep a positive length and its original travel direction, the loop must
 * stay CCW (positive area), and no two edges may cross — a slot or finger
 * whose opposing walls meet under deep padding fails the intersection test.
 */
function isSimpleRectilinearLoop(
  padded: readonly OutlinePoint[],
  original: readonly OutlineVertex[]
): boolean {
  const n = padded.length;
  for (let i = 0; i < n; i++) {
    const a = padded[i];
    const b = padded[(i + 1) % n];
    const oa = original[i];
    const ob = original[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.hypot(dx, dy) < MIN_EDGE_MM) return false;
    // Sign of motion along the varying axis must survive the offset.
    if (Math.abs(ob.x - oa.x) > AXIS_EPS && Math.sign(dx) !== Math.sign(ob.x - oa.x)) return false;
    if (Math.abs(ob.y - oa.y) > AXIS_EPS && Math.sign(dy) !== Math.sign(ob.y - oa.y)) return false;
  }
  return polylineSignedArea(padded) > 0 && !isSelfIntersecting(padded);
}
