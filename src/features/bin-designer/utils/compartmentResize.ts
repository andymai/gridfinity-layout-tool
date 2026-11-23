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
 * a gap between pockets or a stub inside one. For the same reason, every other
 * wall at the moved wall's ends must still sit on its grid line.
 *
 * A leaning wall's foot is not part of the cavity, so a side whose compartment
 * or neighbour has one cannot move.
 */

import type { CompartmentConfig, DividerOverride } from '../types';
import { DESIGNER_CONSTRAINTS } from '../constants/gridfinity';
import { getCompartmentBounds } from './compartmentGrid';
import { compartmentCavityExact } from './compartmentDimensions';
import type { DividerGeometry } from './dividerAngle';
import { DIVIDER_OFFSET_MAX_MM, type EligibleDivider } from './compartments';

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

function overrideOf(
  config: CompartmentConfig,
  idA: number,
  idB: number
): DividerOverride | undefined {
  const a = Math.min(idA, idB);
  const b = Math.max(idA, idB);
  return config.dividerOverrides?.find((o) => o.compartmentA === a && o.compartmentB === b);
}

function isOffGrid(o: DividerOverride | undefined): boolean {
  return o !== undefined && (o.offsetStart !== 0 || o.offsetEnd !== 0 || (o.rakeDeg ?? 0) !== 0);
}

function touchesLeaningWall(config: CompartmentConfig, ids: readonly number[]): boolean {
  return (config.dividerOverrides ?? []).some(
    (o) => (o.rakeDeg ?? 0) !== 0 && (ids.includes(o.compartmentA) || ids.includes(o.compartmentB))
  );
}

/**
 * Whether every other wall that meets the moved wall's ends sits on its grid
 * line. `along` runs with the moved wall, `across` is the resized axis, and
 * the moved wall lies on across-boundary `boundary`, spanning `spanStart` to
 * `spanEnd` along it.
 */
function junctionsOnGrid(
  config: CompartmentConfig,
  axis: ResizeAxis,
  boundary: number,
  spanStart: number,
  spanEnd: number
): boolean {
  const { cols, rows, cells } = config;
  const isX = axis === 'width';
  const alongLimit = isX ? rows : cols;
  const at = (along: number, across: number): number =>
    isX ? cells[along * cols + across] : cells[across * cols + along];
  const offGrid = (idA: number, idB: number): boolean =>
    idA !== idB && isOffGrid(overrideOf(config, idA, idB));

  const ends = [spanStart, spanEnd + 1].filter((r) => r > 0 && r < alongLimit);
  return ends.every((r) => {
    const outside = r === spanStart ? r - 1 : r;
    return !(
      offGrid(at(r - 1, boundary - 1), at(r, boundary - 1)) ||
      offGrid(at(r - 1, boundary), at(r, boundary)) ||
      offGrid(at(outside, boundary - 1), at(outside, boundary))
    );
  });
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
  if (touchesLeaningWall(config, [compartmentId, neighborId])) return null;
  const boundary = far ? neighborIndex : neighborIndex + 1;
  const spanEnd = isX ? bounds.maxRow : bounds.maxCol;
  if (!junctionsOnGrid(config, axis, boundary, spanStart, spanEnd)) return null;

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
    const lowest = Math.min(wall.offsetStart, wall.offsetEnd);
    const highest = Math.max(wall.offsetStart, wall.offsetEnd);
    const low = Math.max(wall.geometry.offsetMin, -DIVIDER_OFFSET_MAX_MM) - lowest;
    const high = Math.min(wall.geometry.offsetMax, DIVIDER_OFFSET_MAX_MM) - highest;
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
 * the plan's range). An angle moves with the wall unchanged.
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
    const override: DividerOverride = {
      compartmentA: wall.compartmentA,
      compartmentB: wall.compartmentB,
      offsetStart,
      offsetEnd,
    };
    const index = next.findIndex(
      (o) => o.compartmentA === wall.compartmentA && o.compartmentB === wall.compartmentB
    );
    if (index >= 0) next[index] = override;
    else next.push(override);
  }
  return next;
}
