import { describe, it, expect } from 'vitest';
import { computeSnapClipPositions } from './snapClipPositions';
import type { BaseplatePiece, BaseplateTiling } from '../../types/tiling';

const GRID = 42;

const piece = (
  overrides: Partial<BaseplatePiece> & { col: number; row: number }
): BaseplatePiece => ({
  label: `${String.fromCharCode(65 + overrides.col)}${overrides.row + 1}`,
  col: overrides.col,
  row: overrides.row,
  widthUnits: 2,
  depthUnits: 2,
  gridOffsetX: overrides.col * 2,
  gridOffsetY: overrides.row * 2,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'none',
  fractionalEdgeY: 'none',
  edges: { left: 'exterior', right: 'exterior', front: 'exterior', back: 'exterior' },
  ...overrides,
});

const tiling = (overrides: Partial<BaseplateTiling> = {}): BaseplateTiling => ({
  isSplit: true,
  pieces: [],
  cols: 1,
  rows: 1,
  totalWidthUnits: 2,
  totalDepthUnits: 2,
  stackCount: 1,
  stackSeparatorThickness: 0,
  paddingReductionHint: null,
  ...overrides,
});

describe('computeSnapClipPositions', () => {
  it('returns no positions for an unsplit baseplate', () => {
    const t = tiling({ isSplit: false });
    expect(computeSnapClipPositions(t, GRID)).toEqual([]);
  });

  it('emits one clip per cell on a 2×1 split (single vertical seam)', () => {
    // Two pieces side-by-side along X. Left piece's right edge is the seam.
    // depthUnits=2 → 2 cells along the seam → 2 clips (one per cell center).
    const left = piece({
      col: 0,
      row: 0,
      edges: { left: 'exterior', right: 'join', front: 'exterior', back: 'exterior' },
    });
    const right = piece({
      col: 1,
      row: 0,
      gridOffsetX: 2,
      edges: { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
    });
    const t = tiling({
      pieces: [left, right],
      cols: 2,
      rows: 1,
      totalWidthUnits: 4,
      totalDepthUnits: 2,
    });

    const positions = computeSnapClipPositions(t, GRID);

    // Walking by 'right' join only avoids double-counting (left piece emits;
    // right piece's 'left' join is skipped).
    expect(positions).toHaveLength(2);
    expect(positions.every((p) => p.orientation === 'verticalSeam')).toBe(true);
    // Seam x = (left piece center) + halfWidth = (-2*GRID + GRID) + GRID = 0.
    expect(positions[0].x).toBeCloseTo(0, 5);
    expect(positions[1].x).toBeCloseTo(0, 5);
    // Cell centers at depth=2 → y = ±GRID/2 = ±21.
    const ys = positions.map((p) => p.y).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-GRID / 2, 5);
    expect(ys[1]).toBeCloseTo(GRID / 2, 5);
  });

  it('emits a single clip on a 1×1 split (one cell along the seam)', () => {
    // Cell-center indexing means even a 1×1 piece pair gets a connector;
    // the previous boundary indexing left these unconnected.
    const left = piece({
      col: 0,
      row: 0,
      widthUnits: 1,
      depthUnits: 1,
      edges: { left: 'exterior', right: 'join', front: 'exterior', back: 'exterior' },
    });
    const right = piece({
      col: 1,
      row: 0,
      gridOffsetX: 1,
      widthUnits: 1,
      depthUnits: 1,
      edges: { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
    });
    const t = tiling({
      pieces: [left, right],
      cols: 2,
      rows: 1,
      totalWidthUnits: 2,
      totalDepthUnits: 1,
    });

    const positions = computeSnapClipPositions(t, GRID);
    expect(positions).toHaveLength(1);
    expect(positions[0].orientation).toBe('verticalSeam');
    expect(positions[0].x).toBeCloseTo(0, 5);
    expect(positions[0].y).toBeCloseTo(0, 5);
  });

  it('emits clips for a 1×2 split with horizontal seam', () => {
    // Two pieces stacked along Y. Front piece's back edge is the seam.
    // widthUnits=2 → 2 cells along the seam → 2 clips.
    const front = piece({
      col: 0,
      row: 0,
      edges: { left: 'exterior', right: 'exterior', front: 'exterior', back: 'join' },
    });
    const back = piece({
      col: 0,
      row: 1,
      gridOffsetY: 2,
      edges: { left: 'exterior', right: 'exterior', front: 'join', back: 'exterior' },
    });
    const t = tiling({
      pieces: [front, back],
      cols: 1,
      rows: 2,
      totalWidthUnits: 2,
      totalDepthUnits: 4,
    });

    const positions = computeSnapClipPositions(t, GRID);
    expect(positions).toHaveLength(2);
    expect(positions.every((p) => p.orientation === 'horizontalSeam')).toBe(true);
  });

  it('does not double-count seams (each clip emitted once)', () => {
    // 2×2 grid of 2×2 pieces: 1 vertical seam × 2 cells = 2 clips per piece
    // along Y; 1 horizontal seam × 2 cells = 2 clips per piece along X.
    // Walking only +X / +Y joins selects 2 emitting pieces per axis, so:
    //   2 (right-join pieces) × 2 cells = 4 verticals
    //   2 (back-join pieces) × 2 cells = 4 horizontals
    const pieces: BaseplatePiece[] = [];
    for (let c = 0; c < 2; c++) {
      for (let r = 0; r < 2; r++) {
        pieces.push(
          piece({
            col: c,
            row: r,
            gridOffsetX: c * 2,
            gridOffsetY: r * 2,
            edges: {
              left: c === 0 ? 'exterior' : 'join',
              right: c === 1 ? 'exterior' : 'join',
              front: r === 0 ? 'exterior' : 'join',
              back: r === 1 ? 'exterior' : 'join',
            },
          })
        );
      }
    }
    const t = tiling({
      pieces,
      cols: 2,
      rows: 2,
      totalWidthUnits: 4,
      totalDepthUnits: 4,
    });
    const positions = computeSnapClipPositions(t, GRID);
    expect(positions.length).toBe(8);
    const verticals = positions.filter((p) => p.orientation === 'verticalSeam');
    const horizontals = positions.filter((p) => p.orientation === 'horizontalSeam');
    expect(verticals.length).toBe(4);
    expect(horizontals.length).toBe(4);
  });
});
