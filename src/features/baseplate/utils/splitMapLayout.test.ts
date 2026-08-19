import { describe, expect, it } from 'vitest';
import type { BaseplatePiece, BaseplateTiling } from '../types/tiling';
import { seamFraction, splitMapLayout } from './splitMapLayout';

const PIECE_DEFAULTS = {
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'none',
  fractionalEdgeY: 'none',
  edges: { left: 'exterior', right: 'exterior', front: 'exterior', back: 'exterior' },
  placementRotationDeg: 0,
} as const;

function piece(over: Partial<BaseplatePiece>): BaseplatePiece {
  return {
    ...PIECE_DEFAULTS,
    label: 'A1',
    col: 0,
    row: 0,
    widthUnits: 3,
    depthUnits: 3,
    gridOffsetX: 0,
    gridOffsetY: 0,
    ...over,
  };
}

function tiling(over: Partial<BaseplateTiling>): BaseplateTiling {
  return {
    isSplit: true,
    cols: 3,
    rows: 1,
    colSizes: [3, 3, 3],
    rowSizes: [3],
    pieces: [piece({})],
    margins: [],
    totalWidthUnits: 9,
    totalDepthUnits: 3,
    stackCount: 1,
    stackSeparatorThickness: 0,
    bedLoads: 1,
    paddingReductionHint: null,
    isCustomSplit: false,
    bedOverages: [],
    ...over,
  };
}

describe('splitMapLayout', () => {
  it('sizes tracks by grid span when the plate has no padding', () => {
    const map = splitMapLayout(tiling({ colSizes: [5, 4], rowSizes: [6] }), 42, 42);
    expect(map.colMm).toEqual([210, 168]);
    expect(map.rowMm).toEqual([252]);
    expect(map.widthMm).toBe(378);
  });

  it('adds each padded side to the outermost track only', () => {
    const map = splitMapLayout(
      tiling({
        colSizes: [3, 3, 3],
        pieces: [
          piece({ label: 'A1', col: 0, paddingLeft: 20 }),
          piece({ label: 'B1', col: 1, gridOffsetX: 3 }),
          piece({ label: 'C1', col: 2, gridOffsetX: 6, paddingRight: 8 }),
        ],
      }),
      42,
      42
    );
    expect(map.colMm).toEqual([146, 126, 134]);
    expect(map.widthMm).toBe(406);
    expect(map.padLeftMm).toBe(20);
  });

  it('uses the Y pitch for rows on a non-square grid', () => {
    const map = splitMapLayout(tiling({ rowSizes: [3, 2] }), 42, 21);
    expect(map.rowMm).toEqual([63, 42]);
    expect(map.depthMm).toBe(105);
  });

  // A shaped perimeter drops pieces, so the padded column may have no piece at
  // index 0 to read the value off.
  it('recovers padding from whichever piece still carries it', () => {
    const map = splitMapLayout(
      tiling({
        colSizes: [3, 3],
        pieces: [piece({ label: 'A2', col: 0, row: 1, paddingLeft: 20 })],
      }),
      42,
      42
    );
    expect(map.colMm[0]).toBe(146);
  });

  it('keeps the total positive on a degenerate plate', () => {
    const map = splitMapLayout(tiling({ colSizes: [], rowSizes: [], pieces: [] }), 42, 42);
    expect(map.widthMm).toBeGreaterThan(0);
    expect(map.depthMm).toBeGreaterThan(0);
  });
});

describe('seamFraction', () => {
  it('measures a seam across the padded plate, not the grid', () => {
    // Grid seam at 3 units of a 9-unit plate is a third of the GRID, but the
    // 20mm of leading padding moves it later across the plate as a whole.
    expect(seamFraction(3, 42, 20, 406)).toBeCloseTo(146 / 406, 10);
    expect(seamFraction(3, 42, 0, 378)).toBeCloseTo(1 / 3, 10);
  });
});
