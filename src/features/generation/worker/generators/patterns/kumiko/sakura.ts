/**
 * Sakura (桜) — cherry blossom petals.
 *
 * Six solid petals radiate from each star center toward the surrounding
 * triangle centroids (the gaps between the jigumi arms), reading as a
 * blossom inside every six-armed star. Each petal is a single wide capsule
 * along the centroid direction — solid pieces, like the wooden petals in
 * traditional sakura kumiko, and 4× cheaper to build than an outline.
 *
 * Pure-math module — NO brepjs imports.
 */

import type { WrappedLatticeCalculator } from '../types';
import { createKumikoCalculator } from './calculator';
import { replicateRotations, SIX_FOLD } from './fillingUtils';
import type { KumikoPatternDef } from './types';

export const SAKURA_DEF: KumikoPatternDef = {
  id: 'sakura',
  voidFraction: 0.4,
  baseCellSize: 12,
  maxColumns: 32,
  filling: (cellSize, columnPitch) => {
    const reach = (2 * columnPitch) / 3;
    return replicateRotations(
      [{ a: [0.3 * reach, 0], b: [0.85 * reach, 0], width: 0.28 * cellSize }],
      SIX_FOLD
    );
  },
};

/** Factory for the pattern registry. */
export function createSakuraCalculator(
  _binHeight: number,
  scale: number
): WrappedLatticeCalculator {
  return createKumikoCalculator(SAKURA_DEF, scale);
}
