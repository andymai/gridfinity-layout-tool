import { describe, it, expect } from 'vitest';
import { computeBaseplateTiling, pieceToBaseplateParams, colToLetter } from './splitPlanner';
import type { BaseplateParams } from '@/shared/types/bin';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeParams(overrides: Partial<BaseplateParams> = {}): BaseplateParams {
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
function colWidths(params: BaseplateParams, printBed = 256): number[] {
  const tiling = computeBaseplateTiling(params, printBed);
  return tiling.pieces
    .filter((p) => p.row === 0)
    .sort((a, b) => a.col - b.col)
    .map((p) => p.widthUnits);
}

/** Helper to get piece depths in row order for a single column. */
function rowDepths(params: BaseplateParams, printBed = 256): number[] {
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

  it('both-axis split (10x8)', () => {
    const params = makeParams({
      width: 10,
      depth: 8,
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
    const params = makeParams({ width: 10, depth: 8 });
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
    const parent = makeParams({ width: 10, depth: 8 });
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
