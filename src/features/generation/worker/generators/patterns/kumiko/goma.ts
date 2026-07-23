/**
 * Goma (護摩) — stars with parallel internal ribs.
 *
 * Each jigumi arm is flanked by a pair of short ribs parallel to it, offset
 * by a fixed gap. The rib ends are trimmed at 30° so they seat against the
 * neighboring arms, adding rhythm and density to the base star.
 *
 * Only THREE rotations: a rib pair spans its whole arm, and every arm is
 * shared by two vertices — six-fold replication would emit each rib twice at
 * identical coordinates, and exactly-coincident tools are OCCT's worst case
 * (measured 2.5× the whole generation).
 *
 * Pure-math module — NO brepjs imports.
 */

import type { WrappedLatticeCalculator } from '../types';
import { createKumikoCalculator } from './calculator';
import { replicateRotations, THREE_FOLD } from './fillingUtils';
import type { KumikoPatternDef } from './types';

const TAN_30 = Math.tan(Math.PI / 6);

export const GOMA_DEF: KumikoPatternDef = {
  id: 'goma',
  voidFraction: 0.45,
  baseCellSize: 12,
  maxColumns: 32,
  filling: (cellSize) => {
    const gap = cellSize / 6;
    const zStart = gap * TAN_30;
    const zEnd = cellSize - gap * TAN_30;
    return replicateRotations(
      [
        { a: [-gap, zStart], b: [-gap, zEnd] },
        { a: [gap, zStart], b: [gap, zEnd] },
      ],
      THREE_FOLD
    );
  },
};

/** Factory for the pattern registry. */
export function createGomaCalculator(_binHeight: number, scale: number): WrappedLatticeCalculator {
  return createKumikoCalculator(GOMA_DEF, scale);
}
