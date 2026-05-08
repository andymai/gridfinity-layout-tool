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

  it('emits one clip per grid boundary on a 2×1 split (single vertical seam)', () => {
    // Two pieces side-by-side along X. Left piece's right edge is the seam.
    // depthUnits=2 → 1 boundary on the seam → 1 clip.
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
    expect(positions).toHaveLength(1);
    expect(positions[0].orientation).toBe('verticalSeam');
    // Seam x = (left piece center) + halfWidth = (-2*GRID + GRID) + GRID = 0.
    expect(positions[0].x).toBeCloseTo(0, 5);
    // Boundary y at depth=2 → middle of slab = 0.
    expect(positions[0].y).toBeCloseTo(0, 5);
  });

  it('emits clips for a 1×2 split with horizontal seam', () => {
    // Two pieces stacked along Y. Front piece's back edge is the seam.
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
    expect(positions).toHaveLength(1);
    expect(positions[0].orientation).toBe('horizontalSeam');
  });

  it('does not double-count seams (each clip emitted once)', () => {
    // 2×2 grid: 4 pieces, 1 vertical seam × depth-1 boundaries + 1 horizontal
    // seam × width-1 boundaries. Without the right/back-only convention,
    // we'd emit twice as many.
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
    // 2 vertical-seam clips (1 vertical seam × depth-1=1 boundary per piece × 2 pieces along Y) +
    // 2 horizontal-seam clips. Wait — 'right' join only on c=0 pieces, of which there are 2.
    // Each emits 1 boundary (depth 2 → boundary count = 1). 2 vertical clips.
    // Same for 'back' join on r=0 pieces. 2 horizontal clips. Total = 4.
    expect(positions.length).toBe(4);
    const verticals = positions.filter((p) => p.orientation === 'verticalSeam');
    const horizontals = positions.filter((p) => p.orientation === 'horizontalSeam');
    expect(verticals.length).toBe(2);
    expect(horizontals.length).toBe(2);
  });
});
