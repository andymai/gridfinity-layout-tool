/**
 * Mitsukude (三つ組手) — the foundational kumiko pattern.
 *
 * The three-way joint: the bare triangular jigumi grid with no vertex
 * fillings. Six struts meet at every vertex, reading as a field of clean
 * six-pointed stars. All other kumiko patterns build on this grid by adding
 * filling segments per vertex.
 *
 * Pure-math module — NO brepjs imports.
 */

import type { WrappedLatticeCalculator } from '../types';
import { createKumikoCalculator } from './calculator';
import type { KumikoPatternDef } from './types';

/**
 * Open-area fraction at neutral scale: the three strut families cover
 * ~2√3·w/s of the band (w = 1.2, s ≈ 9.2), less vertex overlap.
 */
const MITSUKUDE_VOID_FRACTION = 0.58;

export const MITSUKUDE_DEF: KumikoPatternDef = {
  id: 'mitsukude',
  voidFraction: MITSUKUDE_VOID_FRACTION,
};

/** Factory for the pattern registry. */
export function createMitsukudeCalculator(
  _binHeight: number,
  scale: number
): WrappedLatticeCalculator {
  return createKumikoCalculator(MITSUKUDE_DEF, scale);
}
