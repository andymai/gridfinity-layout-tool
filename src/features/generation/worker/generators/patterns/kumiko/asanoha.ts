/**
 * Asanoha (麻の葉) — the hemp leaf.
 *
 * Six spokes per vertex reaching the centroids of the six surrounding
 * triangles (centroid distance from a vertex = 2·columnPitch/3). Together
 * with the six jigumi arms this gives the iconic twelve-armed hemp-leaf star.
 *
 * Pure-math module — NO brepjs imports.
 */

import type { WrappedLatticeCalculator } from '../types';
import { createKumikoCalculator } from './calculator';
import { replicateRotations, SIX_FOLD } from './fillingUtils';
import type { KumikoPatternDef } from './types';

export const ASANOHA_DEF: KumikoPatternDef = {
  id: 'asanoha',
  // Dense: the centroid spokes cover roughly half of every triangle on top
  // of the mitsukude grid.
  voidFraction: 0.3,
  baseCellSize: 12,
  maxColumns: 32,
  filling: (_cellSize, columnPitch) =>
    replicateRotations([{ a: [0, 0], b: [(2 * columnPitch) / 3, 0] }], SIX_FOLD),
};

/** Factory for the pattern registry. */
export function createAsanohaCalculator(
  _binHeight: number,
  scale: number
): WrappedLatticeCalculator {
  return createKumikoCalculator(ASANOHA_DEF, scale);
}
