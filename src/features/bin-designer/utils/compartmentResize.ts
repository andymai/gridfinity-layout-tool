/**
 * Exact-size edits for one compartment, expressed as divider shifts.
 *
 * A compartment's width or depth in mm is not stored. It follows from the grid
 * and from the `dividerOverrides` that move its walls off their grid lines, so
 * setting a size means moving one side's wall by the difference.
 *
 * Only a side with ONE neighbour that spans the same rows (for width) or
 * columns (for depth) can move. The generator keeps every perpendicular wall
 * on its grid endpoints, so a moved wall that meets one at a T-junction leaves
 * a gap between pockets or a stub inside one.
 */

import type { CompartmentConfig, DividerOverride } from '../types';
import { DESIGNER_CONSTRAINTS } from '../constants/gridfinity';
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

interface MovableSide {
  readonly wall: MovableWall;
  readonly neighborId: number;
}

function isRectangle(config: CompartmentConfig, id: number): boolean {
  const b = getCompartmentBounds(config, id);
  if (!b) return false;
  const area = (b.maxCol - b.minCol + 1) * (b.maxRow - b.minRow + 1);
  return config.cells.filter((cell) => cell === id).length === area;
}

function movableSide(
  config: CompartmentConfig,
  compartmentId: number,
  axis: ResizeAxis,
  far: boolean,
  walls: readonly ResizeWall[]
): MovableSide | null {
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

  const spanStart = isX ? bounds.minRow : bounds.minCol;
  const neighborId = isX
    ? cells[spanStart * cols + neighborIndex]
    : cells[neighborIndex * cols + spanStart];
  const nb = getCompartmentBounds(config, neighborId);
  if (!nb || !isRectangle(config, neighborId)) return null;
  const sameSpan = isX
    ? nb.minRow === bounds.minRow && nb.maxRow === bounds.maxRow
    : nb.minCol === bounds.minCol && nb.maxCol === bounds.maxCol;
  if (!sameSpan) return null;

  const a = Math.min(compartmentId, neighborId);
  const b = Math.max(compartmentId, neighborId);
  const wall = walls.find(
    (w) =>
      w.axis === (isX ? 'vertical' : 'horizontal') && w.compartmentA === a && w.compartmentB === b
  );
  if (!wall?.geometry) return null;
  return { wall: { ...wall, geometry: wall.geometry }, neighborId };
}

/**
 * Which walls a size edit on `axis` moves, and the size range they allow.
 *
 * Only `walls` may move, so the caller decides which neighbours count (Bento
 * passes walls between two drawn compartments). The far side is preferred, so
 * sizing compartments left to right leaves each finished one alone. The range
 * also keeps both pockets at least `MIN_COMPARTMENT_SIZE` wide as they are
 * now, since the divider envelope only knows their grid footprints. Returns
 * null when neither side can move.
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

  const minSize = DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE;

  for (const far of [true, false]) {
    const side = movableSide(config, compartmentId, axis, far, walls);
    if (!side) continue;
    const { wall } = side;
    const neighbor = compartmentCavityExact(config, side.neighborId, innerW, innerD);
    if (!neighbor) continue;
    const neighborMm = axis === 'width' ? neighbor.width : neighbor.depth;
    const low = wall.geometry.offsetMin - Math.min(wall.offsetStart, wall.offsetEnd);
    const high = wall.geometry.offsetMax - Math.max(wall.offsetStart, wall.offsetEnd);
    const envelopeMin = far ? currentMm + low : currentMm - high;
    const envelopeMax = far ? currentMm + high : currentMm - low;
    const minMm = Math.max(envelopeMin, Math.min(currentMm, minSize));
    const maxMm = Math.min(envelopeMax, currentMm + Math.max(0, neighborMm - minSize));
    if (minMm > maxMm) continue;
    return { currentMm, minMm, maxMm, walls: [wall], direction: far ? 1 : -1 };
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
