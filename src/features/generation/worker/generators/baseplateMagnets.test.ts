import { describe, it, expect } from 'vitest';
import { magnetPositionsForCell, MAGNET_EDGE_CLEARANCE } from './baseplateMagnets';
import { MAGNET_OFFSETS } from './generatorConstants';
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

  it('spreads magnets top/bottom along Y for a narrow-tall foot (25×42)', () => {
    // 25mm-wide foot (half 12.5) can't hold the ±13 corners → two magnets spread
    // along the long Y axis, centered in X (x=0), symmetric about center.
    const positions = magnetPositionsForCell(cell(1, 1, 0, 0), MAGNET_R, 25, 42);
    expect(positions).toHaveLength(2);
    for (const [x] of positions) expect(x).toBeCloseTo(0, 6);
    const ys = positions.map((p) => p[1]).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-ys[1], 6); // symmetric top/bottom
    expect(ys[1]).toBeGreaterThan(0);
    // Each magnet stays a printable wall inside the 42mm foot end.
    expect(ys[1] + MAGNET_R + MAGNET_EDGE_CLEARANCE).toBeLessThanOrEqual(42 / 2 + 1e-9);
  });

  it('spreads magnets left/right along X for a wide-short foot (42×25)', () => {
    const positions = magnetPositionsForCell(cell(1, 1, 0, 0), MAGNET_R, 42, 25);
    expect(positions).toHaveLength(2);
    for (const [, y] of positions) expect(y).toBeCloseTo(0, 6);
    const xs = positions.map((p) => p[0]).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-xs[1], 6); // symmetric left/right
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
    // 0.9u wide: halfW = 18.9; ±13 + r = 16.25 ≤ 18.9, so the standard pattern fits.
    const positions = magnetPositionsForCell(cell(0.9, 1, 0, 0), MAGNET_R, GRID, GRID);
    expect(positions).toHaveLength(4);
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
});
