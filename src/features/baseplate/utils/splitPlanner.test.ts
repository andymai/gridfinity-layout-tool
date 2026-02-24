import { describe, it, expect } from 'vitest';
import {
  splitAxis,
  computeBaseplateTiling,
  pieceToBaseplateParams,
  colToLetter,
} from './splitPlanner';
import type { BaseplateParams as FullBaseplateParams } from '@/shared/types/bin';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeParams(overrides: Partial<FullBaseplateParams> = {}): FullBaseplateParams {
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

// ─── colToLetter ───────────────────────────────────────────────────────────

describe('colToLetter', () => {
  it('converts column indices to letters', () => {
    expect(colToLetter(0)).toBe('A');
    expect(colToLetter(1)).toBe('B');
    expect(colToLetter(2)).toBe('C');
    expect(colToLetter(25)).toBe('Z');
  });
});

// ─── splitAxis ─────────────────────────────────────────────────────────────

describe('splitAxis', () => {
  it('returns a single chunk when everything fits', () => {
    expect(splitAxis(6, 42, 256)).toEqual([6]);
  });

  it('splits when total exceeds max', () => {
    // 10 units at 42mm = 420mm > 256mm bed. max = floor(256/42) = 6
    expect(splitAxis(10, 42, 256)).toEqual([6, 4]);
  });

  it('handles exact fit at max', () => {
    // 6 * 42 = 252 ≤ 256
    expect(splitAxis(6, 42, 256)).toEqual([6]);
  });

  it('creates 3+ splits for large axes', () => {
    // 16 units, max 6 → [6, 6, 4]
    expect(splitAxis(16, 42, 256)).toEqual([6, 6, 4]);
  });

  it('absorbs fraction into last piece when it fits', () => {
    // 5.5 units: integer=5, fraction=0.5. 5 ≤ 6, so single chunk.
    // 5.5 * 42 = 231 ≤ 256, so fraction absorbed → [5.5]
    expect(splitAxis(5.5, 42, 256)).toEqual([5.5]);
  });

  it('creates separate fractional piece when it overflows', () => {
    // 6.5 units: integer=6, then 6+0.5=6.5, 6.5*42=273 > 256
    // So [6, 0.5]
    expect(splitAxis(6.5, 42, 256)).toEqual([6, 0.5]);
  });

  it('absorbs fraction into last piece of multi-split', () => {
    // 9.5 units: integer=9, splits=[6,3], then 3+0.5=3.5, 3.5*42=147 ≤ 256
    // → [6, 3.5]
    expect(splitAxis(9.5, 42, 256)).toEqual([6, 3.5]);
  });

  it('handles pure fractional value (0.5)', () => {
    expect(splitAxis(0.5, 42, 256)).toEqual([0.5]);
  });
});

// ─── computeBaseplateTiling ────────────────────────────────────────────────

describe('computeBaseplateTiling', () => {
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

  it('width-only split (10x4)', () => {
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

    // A1: leftmost piece
    const a1 = tiling.pieces[0];
    expect(a1.label).toBe('A1');
    expect(a1.widthUnits).toBe(6);
    expect(a1.paddingLeft).toBe(5);
    expect(a1.paddingRight).toBe(0); // join edge
    expect(a1.paddingFront).toBe(3);
    expect(a1.paddingBack).toBe(7);
    expect(a1.edges.left).toBe('exterior');
    expect(a1.edges.right).toBe('join');

    // B1: rightmost piece
    const b1 = tiling.pieces[1];
    expect(b1.label).toBe('B1');
    expect(b1.widthUnits).toBe(4);
    expect(b1.paddingLeft).toBe(0); // join edge
    expect(b1.paddingRight).toBe(10);
    expect(b1.edges.left).toBe('join');
    expect(b1.edges.right).toBe('exterior');
  });

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

  it('fractional edge at end (7.5x4)', () => {
    const params = makeParams({ width: 7.5, depth: 4, fractionalEdgeX: 'end' });
    const tiling = computeBaseplateTiling(params, 256);

    // 7.5 → splitAxis → [6, 1.5] (1+0.5 absorbed)
    expect(tiling.cols).toBe(2);
    const rightPiece = tiling.pieces.find((p) => p.col === 1);
    expect(rightPiece?.widthUnits).toBe(1.5);
    expect(rightPiece?.fractionalEdgeX).toBe('end');
  });

  it('fractional edge at start (7.5x4) reverses splits', () => {
    const params = makeParams({ width: 7.5, depth: 4, fractionalEdgeX: 'start' });
    const tiling = computeBaseplateTiling(params, 256);

    // splitAxis → [6, 1.5], reversed → [1.5, 6]
    expect(tiling.cols).toBe(2);
    const leftPiece = tiling.pieces.find((p) => p.col === 0);
    expect(leftPiece?.widthUnits).toBe(1.5);
    expect(leftPiece?.fractionalEdgeX).toBe('start');
  });

  it('large 3+ splits (16x16)', () => {
    const params = makeParams({ width: 16, depth: 16 });
    const tiling = computeBaseplateTiling(params, 256);

    // 16 → [6, 6, 4] on each axis → 3x3 = 9 pieces
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

  it('exactly fits bed (6x6, max 6)', () => {
    const params = makeParams({ width: 6, depth: 6 });
    const tiling = computeBaseplateTiling(params, 256);

    expect(tiling.isSplit).toBe(false);
    expect(tiling.pieces).toHaveLength(1);
  });

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

    // Width: [6, 6, 4] → offsets 0, 6, 12
    const colOffsets = [...new Set(tiling.pieces.map((p) => p.gridOffsetX))].sort((a, b) => a - b);
    expect(colOffsets).toEqual([0, 6, 12]);

    // Depth: [6, 2] → offsets 0, 6
    const rowOffsets = [...new Set(tiling.pieces.map((p) => p.gridOffsetY))].sort((a, b) => a - b);
    expect(rowOffsets).toEqual([0, 6]);
  });

  it('records future stacking defaults', () => {
    const params = makeParams({ width: 3, depth: 3 });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.stackCount).toBe(1);
    expect(tiling.stackSeparatorThickness).toBe(0);
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
    // All integer pieces should default to 'end'
    const integerPiece = tiling.pieces.find((p) => p.fractionalEdgeX === 'none');
    if (integerPiece) {
      const result = pieceToBaseplateParams(integerPiece, parent);
      expect(result.fractionalEdgeX).toBe('end');
    }
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
    expect(fracPiece).toBeDefined();
    if (fracPiece) {
      const result = pieceToBaseplateParams(fracPiece, parent);
      expect(result.fractionalEdgeX).toBe('start');
    }
  });
});
