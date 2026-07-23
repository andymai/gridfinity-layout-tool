/**
 * Shared calculator factory for kumiko wrapped-lattice patterns.
 *
 * Maps the normalized pattern scale to a target triangle edge length using the
 * shared multiplicative scale model, then resolves the quantized lattice per
 * band. One factory serves all kumiko pattern defs.
 *
 * Pure-math module — NO brepjs imports.
 */

import { scaleFactor } from '../patternScale';
import type { WrappedLatticeCalculator } from '../types';
import { generateKumikoLattice, KUMIKO_BASE_CELL_SIZE, KUMIKO_STRUT_WIDTH } from './segmentLattice';
import type { KumikoPatternDef } from './types';

/** Build a wrapped-lattice calculator for a kumiko pattern definition. */
export function createKumikoCalculator(
  def: KumikoPatternDef,
  scale: number
): WrappedLatticeCalculator {
  const targetCellSize = (def.baseCellSize ?? KUMIKO_BASE_CELL_SIZE) * scaleFactor(scale);
  return {
    strategy: 'wrapped-lattice',
    getPatternType: () => def.id,
    // One full diagonal period plus anchoring room — below this the band
    // can't fit a recognizable cell row.
    getMinPatternHeight: () => targetCellSize,
    getShapeRadius: () => KUMIKO_STRUT_WIDTH / 2,
    getLattice: (band) => generateKumikoLattice(def, band, targetCellSize),
    getVoidFraction: () => def.voidFraction,
  };
}
