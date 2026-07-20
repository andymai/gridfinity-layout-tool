import { describe, it, expect } from 'vitest';
import { deriveWallSegments, type CompartmentGrid } from './compartmentGeometry';
import { computeAuthoredDividers } from './authoredDividerMath';

// tab = tabEngagement(1.0, 0.25) = max(0.3, 1.0 - 0.25 - 0.3) = 0.45; half = 0.8
const THK = 1.6;
const SLOT_DEPTH = 1.0;
const CLEAR = 0.25;

describe('computeAuthoredDividers', () => {
  it('turns a 2x2 grid into two full wall-anchored pieces that cross once', () => {
    const grid: CompartmentGrid = { cols: 2, rows: 2, cells: [0, 1, 2, 3] };
    const segments = deriveWallSegments(grid, 100, 100);
    const pieces = computeAuthoredDividers(segments, 100, 100, THK, SLOT_DEPTH, CLEAR);

    expect(pieces).toHaveLength(2);
    const [v, h] = pieces;

    // Vertical piece (numbered first, front-to-back reading order)
    expect(v.orientation).toBe('vertical');
    expect(v.label).toBe('divider-01');
    expect(v.length).toBeCloseTo(100.9, 5); // 100 + 2*0.45
    expect(v.notchOffsets).toEqual([0]); // single central crossing
    expect(v.fromTop).toBe(true);
    expect(v.retention).toBe('wall');

    // Horizontal piece notches from the bottom (egg-crate 2-coloring)
    expect(h.orientation).toBe('horizontal');
    expect(h.label).toBe('divider-02');
    expect(h.fromTop).toBe(false);
    expect(h.notchOffsets).toEqual([0]);
    expect(h.retention).toBe('wall');
  });

  it('classifies an interior span between two dividers as friction (no wall, no crossing)', () => {
    // 3x3: cols 0 and 2 are full-height compartments; col 1 splits into a top
    // cell and a bottom pair, leaving a lone horizontal wall across col 1.
    const grid: CompartmentGrid = {
      cols: 3,
      rows: 3,
      cells: [0, 1, 2, 0, 3, 2, 0, 3, 2],
    };
    const segments = deriveWallSegments(grid, 90, 90);
    const pieces = computeAuthoredDividers(segments, 90, 90, THK, SLOT_DEPTH, CLEAR);

    const mid = pieces.find((p) => p.orientation === 'horizontal');
    expect(mid).toBeDefined();
    // Spans one 30mm cell between the two vertical dividers, face-to-face.
    expect(mid?.length).toBeCloseTo(30 - THK, 5);
    expect(mid?.notchOffsets).toEqual([]); // no vertical crosses it
    expect(mid?.retention).toBe('friction');
  });

  it('marks an interior piece that interlocks a perpendicular divider as crossing-retained', () => {
    // An interior "+" — two perpendicular segments crossing mid-bin, neither
    // reaching a wall. Built directly to isolate the crossing/notch math.
    const segments = [
      { x: 40, y: 20, length: 40, orientation: 'vertical' as const },
      { x: 20, y: 40, length: 40, orientation: 'horizontal' as const },
    ];
    const pieces = computeAuthoredDividers(segments, 80, 80, THK, SLOT_DEPTH, CLEAR);

    for (const p of pieces) {
      expect(p.retention).toBe('crossing'); // no wall end, one interlock
      expect(p.notchOffsets).toHaveLength(1);
    }
    // Vertical notches from the top, horizontal from the bottom.
    expect(pieces.find((p) => p.orientation === 'vertical')?.fromTop).toBe(true);
    expect(pieces.find((p) => p.orientation === 'horizontal')?.fromTop).toBe(false);
  });

  it('returns no segments for a malformed grid (guards NaN coords)', () => {
    // cells length mismatched with cols*rows (e.g. corrupted persisted config)
    expect(deriveWallSegments({ cols: 2, rows: 2, cells: [0, 1] }, 80, 80)).toEqual([]);
    expect(deriveWallSegments({ cols: 0, rows: 3, cells: [] }, 80, 80)).toEqual([]);
  });

  it('returns nothing for a single-compartment grid', () => {
    const grid: CompartmentGrid = { cols: 1, rows: 1, cells: [0] };
    expect(
      computeAuthoredDividers(deriveWallSegments(grid, 42, 42), 42, 42, THK, SLOT_DEPTH, CLEAR)
    ).toEqual([]);
  });
});
