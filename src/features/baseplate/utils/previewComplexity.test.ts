import { describe, it, expect } from 'vitest';
import {
  estimatePreviewComplexity,
  shouldDeferBrepPreview,
  shouldSkipManifoldDraft,
  DEFER_MAX_PIECE_CELLS,
  DEFER_TOTAL_CELLS,
  DEFER_LAST_BREP_MS,
} from './previewComplexity';
import { computeBaseplateTiling } from './splitPlanner';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { DrawerOutline } from '@/core/types';

/** A closed CCW rectangle outline spanning the plate's grid extent. */
function rectOutline(widthMm: number, depthMm: number): DrawerOutline {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: widthMm, y: 0 },
      { x: widthMm, y: depthMm },
      { x: 0, y: depthMm },
    ],
  };
}

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

  it('never defers a shaped (outlined) plate — it must run the exact BREP', () => {
    // The same 10×10 magnet plate that defers when rectangular, now shaped. The
    // direct-mesh is rectangles-only, so deferring would freeze a wrong preview;
    // shaped plates always run BREP even when otherwise over the cost threshold.
    expect(defer(makeParams({ width: 10, depth: 10 }), 460)).toBe(true);
    expect(defer(makeParams({ width: 10, depth: 10, outline: rectOutline(420, 420) }), 460)).toBe(
      false
    );
  });

  it('defers past the adaptive threshold only for rectangular plates, never shaped', () => {
    const shaped = makeParams({ width: 6, depth: 6, outline: rectOutline(252, 252) });
    expect(defer(shaped, 256, DEFER_LAST_BREP_MS + 1)).toBe(false);
  });
});

describe('shouldSkipManifoldDraft', () => {
  it('skips the draft for a shaped (outlined) plate — the draft duplicates the exact intersect', () => {
    expect(shouldSkipManifoldDraft(makeParams({ outline: rectOutline(252, 252) }))).toBe(true);
  });

  it('keeps the draft for a rectangular plate (no outline)', () => {
    expect(shouldSkipManifoldDraft(makeParams())).toBe(false);
  });
});
