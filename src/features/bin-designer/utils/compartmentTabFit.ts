/**
 * Label-tab span and eligibility geometry.
 *
 * The one place that answers "can a label tab exist here, and how wide is it".
 * The worker that cuts the socket, the ghost overlay that previews it and the
 * plate planner that ships a plate for it all gate on these predicates. A fourth
 * answer derived independently is how a preview stops matching the mesh, or a
 * plate ships with no socket to click into.
 */

import type { CompartmentConfig } from '../types';
import { getCompartmentBounds, isRectangularCompartment } from './compartments';

/** Which wall of a row a label tab hangs from. */
export type TabAnchorSide = 'back' | 'front';

/** A compartment's usable X extent (mm, interior frame, origin at bin centre). */
export interface CompartmentTabSpan {
  readonly left: number;
  readonly right: number;
}

/**
 * Signed mm shift of one vertical boundary of `compartmentId`, resolved from
 * `dividerOverrides`.
 *
 * `side` names which boundary of the compartment this is, and therefore which
 * endpoint of a TILTED divider bounds an axis-aligned tab: the left boundary is
 * bounded by its rightmost endpoint, the right boundary by its leftmost. A
 * straight shift has both endpoints equal, so the choice is moot there.
 *
 * A tall compartment can border different neighbours per row, each with its own
 * override, so every bordering row is folded in: the tab is one rectangle and
 * has to clear all of them.
 */
/**
 * How far a compartment's edge has been pushed off its grid line by
 * `dividerOverrides`, in mm.
 *
 * The two axes are the same problem with rows and columns swapped: a positive
 * offset moves a vertical divider toward +X and a horizontal one toward +Y, so
 * the near side ('left'/'bottom') takes the most-positive offset and the far
 * side ('right'/'top') the most-negative. Taking the extreme is deliberate —
 * a tilted wall has two different endpoint offsets, and the compartment's
 * usable extent is bounded by whichever end intrudes furthest.
 */
export function dividerShift(
  config: CompartmentConfig,
  compartmentId: number,
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number },
  side: 'left' | 'right' | 'bottom' | 'top'
): number {
  const overrides = config.dividerOverrides;
  if (!overrides || overrides.length === 0) return 0;
  const { cols, rows, cells } = config;
  const isX = side === 'left' || side === 'right';
  const isNear = side === 'left' || side === 'bottom';

  const neighborIndex = isX
    ? isNear
      ? bounds.minCol - 1
      : bounds.maxCol + 1
    : isNear
      ? bounds.minRow - 1
      : bounds.maxRow + 1;
  const limit = isX ? cols : rows;
  if (neighborIndex < 0 || neighborIndex >= limit) return 0;

  const spanStart = isX ? bounds.minRow : bounds.minCol;
  const spanEnd = isX ? bounds.maxRow : bounds.maxCol;

  let shift = isNear ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  for (let i = spanStart; i <= spanEnd; i++) {
    const neighborId = isX ? cells[i * cols + neighborIndex] : cells[neighborIndex * cols + i];
    if (neighborId === compartmentId) continue;
    const a = Math.min(compartmentId, neighborId);
    const b = Math.max(compartmentId, neighborId);
    const ov = overrides.find((o) => o.compartmentA === a && o.compartmentB === b);
    // A bordering row/column with no override pins the boundary to its grid line.
    const stepShift = ov
      ? isNear
        ? Math.max(ov.offsetStart, ov.offsetEnd)
        : Math.min(ov.offsetStart, ov.offsetEnd)
      : 0;
    shift = isNear ? Math.max(shift, stepShift) : Math.min(shift, stepShift);
  }
  return Number.isFinite(shift) ? shift : 0;
}

function dividerXShift(
  config: CompartmentConfig,
  compartmentId: number,
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number },
  side: 'left' | 'right'
): number {
  return dividerShift(config, compartmentId, bounds, side);
}

/**
 * The X span a compartment's label tab may occupy: the compartment's column
 * range, less half a divider on each side that has one, shifted to follow any
 * `dividerOverrides` on those dividers.
 *
 * The single source of truth for that span, shared by the worker that builds
 * the shelf, the ghost overlay that previews it and the socket planner that
 * sizes its plate. Deriving it from the nominal grid line instead left the
 * shelf floating off its wall and overhanging into the neighbour whenever a
 * divider was shifted.
 *
 * Returns null for an id that isn't in the grid.
 */
export function compartmentTabXSpan(
  config: CompartmentConfig,
  compartmentId: number,
  innerW: number
): CompartmentTabSpan | null {
  const bounds = getCompartmentBounds(config, compartmentId);
  if (!bounds) return null;

  const { cols, thickness } = config;
  const cellW = innerW / cols;
  const hasLeftWall = bounds.minCol > 0;
  const hasRightWall = bounds.maxCol < cols - 1;

  const left =
    -innerW / 2 +
    bounds.minCol * cellW +
    (hasLeftWall ? thickness / 2 + dividerXShift(config, compartmentId, bounds, 'left') : 0);
  const right =
    -innerW / 2 +
    (bounds.maxCol + 1) * cellW -
    (hasRightWall ? thickness / 2 - dividerXShift(config, compartmentId, bounds, 'right') : 0);

  return { left, right };
}

/**
 * True when a divider wall runs the FULL inner width at `row`'s anchor edge
 * (or that edge is the bin's own outer wall).
 *
 * Full-width label tabs hang off that wall, so a boundary where any
 * column's compartment continues straight through has nothing to carry the
 * shelf across its whole length. Shared by the worker, the ghost overlay and
 * the label-plate export so the three can't disagree about which rows get a
 * tab.
 */
export function rowHasFullWidthWall(
  config: CompartmentConfig,
  row: number,
  anchor: TabAnchorSide
): boolean {
  const { cols, rows, cells } = config;
  if (anchor === 'back' ? row === rows - 1 : row === 0) return true;
  const neighborRow = anchor === 'back' ? row + 1 : row - 1;
  for (let col = 0; col < cols; col++) {
    if (cells[row * cols + col] === cells[neighborRow * cols + col]) return false;
  }
  return true;
}

/**
 * Depth (mm) of the open region a spanning tab's body protrudes into: from
 * `row`'s anchor wall to the next full-width wall in the opposite direction.
 *
 * That — not the compartment the tab happens to start in — is what the body
 * has to fit inside, because a spanning tab crosses every column.
 */
export function spanRegionDepth(
  config: CompartmentConfig,
  row: number,
  anchor: TabAnchorSide,
  cellD: number
): number {
  const step = anchor === 'back' ? -1 : 1;
  let far = row;
  while (
    far + step >= 0 &&
    far + step < config.rows &&
    !rowHasFullWidthWall(config, far + step, anchor)
  ) {
    far += step;
  }
  return (Math.abs(row - far) + 1) * cellD;
}

/** Inputs a label tab's eligibility depends on, beyond the grid itself. */
export interface LabelTabFit {
  /** `label.depth` — how far the shelf body protrudes from its wall. */
  readonly tabDepth: number;
  /** `label.inset` — extra inward offset from the anchor wall. */
  readonly inset: number;
  /** Interior depth of one grid row (mm). */
  readonly cellD: number;
  /** True when `label.edges === 'both'`, which can make a front tab collide. */
  readonly bothEdges: boolean;
}

/**
 * Whether a per-compartment label tab can actually exist at `compartmentId`'s
 * given edge — the counterpart of {@link spanningTabEligible} for the default
 * (non-full-width) layout.
 *
 * Compartments are enforced rectangles, so every one has both a front and a
 * back anchor edge; what varies is whether the shelf fits and whether the wall
 * it hangs from is axis-aligned.
 *
 * The single source of truth for that question, shared by the worker that cuts
 * the socket, the ghost overlay that previews it and the plate planner that
 * ships a plate for it. Issue was the plate planner answering it
 * independently — and never asking about `edges` at all, so a design with a tab
 * on both edges shipped half the plates it needed.
 */
export function compartmentTabEligible(
  config: CompartmentConfig,
  compartmentId: number,
  anchor: TabAnchorSide,
  fit: LabelTabFit
): boolean {
  const bounds = getCompartmentBounds(config, compartmentId);
  if (!bounds) return false;

  // The shelf spans the bounding box's anchor wall. On an L or U that wall is
  // partly open air over the neighbouring pocket.
  if (!isRectangularCompartment(config, compartmentId)) return false;

  // A tilted anchor wall breaks the axis-aligned wall the shelf and gusset
  // geometry assume.
  const hasTilt = anchor === 'back' ? compartmentHasTiltedBackWall : compartmentHasTiltedFrontWall;
  if (hasTilt(config, compartmentId)) return false;

  // The body would punch through the compartment's opposite wall.
  const compartmentDepth = (bounds.maxRow - bounds.minRow + 1) * fit.cellD;
  if (fit.tabDepth + fit.inset > compartmentDepth) return false;

  // With tabs on both edges, the front one is dropped where the pair would meet.
  if (fit.bothEdges && anchor === 'front' && 2 * fit.tabDepth + 2 * fit.inset > compartmentDepth) {
    return false;
  }

  return true;
}

/**
 * Whether a full-width label tab can actually exist at `row`'s anchor
 * wall.
 *
 * The single source of truth for that question. The worker builds the shelf,
 * the ghost overlay previews it and the label-plate export ships a plate for
 * it — if any of the three answered differently, the user would get a preview
 * that doesn't match the mesh, or a printed plate with no socket to click into.
 */
export function spanningTabEligible(
  config: CompartmentConfig,
  row: number,
  anchor: TabAnchorSide,
  fit: LabelTabFit
): boolean {
  // Nothing to hang the shelf from.
  if (!rowHasFullWidthWall(config, row, anchor)) return false;

  // A tilt anywhere along the boundary breaks the axis-aligned anchor wall the
  // shelf and gusset geometry assume.
  const { cols, cells } = config;
  const hasTilt = anchor === 'back' ? compartmentHasTiltedBackWall : compartmentHasTiltedFrontWall;
  for (let col = 0; col < cols; col++) {
    if (hasTilt(config, cells[row * cols + col])) return false;
  }

  // The body would punch through the wall bounding the far side.
  const regionDepth = spanRegionDepth(config, row, anchor, fit.cellD);
  if (fit.tabDepth + fit.inset > regionDepth) return false;

  // With tabs on both edges, the front one is dropped where the pair would meet.
  if (fit.bothEdges && anchor === 'front' && 2 * fit.tabDepth + 2 * fit.inset > regionDepth) {
    return false;
  }

  return true;
}

/**
 * True when the compartment's BACK wall is a tilted divider. Used by label
 * tabs which attach to the back wall and can't currently render on a tilt.
 *
 * "Back" = the +Y direction in interior coords (the higher-row neighbor in
 * the cell grid). A back wall is tilted when the compartment has a back
 * neighbor (not touching the bin's actual back wall) AND a divider override
 * pairs the two compartments.
 */
export function compartmentHasTiltedBackWall(
  config: CompartmentConfig,
  compartmentId: number
): boolean {
  const overrides = config.dividerOverrides;
  if (!overrides || overrides.length === 0) return false;
  const bounds = getCompartmentBounds(config, compartmentId);
  if (!bounds) return false;
  if (bounds.maxRow === config.rows - 1) return false;
  const backRow = bounds.maxRow + 1;
  // Scan the entire back edge from minCol..maxCol. A wide compartment can
  // border multiple different back-neighbors; any of them being tilted-pair
  // with this compartment counts as a tilted back wall.
  const overrideKeys = new Set<string>();
  for (const o of overrides) {
    const a = Math.min(o.compartmentA, o.compartmentB);
    const b = Math.max(o.compartmentA, o.compartmentB);
    overrideKeys.add(`${a}|${b}`);
  }
  for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
    const neighborId = config.cells[backRow * config.cols + col];
    if (neighborId === compartmentId) continue;
    const a = Math.min(compartmentId, neighborId);
    const b = Math.max(compartmentId, neighborId);
    if (overrideKeys.has(`${a}|${b}`)) return true;
  }
  return false;
}

/**
 * True when the compartment's FRONT wall is a tilted divider. Mirror of
 * `compartmentHasTiltedBackWall` for front-anchored label tabs.
 *
 * "Front" = the -Y direction in interior coords (the lower-row neighbor in
 * the cell grid). A front wall is tilted when the compartment has a front
 * neighbor (not touching the bin's actual front wall) AND a divider override
 * pairs the two compartments.
 */
export function compartmentHasTiltedFrontWall(
  config: CompartmentConfig,
  compartmentId: number
): boolean {
  const overrides = config.dividerOverrides;
  if (!overrides || overrides.length === 0) return false;
  const bounds = getCompartmentBounds(config, compartmentId);
  if (!bounds) return false;
  if (bounds.minRow === 0) return false;
  const frontRow = bounds.minRow - 1;
  const overrideKeys = new Set<string>();
  for (const o of overrides) {
    const a = Math.min(o.compartmentA, o.compartmentB);
    const b = Math.max(o.compartmentA, o.compartmentB);
    overrideKeys.add(`${a}|${b}`);
  }
  for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
    const neighborId = config.cells[frontRow * config.cols + col];
    if (neighborId === compartmentId) continue;
    const a = Math.min(compartmentId, neighborId);
    const b = Math.max(compartmentId, neighborId);
    if (overrideKeys.has(`${a}|${b}`)) return true;
  }
  return false;
}
