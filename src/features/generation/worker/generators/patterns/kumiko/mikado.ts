/**
 * Mikado (帝つなぎ) — imperial linked triangles.
 *
 * Each arm carries a stub from its third-point up to the arm midline plus a
 * short riser, nesting a smaller triangle inside every jigumi cell. Base
 * segments (vertex-local, arm pointing +z): stub (0, s/3) → (q/3, s/2) and
 * riser (q/3, s/6) → (q/3, s/2), replicated six-fold.
 *
 * Pure-math module — NO brepjs imports.
 */

import type { WrappedLatticeCalculator } from '../types';
import { createKumikoCalculator } from './calculator';
import { replicateRotations, SIX_FOLD } from './fillingUtils';
import type { KumikoPatternDef } from './types';

export const MIKADO_DEF: KumikoPatternDef = {
  id: 'mikado',
  voidFraction: 0.42,
  baseCellSize: 12,
  maxColumns: 32,
  filling: (cellSize, columnPitch) =>
    replicateRotations(
      [
        { a: [0, cellSize / 3], b: [columnPitch / 3, cellSize / 2] },
        { a: [columnPitch / 3, cellSize / 6], b: [columnPitch / 3, cellSize / 2] },
      ],
      SIX_FOLD
    ),
};

/** Factory for the pattern registry. */
export function createMikadoCalculator(
  _binHeight: number,
  scale: number
): WrappedLatticeCalculator {
  return createKumikoCalculator(MIKADO_DEF, scale);
}
