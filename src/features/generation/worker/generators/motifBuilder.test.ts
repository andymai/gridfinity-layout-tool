// @vitest-environment node
/**
 * Motif seam verification: buildMotifCut must produce a valid, non-empty solid
 * on the active kernel in both holes and lattice modes. Proves the tiled-2D
 * motif path (Drawing → extrude → union / panel−struts) end to end, so future
 * complex patterns only need to supply a MotifCell.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { isValid, isEmpty } from 'brepjs';
import { buildMotifCut } from './motifBuilder';
import { createGridMotif } from './patterns/gridMotif';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('buildMotifCut', () => {
  it('builds a valid non-empty solid in lattice mode (panel − struts)', () => {
    const cell = createGridMotif({ cellSize: 8, strutWidth: 1.2, mode: 'lattice' });
    const solid = buildMotifCut(cell, 40, 24, 4);
    expect(solid).not.toBeNull();
    if (solid) {
      expect(isEmpty(solid)).toBe(false);
      expect(isValid(solid)).toBe(true);
      solid.delete();
    }
  }, 60_000);

  it('builds a valid non-empty solid in holes mode (union of outlines)', () => {
    const cell = createGridMotif({ cellSize: 8, strutWidth: 1.2, mode: 'holes' });
    const solid = buildMotifCut(cell, 40, 24, 4);
    expect(solid).not.toBeNull();
    if (solid) {
      expect(isEmpty(solid)).toBe(false);
      expect(isValid(solid)).toBe(true);
      solid.delete();
    }
  }, 60_000);

  it('returns null when no cell fits the panel', () => {
    const cell = createGridMotif({ cellSize: 30, strutWidth: 2, mode: 'lattice' });
    expect(buildMotifCut(cell, 20, 20, 4)).toBeNull();
  });
});
