/**
 * Placement for underside mount magnets: blind holes opening on the plate's
 * bottom face at the "+" junctions where four pockets meet.
 *
 * Kernel-free so the BREP build, the direct-mesh draft and the panel's fit
 * warning all read the same answer.
 *
 * Why a junction holds a hole at all: a pocket's nearest point to its cell
 * corner is its rounded corner, whose arc centre stays fixed at `(r, r)` from
 * the corner while the profile insets (the sections are `cell - 2i` with radius
 * `r - i`). The "+" arms between pockets are only `2i` wide, but a circle at the
 * junction sees the arms tangentially and the corners at
 * `(i + r')·√2 - r'`, `r' = max(r - i, 0)`. Inset shrinks toward the top face,
 * so the binding depth is the hole's ceiling.
 */

import type { MountMagnetParams } from '@/core/types/baseplate';
import { MOUNT_MAGNETS_PER_PIECE_DEFAULT } from '@/core/baseplateDefaults';
import { MAGNET_CHAMFER_MM } from '@/shared/generation/magnetHoleStyle';
import {
  COPLANAR_MARGIN,
  CORNER_RADIUS,
  FOOT_INSET_BOT,
  PLATE_PROFILE_HEIGHT,
  POCKET_INSET_BOT,
  SOCKET_HEIGHT,
  pocketCornerRadius,
  pocketProfileFor,
} from './generatorConstants';
import { forEachCell } from './cellDecomposition';
import type { CellInfo, ForEachCellOptions } from './cellDecomposition';
import { resolvePitch, type GridUnitInput } from './gridPitch';

/**
 * Plastic kept between a mount-magnet hole and the nearest pocket corner. The
 * thin spot is only the four diagonal points of the hole's ceiling rim.
 */
export const MOUNT_MAGNET_MIN_WALL_MM = 0.2;

/**
 * Inset of the pocket profile at `depthBelowTop`. Below the profile a cell is
 * either floored (no pocket) or through-cut at {@link POCKET_INSET_BOT}; the
 * caller handles that band.
 */
function pocketInsetAt(depthBelowTop: number, profileHeight: number): number {
  const profile = pocketProfileFor(profileHeight);
  if (depthBelowTop <= 0) return 0;
  for (let k = 1; k < profile.length; k++) {
    const [d1, i1] = profile[k];
    if (depthBelowTop <= d1) {
      const [d0, i0] = profile[k - 1];
      const span = d1 - d0;
      return span <= 0 ? i1 : i0 + ((depthBelowTop - d0) / span) * (i1 - i0);
    }
  }
  return POCKET_INSET_BOT;
}

function cornerDistance(inset: number, cornerRadius: number): number {
  const r = Math.max(cornerRadius - inset, 0);
  return (inset + r) * Math.SQRT2 - r;
}

/**
 * Horizontal distance from a junction to the nearest cut surface at a depth
 * below the plate's top face.
 *
 * `cornerRelief` marks a junction beside a cell whose lightweight floor relief
 * is a plain rectangle (a cell too small for a magnet pad), whose square
 * corner at `FOOT_INSET_BOT` reaches closer than the pocket does over the
 * relief's depth band. Full cells keep a pad in each corner, so their relief
 * never comes near a junction.
 */
export function junctionClearanceMm(
  depthBelowTop: number,
  profileHeight: number,
  cornerRadius: number = CORNER_RADIUS,
  cornerRelief: boolean = false
): number {
  const pocket = cornerDistance(
    depthBelowTop <= profileHeight ? pocketInsetAt(depthBelowTop, profileHeight) : POCKET_INSET_BOT,
    cornerRadius
  );
  const reliefTop = profileHeight + (SOCKET_HEIGHT - PLATE_PROFILE_HEIGHT) - COPLANAR_MARGIN;
  if (!cornerRelief || depthBelowTop < reliefTop) return pocket;
  return Math.min(pocket, FOOT_INSET_BOT * Math.SQRT2);
}

/** Whether a hole of this size fits a junction of full cells on a plate this tall. */
export function mountMagnetFits(
  diameter: number,
  depth: number,
  totalHeight: number,
  profileHeight: number,
  cornerRadius: number = CORNER_RADIUS,
  cornerRelief: boolean = false
): boolean {
  if (depth >= totalHeight) return false;
  const clearance = junctionClearanceMm(
    totalHeight - depth,
    profileHeight,
    cornerRadius,
    cornerRelief
  );
  return clearance - diameter / 2 >= MOUNT_MAGNET_MIN_WALL_MM - 1e-9;
}

/**
 * Deepest hole of this diameter a junction of full cells holds, floored to
 * 0.1mm, or 0 when none does. Clearance only shrinks as the ceiling rises, so
 * the first depth that fits, walking down, is the deepest.
 */
export function maxMountMagnetDepthMm(
  diameter: number,
  totalHeight: number,
  profileHeight: number
): number {
  for (let tenths = Math.floor(totalHeight * 10) - 1; tenths > 0; tenths--) {
    if (mountMagnetFits(diameter, tenths / 10, totalHeight, profileHeight)) return tenths / 10;
  }
  return 0;
}

/** Straight bore a chamfered hole must keep above its lead-in. */
const MOUNT_MAGNET_MIN_BORE_MM = 1;

/**
 * Whether the 45° lead-in fits at a junction: the mouth widens by
 * `MAGNET_CHAMFER_MM` at the bottom face, where the pockets are at their
 * narrowest, so the wall is checked across the whole chamfer band rather than
 * at one height. The bore must also outlast the chamfer, or the hole is all
 * lead-in and nothing grips the magnet.
 */
export function mountMagnetChamferFits(
  diameter: number,
  depth: number,
  totalHeight: number,
  profileHeight: number,
  cornerRadius: number = CORNER_RADIUS,
  cornerRelief: boolean = false
): boolean {
  if (depth <= MAGNET_CHAMFER_MM + MOUNT_MAGNET_MIN_BORE_MM) return false;
  const steps = 8;
  for (let k = 0; k <= steps; k++) {
    const z = (k / steps) * MAGNET_CHAMFER_MM;
    const mouthRadius = diameter / 2 + MAGNET_CHAMFER_MM - z;
    const clearance = junctionClearanceMm(
      totalHeight - z,
      profileHeight,
      cornerRadius,
      cornerRelief
    );
    if (clearance - mouthRadius < MOUNT_MAGNET_MIN_WALL_MM - 1e-9) return false;
  }
  return true;
}

export interface MountMagnetHole {
  readonly x: number;
  readonly y: number;
  readonly chamfer: boolean;
}

interface Junction {
  readonly x: number;
  readonly y: number;
  readonly cornerRadius: number;
  readonly cornerRelief: boolean;
}

const KEY_PRECISION = 1000;

/**
 * Interior junctions of a piece: points that are a corner of exactly four
 * kept cells, each of which leaves the hole room. A seam or plate edge is a
 * corner of two cells at most, so it never qualifies.
 */
export function mountMagnetJunctions(
  gridW: number,
  gridD: number,
  params: Pick<MountMagnetParams, 'diameter' | 'depth'>,
  totalHeight: number,
  profileHeight: number,
  cellOpts: ForEachCellOptions & { gridUnitMm: GridUnitInput },
  cellFilter?: (cell: CellInfo) => boolean,
  cellCornerRelief?: (cell: CellInfo) => boolean
): Junction[] {
  const { x: pitchX, y: pitchY } = resolvePitch(cellOpts.gridUnitMm);
  const corners = new Map<
    string,
    { x: number; y: number; count: number; radius: number; relief: boolean }
  >();
  forEachCell(
    gridW,
    gridD,
    (cell) => {
      if (cellFilter !== undefined && !cellFilter(cell)) return;
      const w = cell.widthUnits * pitchX;
      const d = cell.depthUnits * pitchY;
      const radius = pocketCornerRadius(w, d);
      const relief = cellCornerRelief?.(cell) === true;
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const x = cell.centerX + (sx * w) / 2;
          const y = cell.centerY + (sy * d) / 2;
          const key = `${Math.round(x * KEY_PRECISION)},${Math.round(y * KEY_PRECISION)}`;
          const entry = corners.get(key);
          if (entry === undefined) {
            corners.set(key, { x, y, count: 1, radius, relief });
          } else {
            entry.count++;
            entry.radius = Math.min(entry.radius, radius);
            entry.relief ||= relief;
          }
        }
      }
    },
    cellOpts
  );

  const out: Junction[] = [];
  for (const c of corners.values()) {
    if (c.count !== 4) continue;
    if (
      !mountMagnetFits(
        params.diameter,
        params.depth,
        totalHeight,
        profileHeight,
        c.radius,
        c.relief
      )
    ) {
      continue;
    }
    out.push({ x: c.x, y: c.y, cornerRadius: c.radius, cornerRelief: c.relief });
  }
  out.sort((a, b) => a.y - b.y || a.x - b.x);
  return out;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Whether `count` can be made exactly from a subset of these unit sizes.
 * Units are 1, 2 or 4 junctions, so it is enough to try each number of fours
 * and take as many twos as fit.
 */
function sumReachable(count: number, sizes: readonly number[]): boolean {
  let ones = 0;
  let twos = 0;
  let fours = 0;
  for (const size of sizes) {
    if (size === 1) ones++;
    else if (size === 2) twos++;
    else fours++;
  }
  for (let f = Math.min(fours, Math.floor(count / 4)); f >= 0; f--) {
    const rest = count - 4 * f;
    if (rest - 2 * Math.min(twos, Math.floor(rest / 2)) <= ones) return true;
  }
  return false;
}

/**
 * Groups of junctions that map onto each other under the piece's two mirror
 * axes: a corner set of four, an on-axis pair, or the centre alone. Only
 * complete groups are kept. With `splitQuads`, each group of four becomes its
 * two diagonal pairs, which stay symmetric through the centre.
 */
function mirrorGroups(points: readonly Point[], splitQuads: boolean): number[][] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const sumX = minX + maxX;
  const sumY = minY + maxY;
  const key = (x: number, y: number): string =>
    `${Math.round(x * KEY_PRECISION)},${Math.round(y * KEY_PRECISION)}`;
  const index = new Map<string, number>();
  points.forEach(({ x, y }, i) => index.set(key(x, y), i));

  const seen = new Set<number>();
  const groups: number[][] = [];
  points.forEach(({ x, y }, i) => {
    if (seen.has(i)) return;
    // Self, x-mirror, y-mirror, diagonal: the order the split below relies on.
    const images = [key(x, y), key(sumX - x, y), key(x, sumY - y), key(sumX - x, sumY - y)];
    const found = images.map((k) => index.get(k));
    for (const j of found) if (j !== undefined) seen.add(j);
    if (found.some((j) => j === undefined)) return;
    const members = [...new Set(found as number[])];
    if (splitQuads && members.length === 4) {
      const [self, mx, my, diag] = found as number[];
      groups.push([self, diag], [mx, my]);
    } else {
      groups.push(members);
    }
  });
  return groups;
}

/**
 * Take whole groups until exactly `count` junctions are chosen, each time the
 * group farthest from those already taken (from the centre, for the first),
 * and only a group that leaves the remainder reachable. Null when no exact
 * combination exists.
 */
function pickGroups(
  points: readonly Point[],
  groups: readonly number[][],
  count: number
): number[] | null {
  if (
    !sumReachable(
      count,
      groups.map((g) => g.length)
    )
  )
    return null;
  let cx = 0;
  let cy = 0;
  for (const { x, y } of points) {
    cx += x / points.length;
    cy += y / points.length;
  }
  const remaining = [...groups];
  const taken: number[] = [];
  let left = count;
  while (left > 0) {
    let best = -1;
    let bestScore = -Infinity;
    for (let g = 0; g < remaining.length; g++) {
      const group = remaining[g];
      if (group.length > left) continue;
      const others = remaining.filter((_, k) => k !== g).map((o) => o.length);
      if (!sumReachable(left - group.length, others)) continue;
      let score = Infinity;
      for (const i of group) {
        const p = points[i];
        if (taken.length === 0) {
          score = Math.min(score, Math.hypot(p.x - cx, p.y - cy));
        }
        for (const t of taken) {
          score = Math.min(score, Math.hypot(p.x - points[t].x, p.y - points[t].y));
        }
      }
      if (score > bestScore + 1e-9) {
        bestScore = score;
        best = g;
      }
    }
    if (best < 0) return null;
    taken.push(...remaining[best]);
    left -= remaining[best].length;
    remaining.splice(best, 1);
  }
  return taken;
}

/**
 * Farthest-point spread for counts no mirror-symmetric set can make (an odd
 * count with no centre junction). One magnet goes nearest the centre; more
 * start bottom-left and add the junction farthest from those taken.
 */
function spreadFarthest(points: readonly Point[], count: number): number[] {
  const pickBy = (score: (p: Point) => number): number => {
    let best = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < points.length; i++) {
      const s = score(points[i]);
      if (s < bestScore - 1e-9) {
        bestScore = s;
        best = i;
      }
    }
    return best;
  };

  if (count === 1) return [pickBy(({ x, y }) => x * x + y * y)];

  const seed = pickBy(({ x, y }) => x + y);
  const taken = new Set<number>([seed]);
  const { x: sx, y: sy } = points[seed];
  const nearest = points.map(({ x, y }) => (x - sx) ** 2 + (y - sy) ** 2);
  while (taken.size < count) {
    let best = -1;
    let bestDist = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < points.length; i++) {
      if (taken.has(i)) continue;
      if (nearest[i] > bestDist + 1e-9) {
        bestDist = nearest[i];
        best = i;
      }
    }
    taken.add(best);
    const { x: bx, y: by } = points[best];
    for (let i = 0; i < points.length; i++) {
      nearest[i] = Math.min(nearest[i], (points[i].x - bx) ** 2 + (points[i].y - by) ** 2);
    }
  }
  return [...taken];
}

/**
 * Choose `count` junctions spread across the piece, mirror-symmetric whenever
 * the junctions and the count allow it.
 *
 * Preference order: a set symmetric about both axes of the junction grid, then
 * one symmetric through its centre (diagonal pairs), then a plain spread. Four
 * magnets therefore land on the four corner junctions, and two on the ends of
 * the middle row (or column) when the grid has one. Candidates arrive sorted
 * and ties keep that order, so the choice is deterministic.
 */
export function selectMountMagnets<T extends Point>(candidates: readonly T[], count: number): T[] {
  if (count <= 0 || candidates.length === 0) return [];
  if (count >= candidates.length) return [...candidates];

  const chosen =
    pickGroups(candidates, mirrorGroups(candidates, false), count) ??
    pickGroups(candidates, mirrorGroups(candidates, true), count) ??
    spreadFarthest(candidates, count);
  return [...chosen].sort((a, b) => a - b).map((i) => candidates[i]);
}

/**
 * Plan a piece's mount magnets: every fitting junction, thinned to the count.
 * `cellCornerRelief` names the cells whose floor relief reaches their corners
 * (see {@link junctionClearanceMm}); omit it on a plate with no relief.
 */
export function planMountMagnets(
  params: MountMagnetParams,
  gridW: number,
  gridD: number,
  totalHeight: number,
  profileHeight: number,
  cellOpts: ForEachCellOptions & { gridUnitMm: GridUnitInput },
  cellFilter?: (cell: CellInfo) => boolean,
  cellCornerRelief?: (cell: CellInfo) => boolean
): MountMagnetHole[] {
  if (!params.enabled) return [];
  return selectMountMagnets(
    mountMagnetJunctions(
      gridW,
      gridD,
      params,
      totalHeight,
      profileHeight,
      cellOpts,
      cellFilter,
      cellCornerRelief
    ),
    params.perPiece ?? MOUNT_MAGNETS_PER_PIECE_DEFAULT
  ).map(({ x, y, cornerRadius, cornerRelief }) => ({
    x,
    y,
    chamfer:
      params.chamfer === true &&
      mountMagnetChamferFits(
        params.diameter,
        params.depth,
        totalHeight,
        profileHeight,
        cornerRadius,
        cornerRelief
      ),
  }));
}
