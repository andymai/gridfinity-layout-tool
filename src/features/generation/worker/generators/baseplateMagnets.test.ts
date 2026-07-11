import { describe, it, expect } from 'vitest';
import { magnetPositionsForCell, MAGNET_EDGE_CLEARANCE } from './baseplateMagnets';
import { MAGNET_OFFSETS } from './generatorConstants';
import { HOLE_OFFSET } from './generatorTypes';
import type { CellInfo } from './cellDecomposition';

const GRID = 42;
const MAGNET_R = 6.5 / 2; // standard 6.5mm magnet

function cell(widthUnits: number, depthUnits: number, centerX = 0, centerY = 0): CellInfo {
  return { widthUnits, depthUnits, centerX, centerY };
}

describe('magnetPositionsForCell', () => {
  it('gives a full 1×1 cell the standard 4 corner positions (unchanged)', () => {
    const positions = magnetPositionsForCell(cell(1, 1), MAGNET_R, GRID, GRID);
    expect(positions).toHaveLength(4);
    expect(new Set(positions.map((p) => `${p[0]},${p[1]}`))).toEqual(
      new Set(MAGNET_OFFSETS.map(([dx, dy]) => `${dx},${dy}`))
    );
  });

  it('offsets the 4 corners from a non-origin full cell center', () => {
    const positions = magnetPositionsForCell(cell(1, 1, 50, 20), MAGNET_R, GRID, GRID);
    expect(new Set(positions.map((p) => `${p[0]},${p[1]}`))).toEqual(
      new Set(MAGNET_OFFSETS.map(([dx, dy]) => `${50 + dx},${20 + dy}`))
    );
  });

  it('spreads magnets top/bottom along Y at the standard wall gap (25×42)', () => {
    // 25mm-wide foot (half 12.5) can't hold the ±13 corners → two magnets spread
    // along the long Y axis, centered in X. They sit the SAME 8mm from the end
    // wall as a regular magnet (±13 from center), not jammed against the edge.
    const positions = magnetPositionsForCell(cell(1, 1, 0, 0), MAGNET_R, 25, 42);
    expect(positions).toHaveLength(2);
    for (const [x] of positions) expect(x).toBeCloseTo(0, 6);
    const ys = positions.map((p) => p[1]).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-13, 6);
    expect(ys[1]).toBeCloseTo(13, 6);
    // 8mm center-to-wall, matching a standard magnet in a 42mm cell.
    expect(42 / 2 - ys[1]).toBeCloseTo(8, 6);
  });

  it('spreads magnets left/right along X at the standard wall gap (42×25)', () => {
    const positions = magnetPositionsForCell(cell(1, 1, 0, 0), MAGNET_R, 42, 25);
    expect(positions).toHaveLength(2);
    for (const [, y] of positions) expect(y).toBeCloseTo(0, 6);
    const xs = positions.map((p) => p[0]).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-13, 6);
    expect(xs[1]).toBeCloseTo(13, 6);
  });

  it('places more magnets along a very long narrow foot (25×84)', () => {
    const positions = magnetPositionsForCell(cell(1, 1, 0, 0), MAGNET_R, 25, 84);
    expect(positions.length).toBeGreaterThanOrEqual(3); // top, middle(s), bottom
    for (const [x] of positions) expect(x).toBeCloseTo(0, 6);
  });

  it('uses a single centered magnet when the foot is small on both axes (25×25)', () => {
    // Too short to spread two along either axis → one centered magnet.
    expect(magnetPositionsForCell(cell(1, 1, 0, 0), MAGNET_R, 25, 25)).toEqual([[0, 0]]);
  });

  it('keeps all 4 corners on a large partial tile that fits them', () => {
    // 0.9u wide: halfW = 18.9. The 4-corner pattern fits, but the offset is
    // pulled inward to hold the standard 8mm wall inset instead of ±13.
    const positions = magnetPositionsForCell(cell(0.9, 1, 0, 0), MAGNET_R, GRID, GRID);
    expect(positions).toHaveLength(4);
  });

  it('pulls near-standard cells inward to keep the standard wall distance (0.9u)', () => {
    // Regression: a 0.9u (37.8mm) cell used to keep magnets at ±13, leaving only
    // ~2.65mm to the edge. Now the offset is min(13, half − 8) so the magnet
    // sits the SAME 8mm from center-to-edge as a full 42mm cell (4.75mm wall).
    const positions = magnetPositionsForCell(cell(0.9, 0.9, 0, 0), MAGNET_R, GRID, GRID);
    const half = (0.9 * GRID) / 2; // 18.9
    const expectedOffset = Math.min(13, half - 8); // 10.9
    expect(positions).toHaveLength(4);
    for (const [x, y] of positions) {
      expect(Math.abs(x)).toBeCloseTo(expectedOffset, 6);
      expect(Math.abs(y)).toBeCloseTo(expectedOffset, 6);
      // Wall gap (edge of magnet to cell edge) equals the standard 42mm gap.
      expect(half - Math.abs(x) - MAGNET_R).toBeCloseTo(21 - 13 - MAGNET_R, 6);
    }
  });

  it('pulls in only the compressed axis on a non-square cell (42×36)', () => {
    // X keeps ±13 (full pitch), Y pulls in to hold the 8mm inset on the 36mm axis.
    const positions = magnetPositionsForCell(cell(1, 1, 0, 0), MAGNET_R, 42, 36);
    expect(positions).toHaveLength(4);
    const halfD = 18; // 36/2
    for (const [x, y] of positions) {
      expect(Math.abs(x)).toBeCloseTo(13, 6);
      expect(Math.abs(y)).toBeCloseTo(Math.min(13, halfD - 8), 6); // 10
    }
  });

  it('never lets a 4-corner magnet sit closer to the edge than a standard cell', () => {
    // The core guarantee across a sweep of square cell sizes that still hold the
    // 4-corner pattern: center-to-edge >= STANDARD_WALL_INSET (8mm).
    for (const mm of [42, 40, 38, 37, 36, 34, 30, 26]) {
      const positions = magnetPositionsForCell(cell(mm / 42, mm / 42, 0, 0), MAGNET_R, GRID, GRID);
      const half = mm / 2;
      for (const [x, y] of positions) {
        if (positions.length === 4) {
          expect(half - Math.abs(x)).toBeGreaterThanOrEqual(8 - 1e-9);
          expect(half - Math.abs(y)).toBeGreaterThanOrEqual(8 - 1e-9);
        }
      }
    }
  });

  it('emits no magnet for a tile too small for even a centered magnet', () => {
    // 0.1u (4.2mm): halfW = 2.1 < magnetRadius + clearance.
    expect(magnetPositionsForCell(cell(0.1, 0.1), MAGNET_R, GRID, GRID)).toEqual([]);
  });

  it('keeps the chosen corners within the tile footprint (with wall clearance)', () => {
    const c = cell(0.95, 0.95, 0, 0);
    const halfExtent = (0.95 * GRID) / 2;
    for (const [x, y] of magnetPositionsForCell(c, MAGNET_R, GRID, GRID)) {
      expect(Math.abs(x) + MAGNET_R + MAGNET_EDGE_CLEARANCE).toBeLessThanOrEqual(halfExtent + 1e-9);
      expect(Math.abs(y) + MAGNET_R + MAGNET_EDGE_CLEARANCE).toBeLessThanOrEqual(halfExtent + 1e-9);
    }
  });

  describe('oversized grid (gridUnitMm > 42) edge-anchoring (#2525)', () => {
    it('anchors a full 1×1 cell 8mm from the edge at pitch 50 (offset 17)', () => {
      const positions = magnetPositionsForCell(cell(1, 1), MAGNET_R, 50, 50);
      expect(positions).toHaveLength(4);
      const half = 50 / 2;
      for (const [x, y] of positions) {
        expect(Math.abs(x)).toBeCloseTo(17, 6);
        expect(Math.abs(y)).toBeCloseTo(17, 6);
        // Constant 8mm center-to-edge regardless of cell size (was ±13 pre-fix,
        // which on a 50mm cell left the magnet 12mm from the edge and drifting in).
        expect(half - Math.abs(x)).toBeCloseTo(8, 6);
        expect(half - Math.abs(y)).toBeCloseTo(8, 6);
      }
    });

    it('anchors a full 1×1 cell 8mm from the edge at pitch 60 (offset 22)', () => {
      const positions = magnetPositionsForCell(cell(1, 1), MAGNET_R, 60, 60);
      expect(positions).toHaveLength(4);
      const half = 60 / 2;
      for (const [x, y] of positions) {
        expect(Math.abs(x)).toBeCloseTo(22, 6);
        expect(Math.abs(y)).toBeCloseTo(22, 6);
        expect(half - Math.abs(x)).toBeCloseTo(8, 6);
        expect(half - Math.abs(y)).toBeCloseTo(8, 6);
      }
    });

    it('leaves a full 42mm cell at the standard ±HOLE_OFFSET (regression lock)', () => {
      const positions = magnetPositionsForCell(cell(1, 1), MAGNET_R, GRID, GRID);
      expect(positions).toHaveLength(4);
      for (const [x, y] of positions) {
        expect(Math.abs(x)).toBeCloseTo(HOLE_OFFSET, 6);
        expect(Math.abs(y)).toBeCloseTo(HOLE_OFFSET, 6);
      }
    });

    it('keeps a wide over-tile margin tile byte-identical via the HOLE_OFFSET floor (1.5u @42mm)', () => {
      // A 1.5-unit over-tile margin tile is wider than one unit, but the
      // HOLE_OFFSET floor pins its corners at ±13 rather than pushing them out to
      // the 1.5u edge — so pre-fix baseplates with over-tile margins are unchanged.
      const positions = magnetPositionsForCell(cell(1.5, 1, 0, 0), MAGNET_R, GRID, GRID);
      expect(positions).toHaveLength(4);
      for (const [x, y] of positions) {
        expect(Math.abs(x)).toBeCloseTo(HOLE_OFFSET, 6);
        expect(Math.abs(y)).toBeCloseTo(HOLE_OFFSET, 6);
      }
    });
  });
});
