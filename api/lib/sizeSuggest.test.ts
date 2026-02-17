/**
 * Tests for size suggestion scoring and position ranking logic.
 */

import { describe, it, expect } from 'vitest';
import { scoreSizes, rankPositions, parseOccupied } from './sizeSuggest';
import type { ScoreInput, OccupiedRect, DrawerSize } from './sizeSuggest';

describe('scoreSizes', () => {
  it('returns sorted scores from drawer frequency', () => {
    const input: ScoreInput = {
      drawerFreq: { '2x1': 10, '1x1': 5, '3x2': 3 },
      transitionFreq: {},
      labelFreq: {},
      correctionFreq: {},
    };

    const result = scoreSizes(input);

    expect(result).toHaveLength(3);
    expect(result[0].size).toBe('2x1');
    expect(result[1].size).toBe('1x1');
    expect(result[2].size).toBe('3x2');
    expect(result[0].score).toBeGreaterThan(result[1].score);
    expect(result[1].score).toBeGreaterThan(result[2].score);
  });

  it('penalizes corrected sizes', () => {
    const input: ScoreInput = {
      drawerFreq: { '2x1': 10, '1x1': 10 },
      transitionFreq: {},
      labelFreq: {},
      correctionFreq: { '1x1': 20 }, // 1x1 gets corrected frequently
    };

    const result = scoreSizes(input);

    expect(result).toHaveLength(2);
    expect(result[0].size).toBe('2x1');
    expect(result[1].size).toBe('1x1');
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it('boosts transition probability', () => {
    const input: ScoreInput = {
      drawerFreq: { '2x1': 5, '1x1': 5, '3x2': 5 },
      transitionFreq: { '3x2': 30 }, // 3x2 is very likely after previous
      labelFreq: {},
      correctionFreq: {},
    };

    const result = scoreSizes(input);

    expect(result).toHaveLength(3);
    expect(result[0].size).toBe('3x2'); // Should be first due to high transition weight
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it('redistributes weights when signals are missing', () => {
    const inputWithAll: ScoreInput = {
      drawerFreq: { '2x1': 10 },
      transitionFreq: { '2x1': 10 },
      labelFreq: { '2x1': 10 },
      correctionFreq: {},
    };

    const inputDrawerOnly: ScoreInput = {
      drawerFreq: { '2x1': 10 },
      transitionFreq: {},
      labelFreq: {},
      correctionFreq: {},
    };

    const resultWithAll = scoreSizes(inputWithAll);
    const resultDrawerOnly = scoreSizes(inputDrawerOnly);

    // Both should have positive scores since drawer freq is present
    expect(resultWithAll[0].score).toBeGreaterThan(0);
    expect(resultDrawerOnly[0].score).toBeGreaterThan(0);
  });

  it('returns empty array for no data', () => {
    const input: ScoreInput = {
      drawerFreq: {},
      transitionFreq: {},
      labelFreq: {},
      correctionFreq: {},
    };

    const result = scoreSizes(input);

    expect(result).toEqual([]);
  });

  it('returns top 3 sizes only', () => {
    const input: ScoreInput = {
      drawerFreq: { '1x1': 10, '2x1': 9, '2x2': 8, '3x2': 7, '3x3': 6 },
      transitionFreq: {},
      labelFreq: {},
      correctionFreq: {},
    };

    const result = scoreSizes(input);

    expect(result).toHaveLength(3);
    expect(result[0].size).toBe('1x1');
    expect(result[1].size).toBe('2x1');
    expect(result[2].size).toBe('2x2');
  });
});

describe('rankPositions', () => {
  it('finds position in empty grid', () => {
    const drawer: DrawerSize = { width: 6, depth: 4 };
    const occupied: OccupiedRect[] = [];

    const position = rankPositions('2x1', occupied, drawer, null);

    expect(position).toEqual({ x: 0, y: 0 });
  });

  it('avoids occupied cells', () => {
    const drawer: DrawerSize = { width: 6, depth: 4 };
    const occupied: OccupiedRect[] = [{ x: 0, y: 0, width: 2, depth: 1 }];

    const position = rankPositions('2x1', occupied, drawer, null);

    // Should find next available position (scan goes x then y)
    expect(position).not.toBeNull();
    expect(position).not.toEqual({ x: 0, y: 0 });
  });

  it('returns null when grid is full', () => {
    const drawer: DrawerSize = { width: 2, depth: 1 };
    const occupied: OccupiedRect[] = [{ x: 0, y: 0, width: 2, depth: 1 }];

    const position = rankPositions('2x1', occupied, drawer, null);

    expect(position).toBeNull();
  });

  it('supports half-bin sizes', () => {
    const drawer: DrawerSize = { width: 6, depth: 4 };
    const occupied: OccupiedRect[] = [{ x: 0, y: 0, width: 1.5, depth: 1 }];

    const position = rankPositions('1.5x1', occupied, drawer, null);

    // Should find position for half-bin size
    expect(position).not.toBeNull();
  });

  it('returns null for invalid size format', () => {
    const drawer: DrawerSize = { width: 6, depth: 4 };
    const occupied: OccupiedRect[] = [];

    const position = rankPositions('invalid', occupied, drawer, null);

    expect(position).toBeNull();
  });

  it('scans bottom-left to top-right', () => {
    const drawer: DrawerSize = { width: 4, depth: 4 };
    const occupied: OccupiedRect[] = [
      { x: 0, y: 0, width: 1, depth: 1 },
      { x: 1, y: 0, width: 1, depth: 1 },
    ];

    const position = rankPositions('1x1', occupied, drawer, null);

    // Should find (2, 0) before (0, 1) since scan goes x then y
    expect(position).toEqual({ x: 2, y: 0 });
  });
});

describe('parseOccupied', () => {
  it('parses valid tuples', () => {
    const tuples = [
      [0, 0, 2, 1],
      [2, 0, 1, 1],
      [0, 1, 3, 2],
    ];

    const result = parseOccupied(tuples);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ x: 0, y: 0, width: 2, depth: 1 });
    expect(result[1]).toEqual({ x: 2, y: 0, width: 1, depth: 1 });
    expect(result[2]).toEqual({ x: 0, y: 1, width: 3, depth: 2 });
  });

  it('handles null input', () => {
    const result = parseOccupied(null);
    expect(result).toEqual([]);
  });

  it('handles empty array', () => {
    const result = parseOccupied([]);
    expect(result).toEqual([]);
  });

  it('skips invalid tuples', () => {
    const tuples = [
      [0, 0, 2, 1], // valid
      [1, 2], // invalid - only 2 elements
      [0, 0, 2, 1, 5], // invalid - 5 elements
      ['a', 'b', 'c', 'd'], // invalid - strings
      [0, 0, NaN, 1], // invalid - NaN
      [2, 0, 1, 1], // valid
    ];

    const result = parseOccupied(tuples);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 0, y: 0, width: 2, depth: 1 });
    expect(result[1]).toEqual({ x: 2, y: 0, width: 1, depth: 1 });
  });

  it('handles non-array input', () => {
    expect(parseOccupied('not an array')).toEqual([]);
    expect(parseOccupied(123)).toEqual([]);
    expect(parseOccupied({ x: 0, y: 0 })).toEqual([]);
  });
});
