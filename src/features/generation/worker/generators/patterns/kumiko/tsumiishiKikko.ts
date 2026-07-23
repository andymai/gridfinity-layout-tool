/**
 * Tsumiishi-Kikko (積石亀甲) — stacked tortoiseshell.
 *
 * Radial ribs from each arm's midpoint toward the cell interior form
 * hexagonal chambers inside the triangular lattice. Base segments
 * (vertex-local, arm pointing +z): ledge (0, s/2) → (q/3, s/2) and brace
 * (q/2, s/4) → (q/3, s/2), replicated six-fold.
 *
 * Pure-math module — NO brepjs imports.
 */

import type { WrappedLatticeCalculator } from '../types';
import { createKumikoCalculator } from './calculator';
import { replicateRotations, SIX_FOLD, THREE_FOLD } from './fillingUtils';
import type { KumikoPatternDef } from './types';

export const TSUMIISHI_KIKKO_DEF: KumikoPatternDef = {
  id: 'tsumiishi-kikko',
  voidFraction: 0.45,
  baseCellSize: 12,
  maxColumns: 32,
  filling: (cellSize, columnPitch) => [
    // Ledge crossing the arm at its midpoint — one piece per arm (arms are
    // shared between vertices, so six-fold would emit collinear duplicates).
    ...replicateRotations(
      [{ a: [-columnPitch / 3, cellSize / 2], b: [columnPitch / 3, cellSize / 2] }],
      THREE_FOLD
    ),
    ...replicateRotations(
      [{ a: [columnPitch / 2, cellSize / 4], b: [columnPitch / 3, cellSize / 2] }],
      SIX_FOLD
    ),
  ],
};

/** Factory for the pattern registry. */
export function createTsumiishiKikkoCalculator(
  _binHeight: number,
  scale: number
): WrappedLatticeCalculator {
  return createKumikoCalculator(TSUMIISHI_KIKKO_DEF, scale);
}
