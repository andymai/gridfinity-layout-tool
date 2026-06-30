import { describe, it, expect } from 'vitest';
import {
  estimatePreviewComplexity,
  shouldDeferBrepPreview,
  DEFER_MAX_PIECE_CELLS,
  DEFER_TOTAL_CELLS,
  DEFER_LAST_BREP_MS,
} from './previewComplexity';
import { computeBaseplateTiling } from './splitPlanner';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';

function makeParams(overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams {
  return {
    width: 6,
    depth: 6,
    gridUnitMm: 42,
    magnetHoles: true,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    ...overrides,
  };
}

const defer = (p: ResolvedBaseplateParams, bed = 256, lastMs: number | null = null): boolean =>
  shouldDeferBrepPreview(computeBaseplateTiling(p, bed), p, lastMs);

describe('estimatePreviewComplexity', () => {
  it('counts a single unsplit plate as its own cells', () => {
    const p = makeParams({ width: 6, depth: 6 });
    const { maxPieceCells, totalCells } = estimatePreviewComplexity(
      computeBaseplateTiling(p, 256),
      p
    );
    expect(maxPieceCells).toBe(36);
    expect(totalCells).toBe(36);
  });

  it('rounds fractional edges up (a half-unit edge carries full edge work)', () => {
    const p = makeParams({ width: 5.5, depth: 4 });
    const { maxPieceCells } = estimatePreviewComplexity(computeBaseplateTiling(p, 256), p);
    expect(maxPieceCells).toBe(6 * 4);
  });

  it('keys off the deduped piece set, not every placement', () => {
    // A large square plate splits into many pieces. With square corners and no
    // connectors, edge labels don't affect geometry, so equal-sized pieces share
    // a fingerprint — total unique cells stays far below pieces × cells.
    const p = makeParams({ width: 18, depth: 18, cornerRadius: 0 });
    const tiling = computeBaseplateTiling(p, 256);
    const { totalCells } = estimatePreviewComplexity(tiling, p);
    const naiveTotal = tiling.pieces.reduce(
      (sum, pc) => sum + Math.ceil(pc.widthUnits) * Math.ceil(pc.depthUnits),
      0
    );
    expect(tiling.isSplit).toBe(true);
    expect(totalCells).toBeLessThan(naiveTotal);
  });
});

describe('shouldDeferBrepPreview', () => {
  it('never defers when magnets are off (BREP is fast without per-cell holes)', () => {
    expect(defer(makeParams({ width: 20, depth: 20, magnetHoles: false }))).toBe(false);
  });

  it('does not defer a small magnet plate (gets the exact preview)', () => {
    expect(defer(makeParams({ width: 6, depth: 6 }))).toBe(false);
  });

  it('does not defer bed-bounded split pieces (each piece stays small)', () => {
    // A 12×12 plate on a 256mm bed tiles into ~6×6 pieces — none large enough,
    // and the deduped total stays under budget.
    expect(defer(makeParams({ width: 12, depth: 12 }))).toBe(false);
  });

  it('defers a large single plate on a big custom bed', () => {
    // 10×10 fits a 460mm bed in one piece → 100 cells ≥ DEFER_MAX_PIECE_CELLS.
    const p = makeParams({ width: 10, depth: 10 });
    expect(estimatePreviewComplexity(computeBaseplateTiling(p, 460), p).maxPieceCells).toBe(100);
    expect(defer(p, 460)).toBe(true);
  });

  it('defers a many-piece tiling whose total unique work is large', () => {
    // A big square plate dedups but still sums past DEFER_TOTAL_CELLS.
    const p = makeParams({ width: 26, depth: 26 });
    const { maxPieceCells, totalCells } = estimatePreviewComplexity(
      computeBaseplateTiling(p, 256),
      p
    );
    expect(maxPieceCells).toBeLessThan(DEFER_MAX_PIECE_CELLS);
    expect(totalCells).toBeGreaterThanOrEqual(DEFER_TOTAL_CELLS);
    expect(defer(p)).toBe(true);
  });

  it('defers adaptively once a real BREP run on this machine was slow', () => {
    const p = makeParams({ width: 6, depth: 6 }); // small, would not defer statically
    expect(defer(p, 256, null)).toBe(false);
    expect(defer(p, 256, DEFER_LAST_BREP_MS + 1)).toBe(true);
  });
});
