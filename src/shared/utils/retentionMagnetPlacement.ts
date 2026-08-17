/**
 * Where a magnetic lid's magnets sit — the one source both parts read.
 *
 * The bin and the lid MUST place their magnets at the same XY or they will not
 * mate, so a corner post and its answering boss are derived from this single
 * helper (the same discipline `baseplateMagnets.magnetPositionsForCell` uses for
 * stack magnets). Positions ignore per-part clearance so the bin's
 * slightly-larger body and the lid's slightly-smaller cavity stay coaxial, but
 * they DO follow the overhang-expanded footprint — the magnets hug the stacking
 * lip, and overhang moves the lip.
 *
 * Shared rather than worker-local because the lid cutout window has to draw
 * every boss as a keep-out, and the editor cannot import the worker. A second
 * copy of the edge-magnet spacing rule is exactly how the two sides of this
 * joint have drifted before.
 */

import type { OverhangExpansion } from '@/shared/utils/overhang';

/**
 * A single retention magnet's XY position plus how its bin-side pad anchors.
 * The lid side ignores `anchor` (its bosses just hang from the floor); the bin
 * side reads it to pick the pad shape.
 */
export interface RetentionMagnetPlacement {
  readonly x: number;
  readonly y: number;
  /**
   * - `corner`: the classic gusset welded into the two adjacent interior walls.
   * - `y`: mid-span on a front/back wall (constant Y); its pad welds into that
   *   single Y-normal wall and cantilevers inward along Y.
   * - `x`: mid-span on a left/right wall (constant X); pad welds into that
   *   single X-normal wall and cantilevers inward along X.
   */
  readonly anchor: 'corner' | 'x' | 'y';
}

/** Along-edge clearance (mm) added to the boss diameter when deciding how many
 *  edge magnets fit, so neighbouring bosses can't fuse on a tiny custom grid. */
const EDGE_MAGNET_BOSS_GAP = 4;

/**
 * Evenly-spaced offsets (centre coords, symmetric about 0) for `requested`
 * magnets between two endpoints `span` apart, reduced to as many as keep every
 * gap — including the two gaps to the endpoints (the corner magnets) — at least
 * `minSpacing`. Empty when none fit, so a short edge yields no edge magnets even
 * when the user asks for some.
 */
function edgeMagnetOffsets(span: number, requested: number, minSpacing: number): number[] {
  if (requested < 1 || span <= 0) return [];
  // k interior points split the span into k+1 gaps; keep each gap >= minSpacing.
  const maxFit = Math.floor(span / minSpacing) - 1;
  const k = Math.min(requested, maxFit);
  if (k < 1) return [];
  const offsets: number[] = [];
  for (let i = 1; i <= k; i++) {
    offsets.push(-span / 2 + (span * i) / (k + 1));
  }
  return offsets;
}

/**
 * Magnet XY positions, inset from the footprint corner by `inset`. Nominal (not
 * per-part) so the bin's slightly-larger body and the lid's slightly-smaller
 * cavity keep the magnets coaxial.
 *
 * `expansion` is the bin's overhang footprint growth/shift. The magnets hug the
 * stacking lip, and overhang moves the lip, so they have to move with it
 * — otherwise a one-sided overhang leaves the magnets `overhang`mm inboard of
 * the corner on the overhung side, stranding the bin's corner gusset away from
 * the interior wall it welds into. Omit it for the un-overhung footprint.
 *
 * Always the four corners; plus, when `edgeMagnets >= 1`, that many magnets
 * spread along each edge long enough to space them clear of the corners.
 * `bossRadius` sizes the min-spacing floor; it's unused when `edgeMagnets` is 0.
 */
export function retentionMagnetPositions(
  width: number,
  depth: number,
  gridUnitMmX: number,
  gridUnitMmY: number,
  inset: number,
  edgeMagnets = 0,
  bossRadius = 0,
  expansion?: OverhangExpansion | null
): ReadonlyArray<RetentionMagnetPlacement> {
  const cx = expansion?.offsetX ?? 0;
  const cy = expansion?.offsetY ?? 0;
  const halfW = (width * gridUnitMmX + (expansion?.addW ?? 0)) / 2;
  const halfD = (depth * gridUnitMmY + (expansion?.addD ?? 0)) / 2;
  const x = halfW - inset;
  const y = halfD - inset;
  // Local (footprint-centred) coords translated onto the overhang-shifted
  // centre, so every placement below reads as if the footprint were centred.
  const at = (
    lx: number,
    ly: number,
    anchor: RetentionMagnetPlacement['anchor']
  ): RetentionMagnetPlacement => ({ x: lx + cx, y: ly + cy, anchor });

  const placements: RetentionMagnetPlacement[] = [
    at(-x, -y, 'corner'),
    at(x, -y, 'corner'),
    at(-x, y, 'corner'),
    at(x, y, 'corner'),
  ];
  if (edgeMagnets >= 1) {
    // Space edge magnets at least one grid pitch apart (and never closer than
    // the boss diameter plus a small gap). `span` is the corner-magnet-to-
    // corner-magnet distance, so the same spacing check keeps them clear of the
    // corners too.
    const minGap = 2 * bossRadius + EDGE_MAGNET_BOSS_GAP;
    const minSpacingX = Math.max(gridUnitMmX, minGap);
    const minSpacingY = Math.max(gridUnitMmY, minGap);
    // Front/back walls (constant Y = ±y) run along X → distribute along X.
    for (const ox of edgeMagnetOffsets(2 * x, edgeMagnets, minSpacingX)) {
      placements.push(at(ox, -y, 'y'), at(ox, y, 'y'));
    }
    // Left/right walls (constant X = ±x) run along Y → distribute along Y.
    for (const oy of edgeMagnetOffsets(2 * y, edgeMagnets, minSpacingY)) {
      placements.push(at(-x, oy, 'x'), at(x, oy, 'x'));
    }
  }
  return placements;
}
