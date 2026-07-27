/**
 * Align and distribute helpers for cutout selections.
 *
 * Both operate on the selection's own bounding box — aligning to the bin is a
 * separate action (`centerInBin`). Locked cutouts act as anchors: they never
 * move, but they still contribute to the bounds, so locking a reference hole
 * and aligning the rest to it works.
 *
 * Every move is expressed as a translation rather than an assignment, because
 * a cutout's `x`/`y` is its unrotated top-left while alignment is judged
 * against the rotated silhouette. Translating by a delta keeps the two in step
 * for rotated shapes, and lets path cutouts (whose points are absolute) carry
 * their geometry along.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { getRotatedBounds } from './geometryCore';

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'middleY' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

/** Distribute needs a fixed shape at each end plus something to place between them. */
const MIN_DISTRIBUTE_COUNT = 3;

/** Sub-micron moves are numerical noise — emitting them would dirty the design for nothing. */
const EPSILON = 1e-6;

function translate(cutout: Cutout, dx: number, dy: number): Partial<Cutout> {
  const moved = { x: cutout.x + dx, y: cutout.y + dy };
  if (cutout.shape === 'path' && cutout.path) {
    return {
      ...moved,
      path: cutout.path.map((pt) => ({ ...pt, x: pt.x + dx, y: pt.y + dy })),
    };
  }
  return moved;
}

/** Bounds across every selected cutout, locked ones included (they anchor). */
function selectionBounds(cutouts: readonly Cutout[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cutout of cutouts) {
    const b = getRotatedBounds(cutout);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY };
}

/** Signed distance to move `cutout` so its rotated box satisfies `mode`. */
function alignDelta(
  cutout: Cutout,
  mode: AlignMode,
  bounds: ReturnType<typeof selectionBounds>
): { dx: number; dy: number } {
  const b = getRotatedBounds(cutout);
  switch (mode) {
    case 'left':
      return { dx: bounds.minX - b.minX, dy: 0 };
    case 'right':
      return { dx: bounds.maxX - b.maxX, dy: 0 };
    case 'centerX':
      return { dx: (bounds.minX + bounds.maxX) / 2 - (b.minX + b.maxX) / 2, dy: 0 };
    case 'top':
      return { dx: 0, dy: bounds.minY - b.minY };
    case 'bottom':
      return { dx: 0, dy: bounds.maxY - b.maxY };
    case 'middleY':
      return { dx: 0, dy: (bounds.minY + bounds.maxY) / 2 - (b.minY + b.maxY) / 2 };
  }
}

/**
 * Align every unlocked cutout in the selection to the selection's bounding box.
 *
 * A single cutout has nothing to align against (its own bounds are the
 * selection's), so this is a no-op below two.
 */
export function alignSelection(
  cutouts: readonly Cutout[],
  mode: AlignMode
): ReadonlyMap<string, Partial<Cutout>> {
  const updates = new Map<string, Partial<Cutout>>();
  if (cutouts.length < 2) return updates;

  const bounds = selectionBounds(cutouts);
  for (const cutout of cutouts) {
    if (cutout.locked) continue;
    const { dx, dy } = alignDelta(cutout, mode, bounds);
    if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) continue;
    updates.set(cutout.id, translate(cutout, dx, dy));
  }
  return updates;
}

/**
 * Space the selection evenly along one axis.
 *
 * Centres are evenly spaced (not gaps), which is what a drill-bit index or any
 * regular-pitch array wants: holes of different diameters still land on a
 * constant pitch. The outermost two define the span and never move — so with
 * exactly two cutouts there is nothing to place, and this is a no-op.
 *
 * Distribution runs per anchor-to-anchor segment. The two extremes anchor, and
 * so does every locked cutout in between — spacing each span independently, so
 * that locking a reference hole partway along divides the run into two evenly
 * spaced halves rather than shifting everything as if the anchor had moved.
 */
export function distributeSelection(
  cutouts: readonly Cutout[],
  axis: DistributeAxis
): ReadonlyMap<string, Partial<Cutout>> {
  const updates = new Map<string, Partial<Cutout>>();
  if (cutouts.length < MIN_DISTRIBUTE_COUNT) return updates;

  const horizontal = axis === 'horizontal';
  const centerOf = (cutout: Cutout): number => {
    const b = getRotatedBounds(cutout);
    return horizontal ? (b.minX + b.maxX) / 2 : (b.minY + b.maxY) / 2;
  };

  const ordered = [...cutouts].sort((a, b) => centerOf(a) - centerOf(b));

  // The extremes plus any locked cutout between them. Everything strictly
  // between two consecutive anchors is unlocked by construction.
  const anchors = [0];
  for (let i = 1; i < ordered.length - 1; i++) {
    if (ordered[i].locked) anchors.push(i);
  }
  anchors.push(ordered.length - 1);

  for (let a = 0; a < anchors.length - 1; a++) {
    const startIdx = anchors[a];
    const endIdx = anchors[a + 1];
    const gap = endIdx - startIdx;
    if (gap < 2) continue; // adjacent anchors — nothing to place between them

    const startCenter = centerOf(ordered[startIdx]);
    const step = (centerOf(ordered[endIdx]) - startCenter) / gap;

    for (let k = 1; k < gap; k++) {
      const cutout = ordered[startIdx + k];
      const delta = startCenter + step * k - centerOf(cutout);
      if (Math.abs(delta) < EPSILON) continue;
      updates.set(cutout.id, translate(cutout, horizontal ? delta : 0, horizontal ? 0 : delta));
    }
  }
  return updates;
}
