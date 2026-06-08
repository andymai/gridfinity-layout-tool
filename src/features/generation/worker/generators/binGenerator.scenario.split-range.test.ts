// @vitest-environment node
/**
 * Range-split parity: a worker that cuts only its assigned pieces must produce
 * geometry identical to cutting the whole grid and selecting those pieces.
 *
 * This guards the pool optimization where `splitSolidIntoPieces` skips the
 * boolean cut for unassigned pieces — the speedup must not change output.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import {
  generateSplitPreview,
  generateSplitPreviewRange,
} from '@/features/generation/worker/generators/binGenerator';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

const GRID = 42;

/** 24×6 socket bin with lip, cut into a 4×2 grid (8 pieces). */
const PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 12,
  depth: 6,
  height: 4,
  base: { ...DEFAULT_BIN_PARAMS.base, style: 'socket', stackingLip: true },
};

/**
 * Interior cut planes for `n` equal pieces across a span (mm from center).
 * Nudged a fraction of a cell off socket-cell boundaries — real print-bed
 * planes rarely land exactly on a wall, and the production path shifts them via
 * shiftCutPlanesOffCellBoundaries; nudging here keeps the test off OCCT's
 * coplanar-wall-drop edge case (#1676) rather than relying on the 0.1mm shift.
 */
function cutPlanes(spanMm: number, n: number, gridUnitMm = GRID): number[] {
  const planes: number[] = [];
  const nudge = 0.27 * gridUnitMm;
  for (let i = 1; i < n; i++) planes.push(-spanMm / 2 + (spanMm * i) / n + nudge);
  return planes;
}

const CX = cutPlanes(PARAMS.width * GRID, 4); // 4 columns
const CY = cutPlanes(PARAMS.depth * GRID, 2); // 2 rows → 8 pieces, col-major

describe('split range parity (cut-skip optimization)', () => {
  it('range subset produces the same pieces as the full split', () => {
    const full = generateSplitPreview(PARAMS, CX, CY);
    expect(full.pieces).toHaveLength(8);

    // Subset spanning both columns and rows (col-major flat indices).
    const subset = [1, 3, 6];
    const ranged = generateSplitPreviewRange(PARAMS, CX, CY, subset);
    expect(ranged.pieces).toHaveLength(subset.length);

    for (const piece of ranged.pieces) {
      const match = full.pieces.find((p) => p.col === piece.col && p.row === piece.row);
      expect(match, `full piece for ${piece.label}`).toBeDefined();
      if (!match) continue;

      // Same label and grid placement.
      expect(piece.label).toBe(match.label);
      expect(piece.offsetX).toBeCloseTo(match.offsetX, 5);
      expect(piece.offsetY).toBeCloseTo(match.offsetY, 5);

      // Deterministic tessellation on the same CPU → identical triangle counts.
      expect(piece.indices.length).toBe(match.indices.length);
      expect(piece.vertices.length).toBe(match.vertices.length);

      // Same solid → same bounding box (no walls dropped by skipping cuts).
      const a = boundingBox(piece.vertices);
      const b = boundingBox(match.vertices);
      expect(a.minX).toBeCloseTo(b.minX, 4);
      expect(a.maxX).toBeCloseTo(b.maxX, 4);
      expect(a.minY).toBeCloseTo(b.minY, 4);
      expect(a.maxY).toBeCloseTo(b.maxY, 4);
      expect(a.minZ).toBeCloseTo(b.minZ, 4);
      expect(a.maxZ).toBeCloseTo(b.maxZ, 4);
    }
  }, 120_000);

  it('rejects out-of-range indices', () => {
    expect(() => generateSplitPreviewRange(PARAMS, CX, CY, [8])).toThrow(/out of range/);
    expect(() => generateSplitPreviewRange(PARAMS, CX, CY, [-1])).toThrow(/out of range/);
  }, 120_000);
});

describe('fully-interior split piece messaging', () => {
  // 12×12 bin cut into a 4×4 grid has fully-interior pieces (interior cut on
  // all four sides). On a hollow bin those pieces have no walls.
  const grid = (solid: boolean): BinParams => ({
    ...DEFAULT_BIN_PARAMS,
    width: 12,
    depth: 12,
    height: 4,
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'socket', stackingLip: true, solid },
  });
  const GX = cutPlanes(12 * GRID, 4);
  const GY = cutPlanes(12 * GRID, 4);

  it('explains the open cavity instead of blaming a coplanar bug (hollow bin)', () => {
    expect(() => generateSplitPreview(grid(false), GX, GY)).toThrow(/open cavity/);
    expect(() => generateSplitPreview(grid(false), GX, GY)).not.toThrow(/report this bug/);
  }, 120_000);

  it('splits a solid bin into a full grid without error', () => {
    const result = generateSplitPreview(grid(true), GX, GY);
    expect(result.pieces).toHaveLength(16);
  }, 120_000);
});
