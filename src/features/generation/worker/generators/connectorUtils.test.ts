import { describe, it, expect } from 'vitest';
import { computeConnectorPositions } from './connectorUtils';

const ALL_JOIN = { left: 'join', right: 'join', front: 'join', back: 'join' };

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
      { left: 'open', right: 'open', front: 'open', back: 'open' }
    );

    expect(result).toEqual([]);
  });
});
