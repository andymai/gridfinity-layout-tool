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
    const positions = magnetPositionsForCell(cell(1, 1), MAGNET_R, GRID);
    expect(positions).toHaveLength(4);
    expect(new Set(positions.map((p) => `${p[0]},${p[1]}`))).toEqual(
      new Set(MAGNET_OFFSETS.map(([dx, dy]) => `${dx},${dy}`))
    );
  });

  it('offsets the 4 corners from a non-origin full cell center', () => {
    const positions = magnetPositionsForCell(cell(1, 1, 50, 20), MAGNET_R, GRID);
    expect(new Set(positions.map((p) => `${p[0]},${p[1]}`))).toEqual(
      new Set(MAGNET_OFFSETS.map(([dx, dy]) => `${50 + dx},${20 + dy}`))
    );
  });

  it('keeps all 4 corners on a large partial tile that fits them', () => {
    // 0.9u wide: halfW = 18.9; corner reach = 13 + r + clearance ≈ 17.75 ≤ 18.9.
    const positions = magnetPositionsForCell(cell(0.9, 1, 0, 0), MAGNET_R, GRID);
    expect(positions).toHaveLength(4);
  });

  it('falls back to a single centered magnet on a narrow tile', () => {
    // 0.5u wide (21mm): corners (±13) cannot fit, but a centered magnet does.
    const positions = magnetPositionsForCell(cell(0.5, 1, 10, 4), MAGNET_R, GRID);
    expect(positions).toEqual([[10, 4]]);
  });

  it('emits no magnet for a tile too small for even a centered magnet', () => {
    // 0.1u (4.2mm): halfW = 2.1 < magnetRadius + clearance.
    expect(magnetPositionsForCell(cell(0.1, 0.1), MAGNET_R, GRID)).toEqual([]);
  });

  it('keeps the chosen corners within the tile footprint (with wall clearance)', () => {
    const c = cell(0.95, 0.95, 0, 0);
    const halfExtent = (0.95 * GRID) / 2;
    for (const [x, y] of magnetPositionsForCell(c, MAGNET_R, GRID)) {
      expect(Math.abs(x) + MAGNET_R + MAGNET_EDGE_CLEARANCE).toBeLessThanOrEqual(halfExtent + 1e-9);
      expect(Math.abs(y) + MAGNET_R + MAGNET_EDGE_CLEARANCE).toBeLessThanOrEqual(halfExtent + 1e-9);
    }
  });
});
