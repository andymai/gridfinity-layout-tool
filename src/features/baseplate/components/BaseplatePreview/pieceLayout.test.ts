import { describe, it, expect } from 'vitest';
import { computePiecePlacement, type PiecePlacement } from './pieceLayout';
import type { PieceMeshEntry } from '../../store/baseplatePageStore';

type PieceFixture = Pick<
  PieceMeshEntry,
  'offsetX' | 'offsetY' | 'widthUnits' | 'depthUnits' | 'col' | 'row'
>;

/**
 * 2-column × 3-row tiling with per-column/row unit sizes:
 *   columns: [3u, 4u]  → totalWidthUnits 7
 *   rows:    [2u, 3u, 2u] → totalDepthUnits 7
 * offsetX/offsetY are the cumulative unit offsets from the left/front edge.
 */
const COLUMN_WIDTHS = [3, 4] as const;
const ROW_DEPTHS = [2, 3, 2] as const;
const TOTAL_WIDTH_UNITS = 7;
const TOTAL_DEPTH_UNITS = 7;

function buildTiling(): PieceFixture[] {
  const pieces: PieceFixture[] = [];
  let offsetY = 0;
  for (let row = 0; row < ROW_DEPTHS.length; row++) {
    let offsetX = 0;
    for (let col = 0; col < COLUMN_WIDTHS.length; col++) {
      pieces.push({
        offsetX,
        offsetY,
        widthUnits: COLUMN_WIDTHS[col],
        depthUnits: ROW_DEPTHS[row],
        col,
        row,
      });
      offsetX += COLUMN_WIDTHS[col];
    }
    offsetY += ROW_DEPTHS[row];
  }
  return pieces;
}

const leftEdge = (p: PiecePlacement): number => p.x - p.widthMm / 2;
const rightEdge = (p: PiecePlacement): number => p.x + p.widthMm / 2;
const bottomEdge = (p: PiecePlacement): number => p.y - p.depthMm / 2;
const topEdge = (p: PiecePlacement): number => p.y + p.depthMm / 2;

function placeAll(
  pieces: PieceFixture[],
  gridUnitMm: number,
  gridUnitMmY: number,
  splitViewMode: 'assembled' | 'exploded'
): Map<string, PiecePlacement> {
  const totalWidthMm = TOTAL_WIDTH_UNITS * gridUnitMm;
  const totalDepthMm = TOTAL_DEPTH_UNITS * gridUnitMmY;
  const placed = new Map<string, PiecePlacement>();
  for (const piece of pieces) {
    placed.set(
      `${piece.col},${piece.row}`,
      computePiecePlacement(piece, {
        totalWidthMm,
        totalDepthMm,
        gridUnitMm,
        gridUnitMmY,
        splitViewMode,
      })
    );
  }
  return placed;
}

describe('computePiecePlacement', () => {
  describe('square grid (assembled)', () => {
    const GU = 42;
    const pieces = buildTiling();
    const placed = placeAll(pieces, GU, GU, 'assembled');

    it('tiles horizontally with no gap: each piece right edge meets its neighbor left edge', () => {
      for (let row = 0; row < ROW_DEPTHS.length; row++) {
        const left = placed.get(`0,${row}`);
        const right = placed.get(`1,${row}`);
        if (!left || !right) throw new Error('missing piece');
        expect(rightEdge(left)).toBeCloseTo(leftEdge(right), 10);
      }
    });

    it('tiles vertically with no gap: each piece top edge meets the piece above bottom edge', () => {
      for (let col = 0; col < COLUMN_WIDTHS.length; col++) {
        for (let row = 0; row < ROW_DEPTHS.length - 1; row++) {
          const lower = placed.get(`${col},${row}`);
          const upper = placed.get(`${col},${row + 1}`);
          if (!lower || !upper) throw new Error('missing piece');
          expect(topEdge(lower)).toBeCloseTo(bottomEdge(upper), 10);
        }
      }
    });

    it('spans the full plate with no accumulated slack', () => {
      const totalWidthMm = TOTAL_WIDTH_UNITS * GU;
      const totalDepthMm = TOTAL_DEPTH_UNITS * GU;
      const bottomLeft = placed.get('0,0');
      const topRight = placed.get('1,2');
      if (!bottomLeft || !topRight) throw new Error('missing piece');
      expect(leftEdge(bottomLeft)).toBeCloseTo(-totalWidthMm / 2, 10);
      expect(bottomEdge(bottomLeft)).toBeCloseTo(-totalDepthMm / 2, 10);
      expect(rightEdge(topRight)).toBeCloseTo(totalWidthMm / 2, 10);
      expect(topEdge(topRight)).toBeCloseTo(totalDepthMm / 2, 10);
    });
  });

  describe('non-square grid (assembled) — #3089 regression', () => {
    const GU = 42;
    const GUY = 50;
    const pieces = buildTiling();
    const placed = placeAll(pieces, GU, GUY, 'assembled');

    it('vertical seams meet exactly (depth sized on the Y pitch)', () => {
      for (let col = 0; col < COLUMN_WIDTHS.length; col++) {
        for (let row = 0; row < ROW_DEPTHS.length - 1; row++) {
          const lower = placed.get(`${col},${row}`);
          const upper = placed.get(`${col},${row + 1}`);
          if (!lower || !upper) throw new Error('missing piece');
          expect(topEdge(lower)).toBeCloseTo(bottomEdge(upper), 10);
        }
      }
    });

    it('horizontal seams still meet exactly on the X pitch', () => {
      for (let row = 0; row < ROW_DEPTHS.length; row++) {
        const left = placed.get(`0,${row}`);
        const right = placed.get(`1,${row}`);
        if (!left || !right) throw new Error('missing piece');
        expect(rightEdge(left)).toBeCloseTo(leftEdge(right), 10);
      }
    });

    it('spans the full non-square plate with no accumulated vertical gap', () => {
      const totalDepthMm = TOTAL_DEPTH_UNITS * GUY;
      const bottom = placed.get('0,0');
      const top = placed.get('0,2');
      if (!bottom || !top) throw new Error('missing piece');
      expect(bottomEdge(bottom)).toBeCloseTo(-totalDepthMm / 2, 10);
      expect(topEdge(top)).toBeCloseTo(totalDepthMm / 2, 10);
    });

    it('the old X-pitch slot math leaves the seams unaligned (guards the fix)', () => {
      // Reproduce the pre-fix positioning: the Y slot sized with the X pitch,
      // while the mesh footprint was always the true Y-pitch depth.
      const buggyTotalDepthMm = TOTAL_DEPTH_UNITS * GU;
      const buggyCenterY = (p: PieceFixture): number =>
        p.offsetY * GU + (p.depthUnits * GU) / 2 - buggyTotalDepthMm / 2;
      const meshHalfDepth = (p: PieceFixture): number => (p.depthUnits * GUY) / 2;

      const lower = pieces.find((p) => p.col === 0 && p.row === 0);
      const upper = pieces.find((p) => p.col === 0 && p.row === 1);
      if (!lower || !upper) throw new Error('missing piece');
      const lowerTop = buggyCenterY(lower) + meshHalfDepth(lower);
      const upperBottom = buggyCenterY(upper) - meshHalfDepth(upper);
      expect(Math.abs(upperBottom - lowerTop)).toBeGreaterThan(0.5);
    });
  });

  describe('exploded mode', () => {
    const GU = 42;
    const GUY = 50;
    const pieces = buildTiling();
    const assembled = placeAll(pieces, GU, GUY, 'assembled');
    const exploded = placeAll(pieces, GU, GUY, 'exploded');

    it('offsets each piece by exactly col*10 and row*10 relative to assembled', () => {
      for (const piece of pieces) {
        const key = `${piece.col},${piece.row}`;
        const asm = assembled.get(key);
        const exp = exploded.get(key);
        if (!asm || !exp) throw new Error('missing piece');
        expect(exp.x - asm.x).toBeCloseTo(piece.col * 10, 10);
        expect(exp.y - asm.y).toBeCloseTo(piece.row * 10, 10);
      }
    });

    it('leaves piece footprint dimensions unchanged by explode', () => {
      for (const piece of pieces) {
        const key = `${piece.col},${piece.row}`;
        const asm = assembled.get(key);
        const exp = exploded.get(key);
        if (!asm || !exp) throw new Error('missing piece');
        expect(exp.widthMm).toBeCloseTo(asm.widthMm, 10);
        expect(exp.depthMm).toBeCloseTo(asm.depthMm, 10);
      }
    });
  });
});
