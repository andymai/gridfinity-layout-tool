import { describe, it, expect } from 'vitest';
import type { BaseplateEdges } from '@/shared/types/bin';
import { computeConnectorPositions } from './connectorUtils';

const ALL_JOIN: BaseplateEdges = { left: 'join', right: 'join', front: 'join', back: 'join' };

// 2x2 grid, 42mm grid unit, zero offsets
const WIDTH = 2;
const DEPTH = 2;
const GRID_UNIT = 42;
const TOTAL_W = WIDTH * GRID_UNIT;
const TOTAL_D = DEPTH * GRID_UNIT;
const TOTAL_HEIGHT = 10;
const OFFSET_X = 0;
const OFFSET_Y = 0;

describe('computeConnectorPositions', () => {
  it('default: left/front edges are male, right/back edges are female', () => {
    const result = computeConnectorPositions(
      WIDTH,
      DEPTH,
      GRID_UNIT,
      TOTAL_HEIGHT,
      TOTAL_W,
      TOTAL_D,
      OFFSET_X,
      OFFSET_Y,
      ALL_JOIN
    );

    const left = result.find((p) => p.nx === -1 && p.ny === 0);
    const right = result.find((p) => p.nx === 1 && p.ny === 0);
    const front = result.find((p) => p.nx === 0 && p.ny === -1);
    const back = result.find((p) => p.nx === 0 && p.ny === 1);

    expect(left?.isMale).toBe(true);
    expect(front?.isMale).toBe(true);
    expect(right?.isMale).toBe(false);
    expect(back?.isMale).toBe(false);
  });

  it('invertDovetails=true: left/front edges are female, right/back edges are male', () => {
    const result = computeConnectorPositions(
      WIDTH,
      DEPTH,
      GRID_UNIT,
      TOTAL_HEIGHT,
      TOTAL_W,
      TOTAL_D,
      OFFSET_X,
      OFFSET_Y,
      ALL_JOIN,
      true
    );

    const left = result.find((p) => p.nx === -1 && p.ny === 0);
    const right = result.find((p) => p.nx === 1 && p.ny === 0);
    const front = result.find((p) => p.nx === 0 && p.ny === -1);
    const back = result.find((p) => p.nx === 0 && p.ny === 1);

    expect(left?.isMale).toBe(false);
    expect(front?.isMale).toBe(false);
    expect(right?.isMale).toBe(true);
    expect(back?.isMale).toBe(true);
  });

  it('returns empty array when no edges are join', () => {
    const result = computeConnectorPositions(
      WIDTH,
      DEPTH,
      GRID_UNIT,
      TOTAL_HEIGHT,
      TOTAL_W,
      TOTAL_D,
      OFFSET_X,
      OFFSET_Y,
      { left: 'exterior', right: 'exterior', front: 'exterior', back: 'exterior' }
    );

    expect(result).toEqual([]);
  });
});

describe('computeConnectorPositions — fractional-cell placement (#1847)', () => {
  /**
   * For a 4.5-unit depth with the half-cell at the END (default), the four
   * inter-cell boundaries are at grid positions 1, 2, 3, 4. In piece-local
   * coordinates (centered on the piece, totalD = 189mm), that's
   * (k * 42) - 94.5 for k = 1..4 → -52.5, -10.5, 31.5, 73.5.
   */
  it('frac=end: places left-edge dovetails at expected positions for depth=4.5', () => {
    const result = computeConnectorPositions(
      4.5,
      4.5,
      42,
      10,
      4.5 * 42,
      4.5 * 42,
      0,
      0,
      { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
      false,
      'end',
      'end'
    );
    const ys = result.map((p) => p.cy).sort((a, b) => a - b);
    expect(ys).toEqual([-52.5, -10.5, 31.5, 73.5]);
  });

  /**
   * For a 4.5-unit depth with the half-cell at the START, the cell layout is
   * [0.5, 1, 1, 1, 1] in grid units; boundaries at grid positions 0.5, 1.5,
   * 2.5, 3.5. In piece-local coords (totalD = 189mm) they shift left by half
   * a grid unit: -73.5, -31.5, 10.5, 52.5.
   */
  it('frac=start: shifts left-edge dovetails by half a grid unit for depth=4.5', () => {
    const result = computeConnectorPositions(
      4.5,
      4.5,
      42,
      10,
      4.5 * 42,
      4.5 * 42,
      0,
      0,
      { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
      false,
      'end',
      'start'
    );
    const ys = result.map((p) => p.cy).sort((a, b) => a - b);
    expect(ys).toEqual([-73.5, -31.5, 10.5, 52.5]);
  });

  it('frac=start on width axis: shifts front-edge dovetails for width=4.5', () => {
    const result = computeConnectorPositions(
      4.5,
      4.5,
      42,
      10,
      4.5 * 42,
      4.5 * 42,
      0,
      0,
      { left: 'exterior', right: 'exterior', front: 'join', back: 'exterior' },
      false,
      'start',
      'end'
    );
    const xs = result.map((p) => p.cx).sort((a, b) => a - b);
    expect(xs).toEqual([-73.5, -31.5, 10.5, 52.5]);
  });

  it('all-edge slots place exterior markers on the same boundaries (#2866)', () => {
    // The instant draft must mark the same edges the exact build cuts, since it
    // stays on screen if BREP fails. A 4.5-deep left edge gets its 4 boundaries
    // whether that edge is a join seam or a padding-free exterior one.
    const asJoin = computeConnectorPositions(
      4.5,
      4.5,
      42,
      10,
      4.5 * 42,
      4.5 * 42,
      0,
      0,
      { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
      false,
      'end',
      'end'
    );
    const asExterior = computeConnectorPositions(
      4.5,
      4.5,
      42,
      10,
      4.5 * 42,
      4.5 * 42,
      0,
      0,
      { left: 'exterior', right: 'exterior', front: 'exterior', back: 'exterior' },
      false,
      'end',
      'end',
      42,
      true
    ).filter((p) => p.nx === -1);
    expect(asExterior.map((p) => p.cy).sort((a, b) => a - b)).toEqual(
      asJoin.map((p) => p.cy).sort((a, b) => a - b)
    );
    // ...but always female: the option only engages for the both-female styles.
    expect(asExterior.every((p) => !p.isMale)).toBe(true);
    expect(asJoin.some((p) => p.isMale)).toBe(true);
  });

  it('all-edge slots mark JOIN edges female too, whatever invert says (#2866)', () => {
    // The option only engages for the both-female styles, whose exact build emits
    // no tongue on ANY seam — so an inverted plate, where right/back would be male
    // by convention, must still draft every marker female.
    const allJoin = { left: 'join', right: 'join', front: 'join', back: 'join' } as const;
    const args = [2, 2, 42, 10, 2 * 42, 2 * 42, 0, 0, allJoin, true, 'end', 'end'] as const;

    const slotted = computeConnectorPositions(...args, 42, true);
    expect(slotted.length).toBeGreaterThan(0);
    expect(slotted.some((p) => p.isMale)).toBe(false);

    // Without the option the same plate keeps its male half, so the assertion
    // above isn't vacuous.
    expect(computeConnectorPositions(...args).some((p) => p.isMale)).toBe(true);
  });

  it('all-edge slots skip a padded exterior edge (#2866)', () => {
    const PAD = 5;
    const marked = computeConnectorPositions(
      3,
      2,
      42,
      10,
      3 * 42 + PAD,
      2 * 42,
      -PAD / 2,
      0,
      { left: 'exterior', right: 'exterior', front: 'exterior', back: 'exterior' },
      false,
      'end',
      'end',
      42,
      true,
      { left: PAD, right: 0, front: 0, back: 0 }
    );
    // Left's wall is offset from the grid, so it gets nothing; the other three
    // contribute 1 (right) + 2 + 2 (front/back) = 5.
    expect(marked).toHaveLength(5);
    expect(marked.some((p) => p.nx === -1)).toBe(false);
  });

  it('integer depth: fractionalEdgeY is irrelevant', () => {
    const end = computeConnectorPositions(
      5,
      5,
      42,
      10,
      5 * 42,
      5 * 42,
      0,
      0,
      { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
      false,
      'end',
      'end'
    );
    const start = computeConnectorPositions(
      5,
      5,
      42,
      10,
      5 * 42,
      5 * 42,
      0,
      0,
      { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
      false,
      'end',
      'start'
    );
    const endYs = end.map((p) => p.cy).sort((a, b) => a - b);
    const startYs = start.map((p) => p.cy).sort((a, b) => a - b);
    expect(endYs).toEqual(startYs);
    expect(endYs).toEqual([-63, -21, 21, 63]);
  });
});
