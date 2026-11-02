import type { FootLattice } from '@/shared/types/bin';
import { isFractional } from '@/core/constants';
import { isPartialMask, type CellMask } from '@/shared/utils/cellMask';

/**
 * The foot layout the socket walk builds, resolved from the user's base
 * settings and the bin's mask.
 *
 * A foot has to land inside one pocket — adjacent pockets are separated by a
 * ridge — so which layout seats depends on where the bin sits, PER AXIS. Half-bin
 * mode can place a bin half a unit off-grid on one axis and on-grid on the
 * other, and a layout applied to both axes at once straddles ridges on whichever
 * one it got wrong.
 */
export interface SocketCellPlan {
  /** Uniform 0.5u feet everywhere: seats at either offset, at the most feet. */
  readonly halfSockets: boolean;
  readonly latticeX: FootLattice;
  readonly latticeY: FootLattice;
}

export const DEFAULT_SOCKET_CELL_PLAN: SocketCellPlan = {
  halfSockets: false,
  latticeX: 'grid',
  latticeY: 'grid',
};

/**
 * A fractional axis ignores the `half` lattice.
 *
 * Such an axis already carries a half cell, and `fractionalEdge` decides which
 * end it sits on — which covers BOTH placements on its own ('end' seats on-grid,
 * 'start' seats half-offset). The lattice can only add a layout that seats at
 * one of them and perches at the other, and `computeMatchedFootLattice`
 * deliberately skips fractional axes, so nothing would warn about it.
 */
function axisLattice(lattice: FootLattice | undefined, units: number): FootLattice {
  return lattice === 'half' && !isFractional(units) ? 'half' : 'grid';
}

/**
 * Fold the base settings, the bin's size and its mask into the plan the socket
 * walk consumes.
 *
 * `halfSockets` overrides both lattices: uniform 0.5u feet already seat at
 * either offset, so a lattice choice on top would only cost feet.
 *
 * A partial `cellMask` also forces `grid`. The mask is authored against the
 * standard grid, and the `half` lattice moves every interior boundary half a
 * unit off it — the mask's fill test would then straddle two authored cells and
 * silently drop feet along an inner corner. The UI says so rather than offering
 * a lattice that would not be honoured.
 */
export function resolveSocketCellPlan(
  halfSockets: boolean,
  latticeX: FootLattice | undefined,
  latticeY: FootLattice | undefined,
  mask: CellMask | undefined,
  gridW: number,
  gridD: number
): SocketCellPlan {
  if (halfSockets) return { halfSockets: true, latticeX: 'grid', latticeY: 'grid' };
  if (isPartialMask(mask)) return DEFAULT_SOCKET_CELL_PLAN;
  return {
    halfSockets: false,
    latticeX: axisLattice(latticeX, gridW),
    latticeY: axisLattice(latticeY, gridD),
  };
}
