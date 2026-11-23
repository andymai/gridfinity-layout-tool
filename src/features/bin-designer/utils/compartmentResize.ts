/**
 * Exact-size edits for one compartment, expressed as divider shifts.
 *
 * A compartment's width or depth in mm is not stored. It follows from the grid
 * and from the `dividerOverrides` that move its walls off their grid lines, so
 * setting a size means moving one side's walls by the difference. Every wall
 * on that side moves by the same amount, so the edge stays straight however
 * many neighbours share it.
 */

import type { CompartmentConfig, DividerOverride } from '../types';
import { getCompartmentBounds } from './compartmentGrid';
import { compartmentCavityExact } from './compartmentDimensions';
import { getLeanLimits, type DividerGeometry } from './dividerAngle';
import type { EligibleDivider } from './compartments';

export type ResizeAxis = 'width' | 'depth';

export interface ResizeWall extends EligibleDivider {
  readonly geometry: DividerGeometry | null;
}

type MovableWall = ResizeWall & { readonly geometry: DividerGeometry };

export interface CompartmentResizePlan {
  readonly currentMm: number;
  readonly minMm: number;
  readonly maxMm: number;
  readonly walls: readonly MovableWall[];
  /** +1 when the far side (right / back) moves, −1 when the near side does. */
  readonly direction: 1 | -1;
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

function sideWalls(
  config: CompartmentConfig,
  compartmentId: number,
  axis: ResizeAxis,
  far: boolean,
  walls: readonly ResizeWall[]
): MovableWall[] | null {
  const bounds = getCompartmentBounds(config, compartmentId);
  if (!bounds) return null;
  const { cols, rows, cells } = config;
  const isX = axis === 'width';
  const neighborIndex = isX
    ? far
      ? bounds.maxCol + 1
      : bounds.minCol - 1
    : far
      ? bounds.maxRow + 1
      : bounds.minRow - 1;
  if (neighborIndex < 0 || neighborIndex >= (isX ? cols : rows)) return null;

  const wallAxis = isX ? 'vertical' : 'horizontal';
  const spanStart = isX ? bounds.minRow : bounds.minCol;
  const spanEnd = isX ? bounds.maxRow : bounds.maxCol;
  const found = new Map<number, MovableWall>();
  for (let i = spanStart; i <= spanEnd; i++) {
    const neighborId = isX ? cells[i * cols + neighborIndex] : cells[neighborIndex * cols + i];
    if (found.has(neighborId)) continue;
    const a = Math.min(compartmentId, neighborId);
    const b = Math.max(compartmentId, neighborId);
    const wall = walls.find(
      (w) => w.axis === wallAxis && w.compartmentA === a && w.compartmentB === b
    );
    if (!wall?.geometry) return null;
    found.set(neighborId, { ...wall, geometry: wall.geometry });
  }
  return [...found.values()];
}

/**
 * Which walls a size edit on `axis` moves, and the size range they allow.
 *
 * Only `walls` may move, so the caller decides which neighbours count (Bento
 * passes walls between two drawn compartments). The far side is preferred, so
 * sizing compartments left to right leaves each finished one alone. Returns
 * null when neither side is made only of movable walls.
 */
export function planCompartmentResize(
  config: CompartmentConfig,
  compartmentId: number,
  axis: ResizeAxis,
  innerW: number,
  innerD: number,
  walls: readonly ResizeWall[]
): CompartmentResizePlan | null {
  const cavity = compartmentCavityExact(config, compartmentId, innerW, innerD);
  if (!cavity) return null;
  const currentMm = axis === 'width' ? cavity.width : cavity.depth;

  for (const far of [true, false]) {
    const moved = sideWalls(config, compartmentId, axis, far, walls);
    if (!moved) continue;
    let low = Number.NEGATIVE_INFINITY;
    let high = Number.POSITIVE_INFINITY;
    for (const wall of moved) {
      low = Math.max(low, wall.geometry.offsetMin - Math.min(wall.offsetStart, wall.offsetEnd));
      high = Math.min(high, wall.geometry.offsetMax - Math.max(wall.offsetStart, wall.offsetEnd));
    }
    if (low > high) continue;
    const direction = far ? 1 : -1;
    return {
      currentMm,
      minMm: far ? currentMm + low : currentMm - high,
      maxMm: far ? currentMm + high : currentMm - low,
      walls: moved,
      direction,
    };
  }
  return null;
}

/**
 * The full `dividerOverrides` array after resizing to `targetMm` (clamped to
 * the plan's range). Angles move with the wall unchanged; a lean is clamped to
 * what the new position still allows.
 */
export function resizedDividerOverrides(
  config: CompartmentConfig,
  plan: CompartmentResizePlan,
  targetMm: number
): DividerOverride[] {
  const target = Math.min(plan.maxMm, Math.max(plan.minMm, targetMm));
  const shift = (target - plan.currentMm) * plan.direction;
  const next = [...(config.dividerOverrides ?? [])];
  for (const wall of plan.walls) {
    const offsetStart = round3(wall.offsetStart + shift);
    const offsetEnd = round3(wall.offsetEnd + shift);
    const limits = getLeanLimits(wall.geometry, { offsetStart, offsetEnd });
    const rakeDeg = Math.min(limits.maxDeg, Math.max(limits.minDeg, wall.rakeDeg));
    const override: DividerOverride = {
      compartmentA: wall.compartmentA,
      compartmentB: wall.compartmentB,
      offsetStart,
      offsetEnd,
      ...(rakeDeg !== 0 ? { rakeDeg } : {}),
    };
    const index = next.findIndex(
      (o) => o.compartmentA === wall.compartmentA && o.compartmentB === wall.compartmentB
    );
    if (index >= 0) next[index] = override;
    else next.push(override);
  }
  return next;
}
