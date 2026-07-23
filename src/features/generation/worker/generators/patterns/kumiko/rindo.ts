/**
 * Rindo (竜胆) — gentian flower diagonals.
 *
 * Every triangle of the jigumi receives its medial triangle: one bold chord
 * between the midpoints of each pair of arms meeting at a vertex. The chords
 * run parallel to the opposite grid lines, striking rhombi out of every cell.
 * Base segment (vertex-local, arms at 90° and 30°): (0, s/2) → (q/2, s/4),
 * replicated six-fold — each chord is unique to its vertex, so the six-fold
 * sweep tiles every medial triangle exactly once.
 *
 * Pure-math module — NO brepjs imports.
 */

import type { WrappedLatticeCalculator } from '../types';
import { createKumikoCalculator } from './calculator';
import { replicateRotations, SIX_FOLD } from './fillingUtils';
import type { KumikoPatternDef } from './types';

export const RINDO_DEF: KumikoPatternDef = {
  id: 'rindo',
  voidFraction: 0.45,
  baseCellSize: 12,
  maxColumns: 32,
  filling: (cellSize, columnPitch) =>
    replicateRotations([{ a: [0, cellSize / 2], b: [columnPitch / 2, cellSize / 4] }], SIX_FOLD),
};

/** Factory for the pattern registry. */
export function createRindoCalculator(_binHeight: number, scale: number): WrappedLatticeCalculator {
  return createKumikoCalculator(RINDO_DEF, scale);
}
