import { describe, it, expect } from 'vitest';
import type { CellMask } from '@/shared/utils/cellMask';
import { findPolygonEdgeForSide, resolvePolygonSideGeometry } from './maskPolygonEdges';

/**
 * Build a CellMask from a top-down 2D array of 0/1.
 * Rows are visual (top-to-bottom); cellMask rows run bottom-to-top, so flip.
 */
function makeMask(rows: ReadonlyArray<ReadonlyArray<0 | 1>>): CellMask {
  const rowCount = rows.length;
  const colCount = rows[0].length;
  const cells: Array<0 | 1> = new Array<0 | 1>(rowCount * colCount).fill(0);
  for (let r = 0; r < rowCount; r++) {
    const sourceRow = rows[rowCount - 1 - r];
    for (let c = 0; c < colCount; c++) {
      cells[r * colCount + c] = sourceRow[c];
    }
  }
  return { cols: colCount, rows: rowCount, cells };
}

describe('findPolygonEdgeForSide', () => {
  describe('fully filled rectangle', () => {
    // 2x2 unit mask = 4x4 cells
    const rectMask = makeMask([
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ]);

    it('picks the bottom edge for front', () => {
      const edge = findPolygonEdgeForSide(rectMask, 'front');
      expect(edge).not.toBeNull();
      expect(edge!.perpU).toBe(0);
      expect(edge!.spanU).toBe(2); // 2 grid units wide
      expect(edge!.midU).toEqual({ x: 1, y: 0 });
    });

    it('picks the top edge for back', () => {
      const edge = findPolygonEdgeForSide(rectMask, 'back');
      expect(edge).not.toBeNull();
      expect(edge!.perpU).toBe(2);
      expect(edge!.spanU).toBe(2);
      expect(edge!.midU).toEqual({ x: 1, y: 2 });
    });

    it('picks the left edge for left', () => {
      const edge = findPolygonEdgeForSide(rectMask, 'left');
      expect(edge).not.toBeNull();
      expect(edge!.perpU).toBe(0);
      expect(edge!.spanU).toBe(2);
      expect(edge!.midU).toEqual({ x: 0, y: 1 });
    });

    it('picks the right edge for right', () => {
      const edge = findPolygonEdgeForSide(rectMask, 'right');
      expect(edge).not.toBeNull();
      expect(edge!.perpU).toBe(2);
      expect(edge!.spanU).toBe(2);
      expect(edge!.midU).toEqual({ x: 2, y: 1 });
    });
  });

  describe('L-shape (notch top-right)', () => {
    // 2x2 unit mask with top-right unit (cols 2-3, rows 2-3) empty
    const lMask = makeMask([
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ]);

    it('picks the full bottom for front (single candidate)', () => {
      const edge = findPolygonEdgeForSide(lMask, 'front');
      expect(edge!.perpU).toBe(0);
      expect(edge!.spanU).toBe(2);
    });

    it('picks the outermost top edge for back (extremum over notch-shelf)', () => {
      // Two candidates: the shelf at y=1 (over the notch) and the outer top at y=2
      const edge = findPolygonEdgeForSide(lMask, 'back');
      expect(edge!.perpU).toBe(2); // outermost
      expect(edge!.spanU).toBe(1); // only left column spans 1 unit at y=2
    });

    it('picks the outermost right edge', () => {
      // Two candidates: right edge of bottom row at x=2 (span 1) and right of column at x=1 (span 1)
      const edge = findPolygonEdgeForSide(lMask, 'right');
      expect(edge!.perpU).toBe(2);
      expect(edge!.spanU).toBe(1);
    });

    it('picks the left edge spanning the full height', () => {
      const edge = findPolygonEdgeForSide(lMask, 'left');
      expect(edge!.perpU).toBe(0);
      expect(edge!.spanU).toBe(2);
    });
  });

  describe('U-shape (channel through middle)', () => {
    // 3 cols × 2 units tall with top-middle cells empty (U open at top)
    // Cells layout (top→bottom visual):
    //   [1,0,1] × 2 rows (top half has empty middle column)
    //   [1,1,1] × 2 rows (bottom half fully filled)
    // Width 3u = 6 cols, depth 2u = 4 rows
    const uMask = makeMask([
      [1, 1, 0, 0, 1, 1],
      [1, 1, 0, 0, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
    ]);

    it('picks the full bottom for front', () => {
      const edge = findPolygonEdgeForSide(uMask, 'front');
      expect(edge!.perpU).toBe(0);
      expect(edge!.spanU).toBe(3);
    });

    it('picks the left arm for back on a symmetric U (deterministic tiebreak)', () => {
      // Back edges at y=2 (left arm and right arm, each span 1u) — both outermost.
      // Length ties, so the deterministic midpoint-X tiebreak wins: the LEFT arm
      // (smaller midpoint X) is selected consistently, regardless of polygon
      // traversal order. Users get reproducible results on symmetric shapes.
      const edge = findPolygonEdgeForSide(uMask, 'back');
      expect(edge!.perpU).toBe(2);
      expect(edge!.spanU).toBe(1);
      expect(edge!.midU.x).toBe(0.5); // left arm midpoint, not 2.5 (right arm)
    });

    it('picks the outermost left edge', () => {
      const edge = findPolygonEdgeForSide(uMask, 'left');
      expect(edge!.perpU).toBe(0);
      expect(edge!.spanU).toBe(2); // full height
    });

    it('picks the outermost right edge', () => {
      const edge = findPolygonEdgeForSide(uMask, 'right');
      expect(edge!.perpU).toBe(3);
      expect(edge!.spanU).toBe(2); // full height
    });
  });
});

describe('resolvePolygonSideGeometry', () => {
  const GRID_UNIT = 42;
  const WALL = 0.95;
  // CLEARANCE / 2 = 0.25 → inset = 1.2 mm
  const INSET = WALL + 0.25;

  it('matches rect-bin placement for a fully filled 2u×2u mask', () => {
    const mask = makeMask([
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ]);
    const outerW = 2 * GRID_UNIT - 0.5; // 83.5
    const innerW = outerW - 2 * WALL; // 81.6
    const innerHalf = innerW / 2; // 40.8

    const front = resolvePolygonSideGeometry(mask, GRID_UNIT, WALL, 'front');
    expect(front).not.toBeNull();
    expect(front!.rotateZ).toBe(0);
    expect(front!.x).toBeCloseTo(0, 5);
    expect(front!.y).toBeCloseTo(-innerHalf, 5);
    expect(front!.wallSpan).toBeCloseTo(innerW, 5);

    const right = resolvePolygonSideGeometry(mask, GRID_UNIT, WALL, 'right');
    expect(right!.rotateZ).toBe(90);
    expect(right!.x).toBeCloseTo(innerHalf, 5);
    expect(right!.y).toBeCloseTo(0, 5);
    expect(right!.wallSpan).toBeCloseTo(innerW, 5);
  });

  it('places cutout on the outer L-shape back wall, not the notch shelf', () => {
    const lMask = makeMask([
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ]);
    const back = resolvePolygonSideGeometry(lMask, GRID_UNIT, WALL, 'back');
    expect(back).not.toBeNull();
    expect(back!.rotateZ).toBe(0);
    // Outer edge at polygon y=2 → mm y = 2*42 - halfDepth(42) = 42, inset back by 1.2
    expect(back!.y).toBeCloseTo(42 - INSET, 5);
    // Midpoint of [0,2]→[1,2] at polygon x = 0.5 → mm x = 0.5*42 - 42 = -21
    expect(back!.x).toBeCloseTo(-21, 5);
    // Inner span = raw - CLEARANCE - 2*wallThickness (mirrors rect-bin formula)
    expect(back!.wallSpan).toBeCloseTo(42 - 0.5 - 2 * WALL, 5);
  });

  it('resolves all four sides for a trivial single-cell mask', () => {
    // Sanity check that even the smallest valid mask has matching edges on
    // every side — any axis-aligned CCW polygon traversal must include all
    // four cardinal directions to close, so the null-return path is only
    // reachable for invalid (<3-vertex) polygons, which `maskToPolygon`
    // rejects upstream. We keep the null guard defensively.
    const mask = makeMask([[1]]);
    expect(findPolygonEdgeForSide(mask, 'front')).not.toBeNull();
    expect(findPolygonEdgeForSide(mask, 'back')).not.toBeNull();
    expect(findPolygonEdgeForSide(mask, 'left')).not.toBeNull();
    expect(findPolygonEdgeForSide(mask, 'right')).not.toBeNull();
  });
});
