/**
 * Every edge of a custom-shape footprint, in the bin's centred mm frame.
 *
 * `maskPolygonEdges` (worker-side) answers a narrower question — which single
 * edge stands in for the front/back/left/right wall — because that is all a
 * cutout or a handle needs. Anything that has to treat the whole perimeter
 * uniformly needs every edge of every loop instead: the lid's keep-out ring
 * follows the outline all the way round, holes included.
 *
 * Kernel-free and in `shared/` so the main thread can reach it. The worker-side
 * module cannot serve that: `lidCompatibility` and the panel readout would have
 * to import across a feature boundary.
 *
 * ## Winding, and why holes need no special case
 *
 * `maskToPolygon` builds every edge with the filled cells on its LEFT, then
 * returns `[outerCCW, ...holesCW]`. So for EVERY loop, walking its edges in
 * order keeps material on the left, and the inward normal is the
 * left-perpendicular of the edge direction — `(-dy, dx)` — uniformly. An
 * offset that instead assumed "CCW means inward is left" would push a hole's
 * band the wrong way, into the void, which is the inner-loop trap #3482
 * describes. Reading the direction off the winding avoids having to know
 * which loop is which at all.
 */

import { MASK_CELL_SIZE, maskToPolygon, type CellMask } from '@/shared/utils/cellMask';

/** One straight run of a footprint's perimeter, in centred mm. */
export interface MaskEdgeMm {
  /** 0 is the outer boundary; anything else is a hole. */
  readonly loop: number;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  /** Unit vector along the edge. Axis-aligned, so one component is always 0. */
  readonly dirX: number;
  readonly dirY: number;
  /** Unit normal pointing INTO the material. Left-perpendicular of the direction. */
  readonly inX: number;
  readonly inY: number;
  readonly midX: number;
  readonly midY: number;
  readonly length: number;
}

/**
 * Walk every loop of `mask` and return its edges in centred mm.
 *
 * The mm frame matches `maskPolygonEdges.resolvePolygonSideGeometry` and
 * `railPlacementsForPolygon`: the mask spans the FULL grid-unit extent, so
 * these coordinates sit `CLEARANCE / 2` OUTSIDE the bin's real outer face.
 * Callers that need a face rather than the nominal outline have to say so —
 * see {@link insetAlongNormal}.
 *
 * Degenerate (zero-length) edges are dropped rather than returned with a NaN
 * direction; `collapse` in `maskToPolygon` should already have merged them.
 */
export function maskEdgesMm(
  mask: CellMask,
  gridUnitMm: number,
  gridUnitMmY: number
): readonly MaskEdgeMm[] {
  const loops = maskToPolygon(mask);
  const halfWidthMm = (mask.cols * MASK_CELL_SIZE * gridUnitMm) / 2;
  const halfDepthMm = (mask.rows * MASK_CELL_SIZE * gridUnitMmY) / 2;

  const out: MaskEdgeMm[] = [];
  loops.forEach((loop, loopIndex) => {
    const n = loop.length;
    for (let i = 0; i < n; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % n];
      const fromX = a.x * gridUnitMm - halfWidthMm;
      const fromY = a.y * gridUnitMmY - halfDepthMm;
      const toX = b.x * gridUnitMm - halfWidthMm;
      const toY = b.y * gridUnitMmY - halfDepthMm;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const length = Math.hypot(dx, dy);
      if (length <= 0) continue;
      const dirX = dx / length;
      const dirY = dy / length;
      out.push({
        loop: loopIndex,
        fromX,
        fromY,
        toX,
        toY,
        dirX,
        dirY,
        // Left-perpendicular: material is on the left of every edge, whichever
        // loop it belongs to. See the winding note in the module docstring.
        inX: -dirY,
        inY: dirX,
        midX: (fromX + toX) / 2,
        midY: (fromY + toY) / 2,
        length,
      });
    }
  });
  return out;
}

/** Move a point `mm` along an edge's inward normal. */
export function insetAlongNormal(
  edge: MaskEdgeMm,
  x: number,
  y: number,
  mm: number
): { readonly x: number; readonly y: number } {
  return { x: x + edge.inX * mm, y: y + edge.inY * mm };
}

/**
 * Rotation (degrees about +Z) that maps a feature authored along +X onto this
 * edge, matching the convention `railPlacementsForPolygon` and
 * `railPlacementsForRectangle` already use.
 *
 * Keyed on the OUTWARD normal, not the edge direction — the rectangle path
 * pairs `back` (outward +Y) with 0 and `front` (outward -Y) with 180, so an
 * edge running +X, whose material is above it, is a FRONT wall and takes 180.
 * Reading it off the direction instead inverts every wall, which is a
 * half-turn no bounding box notices.
 *
 * Null for a non-axis-aligned edge, which a mask outline should never produce.
 */
export function edgeRotationDeg(edge: MaskEdgeMm): number | null {
  if (edge.dirY === 0) return edge.dirX > 0 ? 180 : 0;
  if (edge.dirX === 0) return edge.dirY > 0 ? -90 : 90;
  return null;
}

/** Cardinal wall a polygon edge can stand in for. */
export type MaskSideKey = 'front' | 'back' | 'left' | 'right';

/**
 * Edge DIRECTION that faces each side, plus which way "outermost" runs.
 *
 * Material is on the left of every edge, so an edge running +X has its
 * material above it and is therefore the FRONT wall. Mirrors the worker's
 * `SIDE_CONFIG`, which this replaces as the single copy of the rule.
 */
const SIDE_MATCH: Record<
  MaskSideKey,
  {
    readonly dirX: -1 | 0 | 1;
    readonly dirY: -1 | 0 | 1;
    readonly perp: 'x' | 'y';
    readonly sign: -1 | 1;
  }
> = {
  front: { dirX: 1, dirY: 0, perp: 'y', sign: -1 },
  back: { dirX: -1, dirY: 0, perp: 'y', sign: 1 },
  left: { dirX: 0, dirY: -1, perp: 'x', sign: -1 },
  right: { dirX: 0, dirY: 1, perp: 'x', sign: 1 },
};

/**
 * The single edge of the OUTER boundary that stands in for `side`.
 *
 * A custom shape can face one direction with several edges — a U has two front
 * walls — so a feature placed "on the front" has to pick one, and every layer
 * that reasons about that feature has to pick the SAME one. Hence one
 * implementation, here, rather than one per consumer: the builder that cuts a
 * wall cutout, the rail pass that must not run over it, and the panel readout
 * that counts what survives all ask this question.
 *
 * Ranked by (1) most extreme perpendicular coordinate, (2) longest, then
 * (3) lowest midpoint along the edge axis. The third is not arbitrary — it
 * makes a symmetric shape (a U's two equal arms) resolve the same way every
 * time instead of by traversal order.
 *
 * Ranking in mm is equivalent to ranking in grid units: every candidate for a
 * given side runs along the same axis, so all three comparisons see one
 * positive scale factor and a constant offset, neither of which reorders them.
 */
export function outermostEdgeForSide(
  edges: readonly MaskEdgeMm[],
  side: MaskSideKey
): MaskEdgeMm | null {
  const cfg = SIDE_MATCH[side];
  let best: MaskEdgeMm | null = null;
  for (const e of edges) {
    // Outer boundary only. A hole's edge faces a direction too, but it is not a
    // wall anything places a cutout against.
    if (e.loop !== 0) continue;
    if (Math.sign(e.dirX) !== cfg.dirX || Math.sign(e.dirY) !== cfg.dirY) continue;
    if (!best) {
      best = e;
      continue;
    }
    const perp = cfg.perp === 'y' ? e.midY : e.midX;
    const bestPerp = cfg.perp === 'y' ? best.midY : best.midX;
    const extremeDelta = (perp - bestPerp) * cfg.sign;
    if (extremeDelta > 1e-9) {
      best = e;
    } else if (extremeDelta > -1e-9) {
      if (e.length > best.length + 1e-9) {
        best = e;
      } else if (e.length > best.length - 1e-9) {
        const axis = cfg.perp === 'y' ? e.midX : e.midY;
        const bestAxis = cfg.perp === 'y' ? best.midX : best.midY;
        if (axis < bestAxis) best = e;
      }
    }
  }
  return best;
}
