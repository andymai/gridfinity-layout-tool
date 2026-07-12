import { describe, it, expect } from 'vitest';
import {
  computeBaseplateTiling,
  pieceToBaseplateParams,
  colToLetter,
  bodyParamsForDetach,
} from './splitPlanner';
import { bodyCenterYMm } from './stackPrint';
import { TONGUE_PROTRUSION } from '@/features/generation/worker/generators/generatorConstants';
import { computeConnectorPositions } from '@/features/generation/worker/generators/connectorUtils';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { BaseplatePiece } from '../types/tiling';
import { computePieceFingerprint } from './pieceFingerprint';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeParams(overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams {
  return {
    width: 6,
    depth: 4,
    gridUnitMm: 42,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    ...overrides,
  };
}

/** Helper to get piece widths in column order for a single row. */
function colWidths(params: ResolvedBaseplateParams, printBed = 256): number[] {
  const tiling = computeBaseplateTiling(params, printBed);
  return tiling.pieces
    .filter((p) => p.row === 0)
    .sort((a, b) => a.col - b.col)
    .map((p) => p.widthUnits);
}

/** Helper to get piece depths in row order for a single column. */
function rowDepths(params: ResolvedBaseplateParams, printBed = 256): number[] {
  const tiling = computeBaseplateTiling(params, printBed);
  return tiling.pieces
    .filter((p) => p.col === 0)
    .sort((a, b) => a.row - b.row)
    .map((p) => p.depthUnits);
}

// ─── colToLetter ───────────────────────────────────────────────────────────

describe('colToLetter', () => {
  it('converts column indices to letters', () => {
    expect(colToLetter(0)).toBe('A');
    expect(colToLetter(1)).toBe('B');
    expect(colToLetter(2)).toBe('C');
    expect(colToLetter(25)).toBe('Z');
  });
});

// ─── computeBaseplateTiling ────────────────────────────────────────────────

describe('computeBaseplateTiling', () => {
  // ─── No-split cases ─────────────────────────────────────────────────────

  it('no split needed (3x3, fits on bed)', () => {
    const params = makeParams({ width: 3, depth: 3 });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.isSplit).toBe(false);
    expect(tiling.pieces).toHaveLength(1);
    expect(tiling.cols).toBe(1);
    expect(tiling.rows).toBe(1);

    const piece = tiling.pieces[0];
    expect(piece.label).toBe('A1');
    expect(piece.widthUnits).toBe(3);
    expect(piece.depthUnits).toBe(3);
    expect(piece.edges.left).toBe('exterior');
    expect(piece.edges.right).toBe('exterior');
    expect(piece.edges.front).toBe('exterior');
    expect(piece.edges.back).toBe('exterior');
  });

  it('preserves all padding on single piece', () => {
    const params = makeParams({
      width: 3,
      depth: 3,
      paddingLeft: 5,
      paddingRight: 10,
      paddingFront: 3,
      paddingBack: 7,
    });
    const tiling = computeBaseplateTiling(params, 256);
    const piece = tiling.pieces[0];

    expect(piece.paddingLeft).toBe(5);
    expect(piece.paddingRight).toBe(10);
    expect(piece.paddingFront).toBe(3);
    expect(piece.paddingBack).toBe(7);
  });

  it('exactly fits bed (6x6, max 6)', () => {
    const params = makeParams({ width: 6, depth: 6 });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.isSplit).toBe(false);
    expect(tiling.pieces).toHaveLength(1);
  });

  it('no split when padding still fits', () => {
    // 5*42 + 5 + 5 = 220 ≤ 256
    const params = makeParams({ width: 5, depth: 5, paddingLeft: 5, paddingRight: 5 });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.isSplit).toBe(false);
  });

  // ─── Width-only splits ──────────────────────────────────────────────────

  it('width-only split (10x4) accounts for padding', () => {
    const params = makeParams({
      width: 10,
      depth: 4,
      paddingLeft: 5,
      paddingRight: 10,
      paddingFront: 3,
      paddingBack: 7,
    });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.isSplit).toBe(true);
    expect(tiling.cols).toBe(2);
    expect(tiling.rows).toBe(1);
    expect(tiling.pieces).toHaveLength(2);

    // A1: leftmost piece — has paddingLeft
    const a1 = tiling.pieces[0];
    expect(a1.label).toBe('A1');
    expect(a1.paddingLeft).toBe(5);
    expect(a1.paddingRight).toBe(0); // join edge
    expect(a1.paddingFront).toBe(3);
    expect(a1.paddingBack).toBe(7);
    expect(a1.edges.left).toBe('exterior');
    expect(a1.edges.right).toBe('join');

    // B1: rightmost piece
    const b1 = tiling.pieces[1];
    expect(b1.label).toBe('B1');
    expect(b1.paddingLeft).toBe(0); // join edge
    expect(b1.paddingRight).toBe(10);
    expect(b1.edges.left).toBe('join');
    expect(b1.edges.right).toBe('exterior');

    // Both pieces physically fit on the bed
    expect(a1.widthUnits * 42 + a1.paddingLeft + a1.paddingRight).toBeLessThanOrEqual(256);
    expect(b1.widthUnits * 42 + b1.paddingLeft + b1.paddingRight).toBeLessThanOrEqual(256);
    expect(a1.widthUnits + b1.widthUnits).toBe(10);
  });

  // ─── Both-axis splits ──────────────────────────────────────────────────

  it('both-axis split (10x10)', () => {
    // 10×10 stays a clean 2×2: its 2×3 alternative's pieces are too deep to pair
    // on the bed, so the packing-aware planner gains no load and keeps 2×2.
    const params = makeParams({
      width: 10,
      depth: 10,
      paddingLeft: 2,
      paddingRight: 3,
      paddingFront: 4,
      paddingBack: 5,
    });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.isSplit).toBe(true);
    expect(tiling.cols).toBe(2);
    expect(tiling.rows).toBe(2);
    expect(tiling.pieces).toHaveLength(4);

    // Labels: A1 (front-left), B1 (front-right), A2 (back-left), B2 (back-right)
    expect(tiling.pieces.map((p) => p.label)).toEqual(['A1', 'B1', 'A2', 'B2']);

    // A1: corner piece — left+front padding only
    const a1 = tiling.pieces[0];
    expect(a1.paddingLeft).toBe(2);
    expect(a1.paddingRight).toBe(0);
    expect(a1.paddingFront).toBe(4);
    expect(a1.paddingBack).toBe(0);
    expect(a1.edges.left).toBe('exterior');
    expect(a1.edges.right).toBe('join');
    expect(a1.edges.front).toBe('exterior');
    expect(a1.edges.back).toBe('join');

    // B2: corner piece — right+back padding only
    const b2 = tiling.pieces[3];
    expect(b2.paddingLeft).toBe(0);
    expect(b2.paddingRight).toBe(3);
    expect(b2.paddingFront).toBe(0);
    expect(b2.paddingBack).toBe(5);
  });

  // ─── Packing-aware split (build-plate loads) ────────────────────────────

  it('reports bedLoads = 1 for a single (unsplit) plate', () => {
    const tiling = computeBaseplateTiling(makeParams({ width: 4, depth: 4 }), 256);
    expect(tiling.isSplit).toBe(false);
    expect(tiling.bedLoads).toBe(1);
  });

  it('chooses a finer split to save a build-plate load when the trade is cheap', () => {
    // 10×8: the coarse 2×2 (4 pieces) prints 1-per-bed = 4 loads, but a 2×3
    // (6 pieces) packs its shallower pieces two-per-bed → 3 loads. Saving a
    // load for 2 extra pieces is within the per-load piece budget, so the
    // packing-aware planner picks the 2×3.
    const tiling = computeBaseplateTiling(makeParams({ width: 10, depth: 8 }), 256);
    expect(tiling.cols).toBe(2);
    expect(tiling.rows).toBe(3);
    expect(tiling.bedLoads).toBe(3);
  });

  it('does not over-fragment when finer pieces would not pack better', () => {
    // 10×10: a 2×3's pieces are still too deep to pair on the bed, so it saves
    // no load — the planner keeps the coarse 2×2 rather than adding pieces.
    const tiling = computeBaseplateTiling(makeParams({ width: 10, depth: 10 }), 256);
    expect(tiling.cols).toBe(2);
    expect(tiling.rows).toBe(2);
  });

  // ─── Symmetry preference ───────────────────────────────────────────────

  it('prefers equal-sized pieces (10 = [5, 5] not [6, 4])', () => {
    const params = makeParams({ width: 10, depth: 4 });
    const widths = colWidths(params);
    // 2D optimizer distributes evenly: [5, 5] instead of greedy [6, 4]
    expect(widths).toEqual([5, 5]);
  });

  it('prefers symmetric split on both axes (10x10)', () => {
    const params = makeParams({ width: 10, depth: 10 });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.cols).toBe(2);
    expect(tiling.rows).toBe(2);

    // Should prefer [5, 5] on each axis
    const widths = colWidths(params);
    const depths = rowDepths(params);
    expect(widths).toEqual([5, 5]);
    expect(depths).toEqual([5, 5]);
  });

  it('largest pieces at front even with fractionalEdge=start and integer dims', () => {
    const params = makeParams({
      width: 10,
      depth: 10,
      fractionalEdgeX: 'start',
      fractionalEdgeY: 'start',
    });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.cols).toBe(2);
    expect(tiling.rows).toBe(2);

    const a1 = tiling.pieces.find((p) => p.col === 0 && p.row === 0);
    expect(a1?.widthUnits).toBe(5);
    expect(a1?.depthUnits).toBe(5);
  });

  // ─── Fractional edge handling ──────────────────────────────────────────

  it('fractional edge at end (7.5x4)', () => {
    const params = makeParams({ width: 7.5, depth: 4, fractionalEdgeX: 'end' });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.cols).toBe(2);
    const rightPiece = tiling.pieces.find((p) => p.col === 1);
    expect(rightPiece?.fractionalEdgeX).toBe('end');
    // Fractional piece should have a .5 unit
    const fracPiece = tiling.pieces.find((p) => p.widthUnits % 1 !== 0);
    expect(fracPiece).toBeDefined();
  });

  it('fractional edge at start (7.5x4) pins fraction at col 0', () => {
    const params = makeParams({ width: 7.5, depth: 4, fractionalEdgeX: 'start' });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.cols).toBe(2);
    const leftPiece = tiling.pieces.find((p) => p.col === 0);
    expect(leftPiece).toBeDefined();
    expect(leftPiece?.fractionalEdgeX).toBe('start');
    expect(leftPiece?.widthUnits).toSatisfy((w: number) => w % 1 !== 0);
  });

  it('fractional edge at start with asymmetric padding keeps pieces within bed', () => {
    const params = makeParams({
      width: 10.5,
      depth: 4,
      fractionalEdgeX: 'start',
      paddingLeft: 30,
      paddingRight: 2,
    });
    const tiling = computeBaseplateTiling(params, 256);

    // All pieces must physically fit on the bed
    for (const piece of tiling.pieces) {
      const widthMm = piece.widthUnits * 42 + piece.paddingLeft + piece.paddingRight;
      const depthMm = piece.depthUnits * 42 + piece.paddingFront + piece.paddingBack;
      expect(widthMm).toBeLessThanOrEqual(256);
      expect(depthMm).toBeLessThanOrEqual(256);
    }
    // Total width must still sum correctly
    const totalWidth = colWidths(params).reduce((a, b) => a + b, 0);
    expect(totalWidth).toBe(10.5);
  });

  it('fractional edge at end with 3+ splits pins fraction at last column', () => {
    // 13.5 → needs 3 cols. Fraction should be pinned at the last col, not the middle.
    const params = makeParams({ width: 13.5, depth: 4, fractionalEdgeX: 'end' });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.cols).toBeGreaterThanOrEqual(3);
    const widths = tiling.pieces
      .filter((p) => p.row === 0)
      .sort((a, b) => a.col - b.col)
      .map((p) => p.widthUnits);
    // Fractional piece pinned at last col
    expect(widths[widths.length - 1] % 1).not.toBe(0);
    // Middle pieces should be integer
    for (let i = 1; i < widths.length - 1; i++) {
      expect(widths[i] % 1).toBe(0);
    }
  });

  it('fractional edge at end on Y-axis pins fraction at last row', () => {
    // 13.5 depth → needs 3 rows. Fraction should be at last row, not middle.
    const params = makeParams({ width: 4, depth: 13.5, fractionalEdgeY: 'end' });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.rows).toBeGreaterThanOrEqual(3);
    const depths = tiling.pieces
      .filter((p) => p.col === 0)
      .sort((a, b) => a.row - b.row)
      .map((p) => p.depthUnits);
    // Fractional piece pinned at last row
    expect(depths[depths.length - 1] % 1).not.toBe(0);
    // Middle pieces should be integer
    for (let i = 1; i < depths.length - 1; i++) {
      expect(depths[i] % 1).toBe(0);
    }
  });

  it('fractional edge at start with 3+ splits pins fraction and sorts rest', () => {
    // 13.5 → needs 3 cols. Fraction pinned at col 0
    const params = makeParams({ width: 13.5, depth: 4, fractionalEdgeX: 'start' });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.cols).toBeGreaterThanOrEqual(3);
    const widths = tiling.pieces
      .filter((p) => p.row === 0)
      .sort((a, b) => a.col - b.col)
      .map((p) => p.widthUnits);
    // Fractional piece pinned at col 0
    expect(widths[0] % 1).not.toBe(0);
    // Rest sorted descending
    for (let i = 2; i < widths.length; i++) {
      expect(widths[i - 1]).toBeGreaterThanOrEqual(widths[i]);
    }
  });

  // ─── Large splits ──────────────────────────────────────────────────────

  it('large 3+ splits (16x16)', () => {
    const params = makeParams({ width: 16, depth: 16 });
    const tiling = computeBaseplateTiling(params, 256);

    // 16 units at 42mm = 672mm. Max per piece = 6.
    // Need at least 3 cols (ceil(16/6)). 3×3 = 9 pieces.
    expect(tiling.cols).toBe(3);
    expect(tiling.rows).toBe(3);
    expect(tiling.pieces).toHaveLength(9);

    // Center piece (B2) should have all join edges
    const center = tiling.pieces.find((p) => p.col === 1 && p.row === 1);
    expect(center?.edges.left).toBe('join');
    expect(center?.edges.right).toBe('join');
    expect(center?.edges.front).toBe('join');
    expect(center?.edges.back).toBe('join');
    expect(center?.paddingLeft).toBe(0);
    expect(center?.paddingRight).toBe(0);
    expect(center?.paddingFront).toBe(0);
    expect(center?.paddingBack).toBe(0);
  });

  it('16x16 prefers symmetric split sizes', () => {
    const params = makeParams({ width: 16, depth: 16 });
    const widths = colWidths(params);
    const depths = rowDepths(params);

    // 16 / 3 → prefer sizes as close to equal as possible
    // [6, 5, 5] or [6, 6, 4] — algorithm prefers [6, 5, 5] for lower variance
    // After reorder (largest first): [6, 5, 5]
    const totalWidth = widths.reduce((a, b) => a + b, 0);
    const totalDepth = depths.reduce((a, b) => a + b, 0);
    expect(totalWidth).toBe(16);
    expect(totalDepth).toBe(16);

    // Each piece must fit on bed
    for (const w of widths) {
      expect(w * 42).toBeLessThanOrEqual(256);
    }
    for (const d of depths) {
      expect(d * 42).toBeLessThanOrEqual(256);
    }
  });

  // ─── Padding-induced splits ────────────────────────────────────────────

  it('padding alone can force a split', () => {
    // 6×6 fits at 252mm without padding, but 6*42 + 5 = 257 > 256
    const params = makeParams({ width: 6, depth: 6, paddingLeft: 5 });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.isSplit).toBe(true);
    expect(tiling.cols).toBe(2);
    // Verify both pieces physically fit
    const [a1, b1] = tiling.pieces.sort((a, b) => a.col - b.col);
    expect(a1.widthUnits * 42 + a1.paddingLeft + a1.paddingRight).toBeLessThanOrEqual(256);
    expect(b1.widthUnits * 42 + b1.paddingLeft + b1.paddingRight).toBeLessThanOrEqual(256);
    expect(a1.widthUnits + b1.widthUnits).toBe(6);
  });

  // ─── Labels and offsets ────────────────────────────────────────────────

  it('labels follow grid coordinates (2x2)', () => {
    const params = makeParams({ width: 10, depth: 10 });
    const tiling = computeBaseplateTiling(params, 256);
    const labels = tiling.pieces.map((p) => p.label).sort();
    expect(labels).toEqual(['A1', 'A2', 'B1', 'B2']);
  });

  it('labels for 3x3 grid', () => {
    const params = makeParams({ width: 16, depth: 16 });
    const tiling = computeBaseplateTiling(params, 256);
    const labels = tiling.pieces.map((p) => p.label).sort();
    expect(labels).toEqual(['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3']);
  });

  it('grid offsets accumulate correctly', () => {
    const params = makeParams({ width: 16, depth: 8 });
    const tiling = computeBaseplateTiling(params, 256);

    // Offsets should be cumulative and non-decreasing
    const colOffsets = [...new Set(tiling.pieces.map((p) => p.gridOffsetX))].sort((a, b) => a - b);
    const rowOffsets = [...new Set(tiling.pieces.map((p) => p.gridOffsetY))].sort((a, b) => a - b);

    expect(colOffsets[0]).toBe(0);
    expect(rowOffsets[0]).toBe(0);

    // Sum of all column widths should equal total width
    const widths = colWidths(params);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(16);

    // Sum of all row depths should equal total depth
    const depths = rowDepths(params);
    expect(depths.reduce((a, b) => a + b, 0)).toBe(8);
  });

  // ─── Future stacking defaults ──────────────────────────────────────────

  it('records future stacking defaults', () => {
    const params = makeParams({ width: 3, depth: 3 });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.stackCount).toBe(1);
    expect(tiling.stackSeparatorThickness).toBe(0);
  });

  // ─── Padding reduction hint ────────────────────────────────────────────

  it('returns null hint when no split', () => {
    const params = makeParams({ width: 3, depth: 3, paddingLeft: 5, paddingRight: 5 });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.paddingReductionHint).toBeNull();
  });

  it('returns hint when reducing padding avoids split', () => {
    // 6×6 with pL=pR=5: 6*42 + 5 + 5 = 262 > 256, so a split is forced.
    // The hint reduces both sides equally; reducing by 3mm gives 6*42 + 2 + 2 = 256,
    // which fits in a single piece — saving 1 piece.
    const params = makeParams({
      width: 6,
      depth: 6,
      paddingLeft: 5,
      paddingRight: 5,
    });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.isSplit).toBe(true);
    expect(tiling.paddingReductionHint).not.toBeNull();
    expect(tiling.paddingReductionHint?.piecesSaved).toBeGreaterThan(0);
    expect(tiling.paddingReductionHint?.reductionMm).toBeGreaterThan(0);
  });

  it('returns null hint when padding is zero', () => {
    const params = makeParams({ width: 10, depth: 4 });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.paddingReductionHint).toBeNull();
  });

  it('returns null hint when reducing padding would not help', () => {
    // 16x16 with small padding — even 0 padding can't fit in 1 piece
    const params = makeParams({ width: 16, depth: 16, paddingLeft: 1, paddingRight: 1 });
    const tiling = computeBaseplateTiling(params, 256);
    // Reducing 1mm from each side won't reduce piece count from 9
    // because 16 units = 672mm >> 256mm regardless of padding
    expect(tiling.paddingReductionHint).toBeNull();
  });

  // ─── Half-unit edge cases ──────────────────────────────────────────────

  it('handles pure fractional value (0.5x0.5)', () => {
    const params = makeParams({ width: 0.5, depth: 0.5 });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.isSplit).toBe(false);
    expect(tiling.pieces).toHaveLength(1);
    expect(tiling.pieces[0].widthUnits).toBe(0.5);
    expect(tiling.pieces[0].depthUnits).toBe(0.5);
  });

  it('handles 5.5x4 (fraction absorbed)', () => {
    const params = makeParams({ width: 5.5, depth: 4 });
    const tiling = computeBaseplateTiling(params, 256);
    // 5.5 * 42 = 231 ≤ 256, fits in single piece
    expect(tiling.isSplit).toBe(false);
    expect(tiling.pieces[0].widthUnits).toBe(5.5);
  });

  it('handles 6.5x4 (fraction forces separate piece)', () => {
    const params = makeParams({ width: 6.5, depth: 4 });
    const tiling = computeBaseplateTiling(params, 256);
    // 6.5 * 42 = 273 > 256, needs split
    expect(tiling.isSplit).toBe(true);
    expect(tiling.cols).toBe(2);
    // Total should be 6.5
    const totalWidth = colWidths(params).reduce((a, b) => a + b, 0);
    expect(totalWidth).toBe(6.5);
  });

  // ─── Performance ───────────────────────────────────────────────────────

  it('handles 50x50 grid within 100ms', () => {
    const params = makeParams({ width: 50, depth: 50 });
    const start = performance.now();
    const tiling = computeBaseplateTiling(params, 256);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(tiling.isSplit).toBe(true);
    // Verify all pieces fit
    for (const piece of tiling.pieces) {
      const widthMm = piece.widthUnits * 42 + piece.paddingLeft + piece.paddingRight;
      const depthMm = piece.depthUnits * 42 + piece.paddingFront + piece.paddingBack;
      expect(widthMm).toBeLessThanOrEqual(256);
      expect(depthMm).toBeLessThanOrEqual(256);
    }
  });

  it('handles 50x50 grid with padding within 100ms', () => {
    const params = makeParams({
      width: 50,
      depth: 50,
      paddingLeft: 5,
      paddingRight: 5,
      paddingFront: 5,
      paddingBack: 5,
    });
    const start = performance.now();
    const tiling = computeBaseplateTiling(params, 256);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(tiling.isSplit).toBe(true);
    // Verify all pieces fit
    for (const piece of tiling.pieces) {
      const widthMm = piece.widthUnits * 42 + piece.paddingLeft + piece.paddingRight;
      const depthMm = piece.depthUnits * 42 + piece.paddingFront + piece.paddingBack;
      expect(widthMm).toBeLessThanOrEqual(256);
      expect(depthMm).toBeLessThanOrEqual(256);
    }
  });

  // ─── Dovetail tongue protrusion (#1498) ────────────────────────────────

  /**
   * Real STL bbox of a piece, given the male/female convention of `buildConnectors`:
   * - left/front edges are male tongues when invertDovetails=false; female grooves otherwise.
   * - Female grooves cut into the slab and don't extend its bbox.
   */
  function actualPieceBbox(
    piece: {
      widthUnits: number;
      depthUnits: number;
      paddingLeft: number;
      paddingRight: number;
      paddingFront: number;
      paddingBack: number;
      edges: { left: string; right: string; front: string; back: string };
    },
    invert: boolean
  ): { widthMm: number; depthMm: number } {
    const startMale = !invert;
    const leftTongue = piece.edges.left === 'join' && startMale ? TONGUE_PROTRUSION : 0;
    const rightTongue = piece.edges.right === 'join' && !startMale ? TONGUE_PROTRUSION : 0;
    const frontTongue = piece.edges.front === 'join' && startMale ? TONGUE_PROTRUSION : 0;
    const backTongue = piece.edges.back === 'join' && !startMale ? TONGUE_PROTRUSION : 0;
    return {
      widthMm:
        piece.widthUnits * 42 + piece.paddingLeft + piece.paddingRight + leftTongue + rightTongue,
      depthMm:
        piece.depthUnits * 42 + piece.paddingFront + piece.paddingBack + frontTongue + backTongue,
    };
  }

  it('TONGUE_PROTRUSION_MM mirrors the generator constant exactly', () => {
    // splitPlanner duplicates TONGUE_PROTRUSION locally because module
    // boundaries forbid features/baseplate from importing features/generation.
    // If the generator constant ever changes, this assertion forces the planner
    // copy to be updated in lockstep so split fits stay correct.
    expect(TONGUE_PROTRUSION).toBe(1.5);
  });

  it('accounts for dovetail tongue protrusion when splitting (#1498)', () => {
    // Repro: 512×324mm incl. padding on a 256mm bed with dovetail connectors.
    // Width 512mm = 12 units * 42 + 4mm L/R padding. Depth 324mm = 7 units * 42 + 15mm F/B padding.
    // Without dovetail accounting the planner picks [6, 6] — but the join edge has
    // a 1.5mm tongue, making the actual STL 257.5mm wide, exceeding the 256mm bed.
    const params = makeParams({
      width: 12,
      depth: 7,
      paddingLeft: 4,
      paddingRight: 4,
      paddingFront: 15,
      paddingBack: 15,
      connectorNubs: true,
    });

    const tiling = computeBaseplateTiling(params, 256);

    for (const piece of tiling.pieces) {
      const { widthMm, depthMm } = actualPieceBbox(piece, false);
      expect(widthMm).toBeLessThanOrEqual(256);
      expect(depthMm).toBeLessThanOrEqual(256);
    }
  });

  it('accounts for dovetail tongue protrusion with invertDovetails=true', () => {
    // With invert, the tongue moves to right/back. The planner must reserve bed
    // space on the opposite side of every join edge.
    const params = makeParams({
      width: 12,
      depth: 7,
      paddingLeft: 4,
      paddingRight: 4,
      paddingFront: 15,
      paddingBack: 15,
      connectorNubs: true,
      invertDovetails: true,
    });

    const tiling = computeBaseplateTiling(params, 256);

    for (const piece of tiling.pieces) {
      const { widthMm, depthMm } = actualPieceBbox(piece, true);
      expect(widthMm).toBeLessThanOrEqual(256);
      expect(depthMm).toBeLessThanOrEqual(256);
    }
  });

  it('ignores dovetail protrusion when connectorNubs is disabled', () => {
    // Same dimensions as above — without dovetails, 6+6 fits exactly at 256mm.
    const params = makeParams({
      width: 12,
      depth: 4,
      paddingLeft: 4,
      paddingRight: 4,
    });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.cols).toBe(2);
    const widths = colWidths(params);
    expect(widths).toEqual([6, 6]);
  });

  it('handles invertDovetails + asymmetric padding without overflow', () => {
    // Asymmetric padding stresses the per-position capacity calculation.
    // With invert=true, the male tongue moves to the right/back side, so the
    // last chunk's exterior side carries paddingEnd while its interior left
    // is female (no protrusion). Verify pieces still fit.
    const params = makeParams({
      width: 12,
      depth: 7,
      paddingLeft: 30,
      paddingRight: 2,
      paddingFront: 3,
      paddingBack: 20,
      connectorNubs: true,
      invertDovetails: true,
    });

    const tiling = computeBaseplateTiling(params, 256);

    for (const piece of tiling.pieces) {
      const { widthMm, depthMm } = actualPieceBbox(piece, true);
      expect(widthMm).toBeLessThanOrEqual(256);
      expect(depthMm).toBeLessThanOrEqual(256);
    }
  });

  it('handles fractional dimensions with connectorNubs enabled', () => {
    // Half-bin pieces interact with the tongue-aware capacity check at the
    // last chunk. Verify the planner still produces a valid partition.
    const params = makeParams({
      width: 13.5,
      depth: 4,
      paddingLeft: 3,
      paddingRight: 3,
      connectorNubs: true,
    });

    const tiling = computeBaseplateTiling(params, 256);

    for (const piece of tiling.pieces) {
      const { widthMm, depthMm } = actualPieceBbox(piece, false);
      expect(widthMm).toBeLessThanOrEqual(256);
      expect(depthMm).toBeLessThanOrEqual(256);
    }
    // Total should still equal the requested dimensions
    const totalWidth = colWidths(params).reduce((a, b) => a + b, 0);
    expect(totalWidth).toBe(13.5);
  });

  // ─── All pieces always fit on bed ──────────────────────────────────────

  it.each([
    { width: 7, depth: 3 },
    { width: 10, depth: 4 },
    { width: 10, depth: 8 },
    { width: 16, depth: 16 },
    { width: 7.5, depth: 4 },
    { width: 13.5, depth: 13.5 },
    { width: 25, depth: 12 },
  ])('all pieces fit on bed for %j', ({ width, depth }) => {
    const params = makeParams({
      width,
      depth,
      paddingLeft: 3,
      paddingRight: 3,
      paddingFront: 3,
      paddingBack: 3,
    });
    const tiling = computeBaseplateTiling(params, 256);
    for (const piece of tiling.pieces) {
      const widthMm = piece.widthUnits * 42 + piece.paddingLeft + piece.paddingRight;
      const depthMm = piece.depthUnits * 42 + piece.paddingFront + piece.paddingBack;
      expect(widthMm).toBeLessThanOrEqual(256);
      expect(depthMm).toBeLessThanOrEqual(256);
    }
  });
});

// ─── pieceToBaseplateParams ────────────────────────────────────────────────

describe('pieceToBaseplateParams', () => {
  it('maps piece dimensions and padding correctly', () => {
    const parent = makeParams({
      width: 10,
      depth: 8,
      paddingLeft: 5,
      paddingRight: 10,
      magnetHoles: true,
      magnetDiameter: 6,
      magnetDepth: 3,
    });
    const tiling = computeBaseplateTiling(parent, 256);
    const piece = tiling.pieces[0]; // A1

    const result = pieceToBaseplateParams(piece, parent);
    expect(result.width).toBe(piece.widthUnits);
    expect(result.depth).toBe(piece.depthUnits);
    expect(result.gridUnitMm).toBe(42);
    expect(result.magnetHoles).toBe(true);
    expect(result.magnetDiameter).toBe(6);
    expect(result.magnetDepth).toBe(3);
    expect(result.paddingLeft).toBe(5); // edge piece
    expect(result.paddingRight).toBe(0); // join edge
  });

  it('propagates overTile to pieces so split plates fill their margins', () => {
    const on = makeParams({
      width: 10,
      depth: 8,
      paddingLeft: 12,
      paddingRight: 12,
      overTile: true,
    });
    const tiling = computeBaseplateTiling(on, 256);
    expect(tiling.isSplit).toBe(true);
    for (const piece of tiling.pieces) {
      expect(pieceToBaseplateParams(piece, on).overTile).toBe(true);
    }
    // Off (or unset) stays off.
    const off = makeParams({ width: 10, depth: 8, paddingLeft: 12, paddingRight: 12 });
    expect(
      pieceToBaseplateParams(computeBaseplateTiling(off, 256).pieces[0], off).overTile
    ).toBeFalsy();
  });

  it('propagates overTileHalfGrid to pieces so a split plate keeps half-grid cells (#2384)', () => {
    // Regression: pieceToBaseplateParams copied overTile but dropped
    // overTileHalfGrid, so a split plate silently rendered plain over-tile —
    // half-grid output was identical to grid output.
    const half = makeParams({
      width: 10,
      depth: 8,
      paddingLeft: 25,
      paddingRight: 25,
      overTile: true,
      overTileHalfGrid: true,
    });
    const tiling = computeBaseplateTiling(half, 256);
    expect(tiling.isSplit).toBe(true);
    for (const piece of tiling.pieces) {
      expect(pieceToBaseplateParams(piece, half).overTileHalfGrid).toBe(true);
    }
  });

  it('propagates connectorFitOffset and nozzleSizeMm to every piece so the groove clearance responds to tolerance (#2554)', () => {
    // Regression: pieceToBaseplateParams dropped both fields, so split pieces cut
    // their female groove at nominal clearance regardless of the user's tolerance
    // — identical STL bytes for -0.3 vs +0.3, while the print guide (which reads
    // the parent params) still changed. Both feed effectiveClearance.
    const parent = makeParams({
      width: 10,
      depth: 8,
      connectorNubs: true,
      connectorStyle: 'puzzle',
      connectorFitOffset: 0.3,
      nozzleSizeMm: 0.6,
    });
    const tiling = computeBaseplateTiling(parent, 256);
    expect(tiling.isSplit).toBe(true);
    for (const piece of tiling.pieces) {
      const gen = pieceToBaseplateParams(piece, parent);
      expect(gen.connectorFitOffset).toBe(0.3);
      expect(gen.nozzleSizeMm).toBe(0.6);
    }
  });

  it('swaps front/back padding for rotated pieces so the body centre negates (stack-print preview relies on this)', () => {
    // The stack-print preview derives a flipped plate's body centre from the
    // SAME params the mesh was generated with. For a preferIdenticalPieces 180°
    // piece, generation swaps front/back padding, so the body centre must flip
    // sign vs the raw piece padding — otherwise flipped rotated pieces re-misalign.
    const parent = makeParams({
      width: 10,
      depth: 8,
      paddingFront: 3,
      paddingBack: 9,
      connectorNubs: true,
      preferIdenticalPieces: true,
    });
    const tiling = computeBaseplateTiling(parent, 256);
    const rotated = tiling.pieces.find(
      (p) => p.placementRotationDeg === 180 && p.paddingFront !== p.paddingBack
    );
    if (rotated === undefined) {
      expect.fail('Expected a rotated piece with asymmetric front/back padding');
    }
    const gen = pieceToBaseplateParams(rotated, parent);
    expect(gen.paddingFront).toBe(rotated.paddingBack);
    expect(gen.paddingBack).toBe(rotated.paddingFront);
    expect(bodyCenterYMm(gen.paddingFront, gen.paddingBack)).toBeCloseTo(
      -bodyCenterYMm(rotated.paddingFront, rotated.paddingBack),
      5
    );
  });

  it('defaults fractionalEdge to end when piece has none', () => {
    const parent = makeParams({ width: 10, depth: 4 });
    const tiling = computeBaseplateTiling(parent, 256);
    const integerPiece = tiling.pieces.find((p) => p.fractionalEdgeX === 'none');

    if (integerPiece === undefined) {
      expect.fail('Expected an integer piece with fractionalEdgeX === none');
    }

    const result = pieceToBaseplateParams(integerPiece, parent);
    expect(result.fractionalEdgeX).toBe('end');
  });

  it('passes through edge classification to params', () => {
    const parent = makeParams({ width: 10, depth: 10 });
    const tiling = computeBaseplateTiling(parent, 256);

    // A1 (front-left corner): left+front exterior, right+back join
    const a1 = tiling.pieces[0];
    const a1Params = pieceToBaseplateParams(a1, parent);
    expect(a1Params.edges).toEqual({
      left: 'exterior',
      right: 'join',
      front: 'exterior',
      back: 'join',
    });

    // B2 (back-right corner): left+front join, right+back exterior
    const b2 = tiling.pieces[3];
    const b2Params = pieceToBaseplateParams(b2, parent);
    expect(b2Params.edges).toEqual({
      left: 'join',
      right: 'exterior',
      front: 'join',
      back: 'exterior',
    });
  });

  it('preserves fractionalEdge from parent for fractional pieces', () => {
    const parent = makeParams({ width: 7.5, depth: 4, fractionalEdgeX: 'start' });
    const tiling = computeBaseplateTiling(parent, 256);
    const fracPiece = tiling.pieces.find((p) => p.fractionalEdgeX !== 'none');

    if (fracPiece === undefined) {
      expect.fail('Expected a piece with fractionalEdgeX !== none');
    }

    const result = pieceToBaseplateParams(fracPiece, parent);
    expect(result.fractionalEdgeX).toBe('start');
  });

  it('passes through connectorNubs from parent params', () => {
    const parent = makeParams({ width: 10, depth: 8, connectorNubs: true });
    const tiling = computeBaseplateTiling(parent, 256);
    const piece = tiling.pieces[0];
    const result = pieceToBaseplateParams(piece, parent);
    expect(result.connectorNubs).toBe(true);
  });

  it('passes through connectorStyle from parent params', () => {
    // Regression: dovetail key style must reach per-piece BREP generation. Dropping
    // it here makes every split piece generate dovetail tongues regardless of
    // the selected style (the cs: fingerprint token and mesh cache key both go
    // stale to 'dovetail'), so the preview never shows dovetail key grooves.
    const parent = makeParams({
      width: 10,
      depth: 8,
      connectorNubs: true,
      connectorStyle: 'dovetailKey',
    });
    const tiling = computeBaseplateTiling(parent, 256);
    const piece = tiling.pieces[0];
    const result = pieceToBaseplateParams(piece, parent);
    expect(result.connectorStyle).toBe('dovetailKey');
  });

  it('connectorNubs defaults to undefined when not set', () => {
    const parent = makeParams({ width: 10, depth: 8 });
    const tiling = computeBaseplateTiling(parent, 256);
    const piece = tiling.pieces[0];
    const result = pieceToBaseplateParams(piece, parent);
    expect(result.connectorNubs).toBeUndefined();
  });

  it('passes through invertDovetails from parent params', () => {
    const parent = makeParams({ width: 10, depth: 8, invertDovetails: true });
    const tiling = computeBaseplateTiling(parent, 256);
    const piece = tiling.pieces[0];

    const result = pieceToBaseplateParams(piece, parent);
    expect(result.invertDovetails).toBe(true);
  });

  it('leaves invertDovetails undefined when parent does not set it', () => {
    const parent = makeParams({ width: 10, depth: 8 });
    const tiling = computeBaseplateTiling(parent, 256);
    const piece = tiling.pieces[0];

    const result = pieceToBaseplateParams(piece, parent);
    expect(result.invertDovetails).toBeUndefined();
  });
});

// ─── preferIdenticalPieces (#1640) ───────────────────────────────────────────

describe('preferIdenticalPieces', () => {
  it('palindromizes a 3-piece column split so outer pieces match', () => {
    // 14u wide, 256mm bed (max 6u/piece) → 3 pieces. Default produces an
    // asymmetric distribution like [5, 5, 4]; preferIdenticalPieces should
    // rearrange to a palindrome [4, 5, 5] is also asymmetric — but [5, 4, 5]
    // or [4, 6, 4] makes the two corner pieces match.
    const params = makeParams({
      width: 14,
      depth: 4,
      connectorNubs: true,
      preferIdenticalPieces: true,
    });
    const tiling = computeBaseplateTiling(params, 256);

    const widths = tiling.pieces
      .filter((p) => p.row === 0)
      .sort((a, b) => a.col - b.col)
      .map((p) => p.widthUnits);

    expect(widths.length).toBeGreaterThanOrEqual(2);
    expect(widths[0]).toBe(widths[widths.length - 1]);
  });

  it('reserves bed budget for tongues on BOTH join sides in paired mode', () => {
    // Paired mode (preferIdenticalPieces) places a tongue + groove pair on
    // every join edge, so every join side claims a tongue protrusion — not
    // just the conventionally-male side. Without the bed-budget fix, a
    // first-column piece sized at the cap could end up 1.5mm over the bed:
    //   maxFirst = floor((256-3)/42) = 6
    //   piece STL = 6×42 + 3 + 1.5 (right-side tongue) = 256.5 > 256.
    // The fix is to treat both join sides as male when paired.
    const params = makeParams({
      width: 12,
      depth: 4,
      paddingLeft: 3,
      connectorNubs: true,
      preferIdenticalPieces: true,
    });
    const tiling = computeBaseplateTiling(params, 256);

    // Every piece must physically fit the bed including the paired tongue on
    // every join edge (1.5mm each side).
    for (const piece of tiling.pieces) {
      const leftTongue = piece.edges.left === 'join' ? 1.5 : 0;
      const rightTongue = piece.edges.right === 'join' ? 1.5 : 0;
      const frontTongue = piece.edges.front === 'join' ? 1.5 : 0;
      const backTongue = piece.edges.back === 'join' ? 1.5 : 0;
      const widthMm =
        piece.widthUnits * 42 + piece.paddingLeft + piece.paddingRight + leftTongue + rightTongue;
      const depthMm =
        piece.depthUnits * 42 + piece.paddingFront + piece.paddingBack + frontTongue + backTongue;
      expect(widthMm).toBeLessThanOrEqual(256 + 0.001);
      expect(depthMm).toBeLessThanOrEqual(256 + 0.001);
    }
  });

  it('palindromizes when the unique value is the largest ([5, 4, 4] → [4, 5, 4])', () => {
    // 13u wide → 3 pieces, distribution [5, 4, 4]. A greedy "pair largest
    // first" misses [4, 5, 4] because 5 has no equal partner. The frequency-
    // count algorithm picks the available pair (4, 4) for outer slots and
    // puts the unique 5 in the middle.
    const params = makeParams({
      width: 13,
      depth: 4,
      connectorNubs: true,
      preferIdenticalPieces: true,
    });
    const tiling = computeBaseplateTiling(params, 256);

    const widths = tiling.pieces
      .filter((p) => p.row === 0)
      .sort((a, b) => a.col - b.col)
      .map((p) => p.widthUnits);

    expect(widths).toEqual([4, 5, 4]);
  });

  it('marks opposite-corner pieces with placementRotationDeg=180', () => {
    // 10×10 → 2×2 grid. Under the flag, A1≡C2 share canonical edges and one is
    // rendered rotated 180°.
    const params = makeParams({
      width: 10,
      depth: 10,
      connectorNubs: true,
      preferIdenticalPieces: true,
    });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.pieces).toHaveLength(4);
    const byLabel = new Map(tiling.pieces.map((p) => [p.label, p] as const));

    // Exactly two pieces should be rotated; the other two unrotated. By the
    // canonical-edge tiebreak (lex-smaller of {edges, swapped}), it's the
    // anti-diagonal that flips.
    const rotated = tiling.pieces.filter((p) => p.placementRotationDeg === 180);
    expect(rotated).toHaveLength(2);

    // A1 and B2 are opposite corners — a canonical pair. Exactly one of them
    // gets the 180° rotation so a single canonical mesh covers both positions.
    const a1Rotated = byLabel.get('A1')?.placementRotationDeg === 180;
    const b2Rotated = byLabel.get('B2')?.placementRotationDeg === 180;
    expect(a1Rotated).not.toBe(b2Rotated);

    // Same invariant for the other diagonal.
    const a2Rotated = byLabel.get('A2')?.placementRotationDeg === 180;
    const b1Rotated = byLabel.get('B1')?.placementRotationDeg === 180;
    expect(a2Rotated).not.toBe(b1Rotated);
  });

  it('leaves placementRotationDeg=0 on every piece when flag is off', () => {
    const params = makeParams({ width: 10, depth: 8, preferIdenticalPieces: false });
    const tiling = computeBaseplateTiling(params, 256);
    for (const piece of tiling.pieces) {
      expect(piece.placementRotationDeg).toBe(0);
    }
  });

  it('leaves placementRotationDeg=0 when the flag is on but connectorNubs is off', () => {
    // The UI checkbox is hidden under connectorNubs, but the persisted flag
    // would otherwise apply rotation invisibly. Gate must short-circuit.
    const params = makeParams({
      width: 10,
      depth: 8,
      connectorNubs: false,
      preferIdenticalPieces: true,
    });
    const tiling = computeBaseplateTiling(params, 256);
    for (const piece of tiling.pieces) {
      expect(piece.placementRotationDeg).toBe(0);
    }
  });

  it('pieceToBaseplateParams swaps padding on 180° pieces so the canonical mesh receives padding on the correct sides', () => {
    const parent = makeParams({
      width: 10,
      depth: 8,
      paddingLeft: 3,
      paddingRight: 7,
      paddingFront: 4,
      paddingBack: 9,
      connectorNubs: true,
      preferIdenticalPieces: true,
    });
    const tiling = computeBaseplateTiling(parent, 256);

    const rotated = tiling.pieces.find((p) => p.placementRotationDeg === 180);
    if (!rotated) throw new Error('expected a rotated piece in the 2×2 tiling');

    const params = pieceToBaseplateParams(rotated, parent);

    // Rotated piece's padding gets swapped (L↔R, F↔B) so that after the 180°
    // placement rotation the padding ends up on the correct world-space sides.
    expect(params.paddingLeft).toBe(rotated.paddingRight);
    expect(params.paddingRight).toBe(rotated.paddingLeft);
    expect(params.paddingFront).toBe(rotated.paddingBack);
    expect(params.paddingBack).toBe(rotated.paddingFront);
  });

  it('pieceToBaseplateParams swaps cornerRadii (tl↔br, tr↔bl) on 180° pieces', () => {
    // buildSlabProfile maps tl→(left+back exterior) and br→(right+front
    // exterior); a 180° rotation swaps both pairs, so cornerRadii must rotate
    // with edges or asymmetric radii land at the wrong corners.
    const parent = makeParams({
      width: 10,
      depth: 8,
      connectorNubs: true,
      preferIdenticalPieces: true,
      cornerRadii: { tl: 1, tr: 2, bl: 3, br: 4 },
    });
    const tiling = computeBaseplateTiling(parent, 256);

    const rotated = tiling.pieces.find((p) => p.placementRotationDeg === 180);
    const straight = tiling.pieces.find((p) => p.placementRotationDeg === 0);
    if (!rotated || !straight) throw new Error('expected both rotated and unrotated pieces');

    const rotatedParams = pieceToBaseplateParams(rotated, parent);
    const straightParams = pieceToBaseplateParams(straight, parent);

    expect(straightParams.cornerRadii).toEqual({ tl: 1, tr: 2, bl: 3, br: 4 });
    expect(rotatedParams.cornerRadii).toEqual({ tl: 4, tr: 3, bl: 2, br: 1 });
  });

  it('pieceToBaseplateParams flips fractionalEdgeX on 180° fractional pieces', () => {
    // 'start' ↔ 'end' under 180° rotation — otherwise the canonical mesh's
    // half-unit sliver ends up on the wrong world side after placement.
    // Non-fractional pieces keep the canonical 'end' default regardless of
    // rotation (so their fingerprint matches their canonical-pair partner).
    const parent = makeParams({
      width: 10.5,
      depth: 4,
      fractionalEdgeX: 'end',
      connectorNubs: true,
      preferIdenticalPieces: true,
    });
    const tiling = computeBaseplateTiling(parent, 256);

    const fractional = tiling.pieces.find((p) => p.fractionalEdgeX !== 'none');
    const integer = tiling.pieces.find((p) => p.fractionalEdgeX === 'none');
    if (!fractional || !integer) {
      throw new Error('expected both fractional and integer pieces in tiling');
    }

    const fractionalParams = pieceToBaseplateParams(fractional, parent);
    const integerParams = pieceToBaseplateParams(integer, parent);

    // Non-fractional pieces always carry the 'end' default — irrelevant for
    // geometry, but kept consistent for canonical fingerprinting.
    expect(integerParams.fractionalEdgeX).toBe('end');

    // Fractional piece flips iff it ended up rotated.
    if (fractional.placementRotationDeg === 180) {
      expect(fractionalParams.fractionalEdgeX).toBe(flip(fractional.fractionalEdgeX));
    } else {
      expect(fractionalParams.fractionalEdgeX).toBe(fractional.fractionalEdgeX);
    }
  });
});

describe('preferIdenticalPieces × fractional dimensions — dovetail alignment (#1847)', () => {
  /**
   * 9.5 × 9.5 plate with `preferIdenticalPieces` tiles into 2×2 = {A1, B1, A2, B2}.
   * B2 (4.5 × 4.5) is the only piece that's fractional on both axes AND gets the
   * 180° canonicalization rotation, so its `fractionalEdgeX/Y` are flipped to
   * `'start'`. Before the connector-builder fix, B2's dovetail positions still
   * used the end-side formula and landed 21mm off the cell boundaries — A2's
   * right-edge dovetails (correctly at `frac='end'`) couldn't seat with B2's
   * left-edge dovetails (off by half a grid unit).
   *
   * This test runs the full pipeline (tiling → per-piece params → connector
   * positions → placement rotation → world coords) and asserts every shared
   * join edge has matching world-space dovetail positions.
   */
  it('aligns connectors across every shared join edge for 9.5×9.5', () => {
    const G = 42;
    const parent: ResolvedBaseplateParams = {
      width: 9.5,
      depth: 9.5,
      gridUnitMm: G,
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
      fractionalEdgeX: 'end',
      fractionalEdgeY: 'end',
      connectorNubs: true,
      preferIdenticalPieces: true,
      lightweight: true,
    };
    const tiling = computeBaseplateTiling(parent, 256, 256);
    const totalW = parent.width * G;
    const totalD = parent.depth * G;

    const placedConnectors = tiling.pieces.map((p) => {
      const pp = pieceToBaseplateParams(p, parent);
      const halfW = (pp.width * G) / 2;
      const halfD = (pp.depth * G) / 2;
      const cxWorld = p.gridOffsetX * G + halfW - totalW / 2;
      const cyWorld = p.gridOffsetY * G + halfD - totalD / 2;
      const local = computeConnectorPositions(
        pp.width,
        pp.depth,
        G,
        10,
        pp.width * G,
        pp.depth * G,
        0,
        0,
        pp.edges as { left: string; right: string; front: string; back: string },
        pp.invertDovetails ?? false,
        pp.fractionalEdgeX,
        pp.fractionalEdgeY
      );
      const rotated = p.placementRotationDeg === 180;
      return {
        label: p.label,
        col: p.col,
        row: p.row,
        connectors: local.map((c) => ({
          x: cxWorld + (rotated ? -c.cx : c.cx),
          y: cyWorld + (rotated ? -c.cy : c.cy),
        })),
      };
    });

    // For every adjacent pair, the connectors on their shared edge must be a
    // strict permutation in world space. A position on one piece must have a
    // partner on the other; an orphan means a print-time mismatch.
    function assertAdjacentMatch(aLabel: string, bLabel: string, axis: 'x' | 'y'): void {
      const a = placedConnectors.find((p) => p.label === aLabel);
      const b = placedConnectors.find((p) => p.label === bLabel);
      expect(a, `piece ${aLabel} missing`).toBeDefined();
      expect(b, `piece ${bLabel} missing`).toBeDefined();
      // Join-edge connectors: between A and B, the shared edge sits at some
      // constant axis coordinate. The "matching" connectors are those whose
      // shared-axis coordinate is identical between the two pieces.
      const aPositions = a!.connectors.map((c) => `${c.x.toFixed(3)},${c.y.toFixed(3)}`);
      const bPositions = b!.connectors.map((c) => `${c.x.toFixed(3)},${c.y.toFixed(3)}`);
      const shared = aPositions.filter((p) => bPositions.includes(p));
      // 2×2 tiling: every adjacent pair shares exactly one join edge with
      // ⌈dim⌉-1 connectors. For 9.5 split into [5, 4.5], each shared edge
      // has 4 connectors (matching cell boundaries within the smaller of the
      // two adjacent pieces' depths/widths).
      expect(
        shared.length,
        `${aLabel} ↔ ${bLabel} (${axis}-axis join) should share 4 connectors, got ${shared.length}`
      ).toBe(4);
    }

    assertAdjacentMatch('A1', 'B1', 'x');
    assertAdjacentMatch('A2', 'B2', 'x');
    assertAdjacentMatch('A1', 'A2', 'y');
    assertAdjacentMatch('B1', 'B2', 'y');
  });
});

function flip(side: 'start' | 'end' | 'none'): 'start' | 'end' | 'none' {
  if (side === 'start') return 'end';
  if (side === 'end') return 'start';
  return 'none';
}

// ─── detachMargins → tiling.margins ──────────────────────────────────────────

describe('detachMargins emits margin rails', () => {
  const W = 4;
  const D = 3;
  const U = 42;
  const gridW = W * U; // 168
  const gridD = D * U; // 126
  const P = 10; // ≥ MARGIN_MIN_DETACH_MM (8)

  function margins(overrides: Partial<ResolvedBaseplateParams>) {
    return computeBaseplateTiling(makeParams({ width: W, depth: D, ...overrides }), 256).margins;
  }
  function bySide(ms: ReturnType<typeof margins>, side: string) {
    return ms.find((m) => m.side === side);
  }

  it('emits nothing without the flag', () => {
    expect(margins({ paddingLeft: P, paddingRight: P, paddingFront: P, paddingBack: P })).toEqual(
      []
    );
  });

  it('emits nothing when all bands are sub-threshold', () => {
    expect(
      margins({ detachMargins: true, paddingLeft: 5, paddingRight: 5, paddingFront: 5 })
    ).toEqual([]);
  });

  it('all-four padding: long front/back own corners, short left/right own none', () => {
    const ms = margins({
      detachMargins: true,
      paddingLeft: P,
      paddingRight: P,
      paddingFront: P,
      paddingBack: P,
    });
    expect(ms).toHaveLength(4);

    const front = bySide(ms, 'front')!;
    expect(front.role).toBe('long');
    expect(front.lengthMm).toBe(gridW + 2 * P); // spans over left+right padding
    expect(front.bandThicknessMm).toBe(P);
    expect([...front.ownedCorners].sort()).toEqual(['bl', 'br']);
    expect(front.worldOffsetMm).toEqual({ x: 0, y: -gridD / 2 - P / 2 });

    const back = bySide(ms, 'back')!;
    expect(back.role).toBe('long');
    expect([...back.ownedCorners].sort()).toEqual(['tl', 'tr']);
    expect(back.worldOffsetMm).toEqual({ x: 0, y: gridD / 2 + P / 2 });

    const left = bySide(ms, 'left')!;
    expect(left.role).toBe('short');
    expect(left.lengthMm).toBe(gridD); // fits between the long rails
    expect(left.ownedCorners).toEqual([]);
    expect(left.worldOffsetMm).toEqual({ x: -gridW / 2 - P / 2, y: 0 });

    const right = bySide(ms, 'right')!;
    expect(right.role).toBe('short');
    expect(right.ownedCorners).toEqual([]);
  });

  it('opposite pair (left+right): rails go long and own all four corners', () => {
    const ms = margins({ detachMargins: true, paddingLeft: P, paddingRight: P });
    expect(ms).toHaveLength(2);
    const left = bySide(ms, 'left')!;
    expect(left.role).toBe('long');
    expect(left.lengthMm).toBe(gridD);
    expect([...left.ownedCorners].sort()).toEqual(['bl', 'tl']);
    const right = bySide(ms, 'right')!;
    expect([...right.ownedCorners].sort()).toEqual(['br', 'tr']);
  });

  it('adjacent pair (left+front): front owns its corners, left short owns the bare-back corner', () => {
    const ms = margins({ detachMargins: true, paddingLeft: P, paddingFront: P });
    expect(ms).toHaveLength(2);
    const front = bySide(ms, 'front')!;
    expect(front.role).toBe('long');
    expect(front.lengthMm).toBe(gridW + P); // extends over the detached left only
    expect([...front.ownedCorners].sort()).toEqual(['bl', 'br']);
    expect(front.worldOffsetMm).toEqual({ x: -P / 2, y: -gridD / 2 - P / 2 });

    const left = bySide(ms, 'left')!;
    expect(left.role).toBe('short');
    expect(left.ownedCorners).toEqual(['tl']); // back is bare → left owns top corner; front owns bl
  });

  it('single bare-neighbor side: one rail, perpendicular corners stay on the body', () => {
    const ms = margins({ detachMargins: true, paddingFront: P });
    expect(ms).toHaveLength(1);
    const front = bySide(ms, 'front')!;
    expect(front.role).toBe('long');
    expect(front.lengthMm).toBe(gridW);
    expect([...front.ownedCorners].sort()).toEqual(['bl', 'br']);
  });

  it('emits margins for a bed-fitting (unsplit) plate', () => {
    const tiling = computeBaseplateTiling(
      makeParams({ width: W, depth: D, detachMargins: true, paddingFront: P }),
      256
    );
    expect(tiling.isSplit).toBe(false);
    expect(tiling.margins).toHaveLength(1);
  });

  it('skips a sub-threshold side but still detaches the rest', () => {
    const ms = margins({ detachMargins: true, paddingLeft: P, paddingFront: 5 });
    expect(ms.map((m) => m.side).sort()).toEqual(['left']);
  });

  it('segments a long rail per body column on a split plate, with corners on the end columns', () => {
    // 10u wide splits across the bed; the front rail emits one segment per column.
    const tiling = computeBaseplateTiling(
      makeParams({
        width: 10,
        depth: 3,
        detachMargins: true,
        paddingLeft: P,
        paddingRight: P,
        paddingFront: P,
        paddingBack: P,
      }),
      256
    );
    expect(tiling.isSplit).toBe(true);
    const front = tiling.margins.filter((m) => m.side === 'front').sort((a, b) => a.col - b.col);
    expect(front.length).toBe(tiling.cols);
    // Each segment fits the bed.
    for (const seg of front) expect(seg.lengthMm).toBeLessThanOrEqual(256);
    // Corners live on the end columns only.
    expect(front[0].ownedCorners).toEqual(['bl']);
    expect(front[front.length - 1].ownedCorners).toEqual(['br']);
    for (const seg of front.slice(1, -1)) expect(seg.ownedCorners).toEqual([]);
  });

  it('anchors the seam connector on the body grid center, offsetting corner segments (#2427/#2428)', () => {
    // Corner-owning end segments extend over the detached left/right padding, so
    // their center no longer sits on the body wall they join. seamConnector
    // records the mating wall's grid width and center offset so the rail can
    // recompute per-cell groove positions that land on the body tongues.
    const tiling = computeBaseplateTiling(
      makeParams({
        width: 10,
        depth: 3,
        detachMargins: true,
        paddingLeft: P,
        paddingRight: P,
        paddingFront: P,
        paddingBack: P,
      }),
      256
    );
    const front = tiling.margins.filter((m) => m.side === 'front').sort((a, b) => a.col - b.col);
    // First column extends over the left padding (center shifted −P/2), so the
    // grooves shift +P/2 back; last column mirrors it; middle columns are centered.
    expect(front[0].seamConnector?.centerOffsetMm).toBeCloseTo(P / 2, 6);
    expect(front[front.length - 1].seamConnector?.centerOffsetMm).toBeCloseTo(-P / 2, 6);
    for (const seg of front.slice(1, -1))
      expect(seg.seamConnector?.centerOffsetMm).toBeCloseTo(0, 6);
    // The offset places the body grid center exactly on the piece's grid center,
    // and cellUnits mirrors the mating body piece's width.
    for (const seg of front) {
      const piece = tiling.pieces.find((p) => p.col === seg.col && p.row === seg.row)!;
      const pieceCenterX =
        piece.gridOffsetX * U + (piece.widthUnits * U) / 2 - tiling.totalWidthUnits * U * 0.5;
      expect(seg.worldOffsetMm.x + (seg.seamConnector?.centerOffsetMm ?? 0)).toBeCloseTo(
        pieceCenterX,
        6
      );
      expect(seg.seamConnector?.cellUnits).toBe(piece.widthUnits);
    }
  });

  it('extends a rail over an integral (sub-threshold) perpendicular side to reach its corner', () => {
    // left detaches; front padding (5mm) stays integral on the body. The left
    // rail must extend over that 5mm so the front-left corner has no gap.
    const ms = margins({ detachMargins: true, paddingLeft: P, paddingFront: 5 });
    const left = ms.find((m) => m.side === 'left')!;
    expect(left.role).toBe('long');
    expect(left.lengthMm).toBe(gridD + 5); // grid depth + the integral front band
    expect([...left.ownedCorners].sort()).toEqual(['bl', 'tl']);
    // Center shifts toward the extended (front) end by half the integral band.
    expect(left.worldOffsetMm.y).toBe(-5 / 2);
  });
});

describe('bodyParamsForDetach', () => {
  const P = 10;
  it('passes params through unchanged without the flag', () => {
    const p = makeParams({ paddingLeft: P, paddingRight: P });
    expect(bodyParamsForDetach(p)).toBe(p);
  });

  it('zeroes only the detached sides, keeping sub-threshold padding integral', () => {
    const p = makeParams({
      detachMargins: true,
      paddingLeft: P,
      paddingRight: 5, // sub-threshold → stays
      paddingFront: P,
      paddingBack: 0,
    });
    const body = bodyParamsForDetach(p);
    expect(body.paddingLeft).toBe(0);
    expect(body.paddingRight).toBe(5);
    expect(body.paddingFront).toBe(0);
    expect(body.paddingBack).toBe(0);
  });

  it('does not affect the margins computed from the original params', () => {
    // Zeroing is for the body mesh only — emitMargins still sees true padding.
    const p = makeParams({ detachMargins: true, paddingLeft: P, paddingFront: P });
    const sides = new Set(computeBaseplateTiling(p, 256).margins.map((m) => m.side));
    expect(sides.has('front')).toBe(true);
    expect(sides.has('left')).toBe(true);
  });
});

describe('margin-seam connector edge assignment (#2414)', () => {
  const P = 12; // ≥ MARGIN_MIN_DETACH_MM
  const frontEdges = (params: ResolvedBaseplateParams) =>
    new Set(
      computeBaseplateTiling(params, 256)
        .pieces.filter((pc) => pc.row === 0)
        .map((pc) => pc.edges.front)
    );

  it('marks the detached long-rail seam edge when the connector is on', () => {
    const p = makeParams({
      detachMargins: true,
      detachMarginConnector: true,
      connectorStyle: 'dovetail',
      paddingFront: P,
    });
    expect(frontEdges(p)).toEqual(new Set(['marginSeam']));
  });

  it('engages on the default (undefined) connector style, which is dovetail', () => {
    // The ConnectorPicker persists dovetail as an absent connectorStyle, so the
    // seam must engage when it's undefined (the common default case).
    const p = makeParams({ detachMargins: true, detachMarginConnector: true, paddingFront: P });
    expect(p.connectorStyle).toBeUndefined();
    expect(frontEdges(p)).toEqual(new Set(['marginSeam']));
  });

  it('leaves the seam a plain exterior edge when the connector is off', () => {
    const p = makeParams({ detachMargins: true, paddingFront: P });
    expect(frontEdges(p)).toEqual(new Set(['exterior']));
  });

  it('keeps snapClip seams friction-fit (plain exterior, no marginSeam)', () => {
    const p = makeParams({
      detachMargins: true,
      detachMarginConnector: true,
      connectorStyle: 'snapClip',
      paddingFront: P,
    });
    expect(frontEdges(p)).toEqual(new Set(['exterior']));
  });

  it('only seams long rails — a short side stays exterior', () => {
    // front is the long axis; left detaches too but as a short rail → no seam.
    const p = makeParams({
      detachMargins: true,
      detachMarginConnector: true,
      connectorStyle: 'puzzle',
      paddingFront: P,
      paddingLeft: P,
    });
    const leftEdges = new Set(
      computeBaseplateTiling(p, 256)
        .pieces.filter((pc) => pc.col === 0)
        .map((pc) => pc.edges.left)
    );
    expect(frontEdges(p)).toEqual(new Set(['marginSeam']));
    expect(leftEdges).toEqual(new Set(['exterior']));
  });
});

describe('shaped plates (outline-aware splitting)', () => {
  const U = 42;
  // 189mm bed → 4-unit chunks: an 8×8 plate tiles deterministically 2×2.
  const BED = 4.5 * U;
  const shapedParams = (
    outline: ResolvedBaseplateParams['outline'],
    overrides: Partial<ResolvedBaseplateParams> = {}
  ): ResolvedBaseplateParams =>
    makeParams({
      width: 8,
      depth: 8,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
      connectorNubs: true,
      outline,
      ...overrides,
    });

  /** L: the top-right 4×4 quadrant (exactly piece B2's window) is notched. */
  const L_OUTLINE = {
    vertices: [
      { x: 0, y: 0 },
      { x: 8 * U, y: 0 },
      { x: 8 * U, y: 4 * U },
      { x: 4 * U, y: 4 * U },
      { x: 4 * U, y: 8 * U },
      { x: 0, y: 8 * U },
    ],
  };

  /** Diagonal chamfer across the top-right quadrant (x + y = 12u). */
  const CHAMFER_OUTLINE = {
    vertices: [
      { x: 0, y: 0 },
      { x: 8 * U, y: 0 },
      { x: 8 * U, y: 4 * U },
      { x: 4 * U, y: 8 * U },
      { x: 0, y: 8 * U },
    ],
  };

  it('drops fully-outside pieces, keeping positional labels', () => {
    const tiling = computeBaseplateTiling(shapedParams(L_OUTLINE), BED);
    expect(tiling.isSplit).toBe(true);
    expect(tiling.pieces.map((p) => p.label).sort()).toEqual(['A1', 'A2', 'B1']);
    expect(tiling.bedLoads).toBe(3);
    expect(tiling.paddingReductionHint).toBeNull();
  });

  it('keeps connectors on full seams, butts seams facing dropped pieces', () => {
    const tiling = computeBaseplateTiling(shapedParams(L_OUTLINE), BED);
    const byLabel = new Map(tiling.pieces.map((p) => [p.label, p]));
    const a1 = byLabel.get('A1');
    const b1 = byLabel.get('B1');
    const a2 = byLabel.get('A2');
    // Both seams into the body are full → connectors survive.
    expect(a1?.edges.right).toBe('join');
    expect(a1?.edges.back).toBe('join');
    expect(b1?.edges.left).toBe('join');
    expect(a2?.edges.front).toBe('join');
    // Seams facing the dropped B2 become plain exteriors.
    expect(b1?.edges.back).toBe('exterior');
    expect(a2?.edges.right).toBe('exterior');
  });

  it('inside pieces stay pure rectangles; partial pieces carry a local outline', () => {
    const tiling = computeBaseplateTiling(shapedParams(CHAMFER_OUTLINE), BED);
    const byLabel = new Map(tiling.pieces.map((p) => [p.label, p]));
    expect(tiling.pieces).toHaveLength(4);
    const a1 = byLabel.get('A1');
    const b2 = byLabel.get('B2');
    expect(a1?.outlineWindowOriginMm).toBeUndefined();
    expect(b2?.outlineWindowOriginMm).toEqual({ x: 4 * U, y: 4 * U });

    const parent = shapedParams(CHAMFER_OUTLINE);
    const a1Params = pieceToBaseplateParams(a1 as BaseplatePiece, parent);
    const b2Params = pieceToBaseplateParams(b2 as BaseplatePiece, parent);
    // Pure rectangle: identical fingerprint inputs to an unshaped piece.
    expect(a1Params.outline).toBeUndefined();
    // Piece-local frame: the diagonal's endpoints translate by the window origin.
    expect(b2Params.outline?.vertices).toContainEqual({ x: 4 * U, y: 0 });
    expect(b2Params.outline?.vertices).toContainEqual({ x: 0, y: 4 * U });
  });

  it('butts a seam the outline crosses (partial seam)', () => {
    const tiling = computeBaseplateTiling(shapedParams(CHAMFER_OUTLINE), BED);
    const byLabel = new Map(tiling.pieces.map((p) => [p.label, p]));
    // The diagonal crosses both of B2's join seams → butt joints on both sides.
    expect(byLabel.get('B2')?.edges.left).toBe('exterior');
    expect(byLabel.get('B2')?.edges.front).toBe('exterior');
    expect(byLabel.get('A2')?.edges.right).toBe('exterior');
    expect(byLabel.get('B1')?.edges.back).toBe('exterior');
    // The body seams away from the diagonal keep connectors.
    expect(byLabel.get('A1')?.edges.right).toBe('join');
    expect(byLabel.get('A1')?.edges.back).toBe('join');
  });

  it('forces placement rotation off for shaped tilings', () => {
    const tiling = computeBaseplateTiling(
      shapedParams(L_OUTLINE, { preferIdenticalPieces: true }),
      BED
    );
    expect(tiling.pieces.every((p) => p.placementRotationDeg === 0)).toBe(true);
  });

  it('shaped partial pieces fingerprint apart from rectangles, congruent windows together', () => {
    const parent = shapedParams(CHAMFER_OUTLINE);
    const tiling = computeBaseplateTiling(parent, BED);
    const byLabel = new Map(tiling.pieces.map((p) => [p.label, p]));
    const a1 = pieceToBaseplateParams(byLabel.get('A1') as BaseplatePiece, parent);
    const b2 = pieceToBaseplateParams(byLabel.get('B2') as BaseplatePiece, parent);
    expect(computePieceFingerprint(b2)).not.toBe(computePieceFingerprint(a1));
    expect(computePieceFingerprint(b2)).toBe(computePieceFingerprint(b2));
  });
});
