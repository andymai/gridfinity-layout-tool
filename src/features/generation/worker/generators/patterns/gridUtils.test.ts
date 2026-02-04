import { describe, it, expect } from 'vitest';
import { calculateStaggeredGrid } from './gridUtils';
import type { StaggeredGridConfig } from './gridUtils';

function makeConfig(overrides: Partial<StaggeredGridConfig> = {}): StaggeredGridConfig {
  return {
    maxX: 20,
    maxY: 10,
    colSpacing: 4,
    rowSpacing: 3,
    ...overrides,
  };
}

describe('calculateStaggeredGrid', () => {
  it('returns empty array for negative maxX', () => {
    expect(calculateStaggeredGrid(makeConfig({ maxX: -1 }))).toEqual([]);
  });

  it('returns empty array for negative maxY', () => {
    expect(calculateStaggeredGrid(makeConfig({ maxY: -1 }))).toEqual([]);
  });

  it('returns empty array for zero colSpacing', () => {
    expect(calculateStaggeredGrid(makeConfig({ colSpacing: 0 }))).toEqual([]);
  });

  it('returns empty array for zero rowSpacing', () => {
    expect(calculateStaggeredGrid(makeConfig({ rowSpacing: 0 }))).toEqual([]);
  });

  it('returns empty array for negative colSpacing', () => {
    expect(calculateStaggeredGrid(makeConfig({ colSpacing: -1 }))).toEqual([]);
  });

  it('returns empty array for negative rowSpacing', () => {
    expect(calculateStaggeredGrid(makeConfig({ rowSpacing: -1 }))).toEqual([]);
  });

  it('produces centers for valid config', () => {
    const centers = calculateStaggeredGrid(makeConfig());
    expect(centers.length).toBeGreaterThan(0);
  });

  it('all centers stay within bounds', () => {
    const config = makeConfig();
    const centers = calculateStaggeredGrid(config);

    for (const c of centers) {
      expect(Math.abs(c.x)).toBeLessThanOrEqual(config.maxX + 0.001);
      expect(Math.abs(c.y)).toBeLessThanOrEqual(config.maxY + 0.001);
    }
  });

  it('odd rows are staggered horizontally', () => {
    const config = makeConfig();
    const centers = calculateStaggeredGrid(config);

    // Group by Y coordinate (row)
    const rows = new Map<number, number[]>();
    for (const c of centers) {
      const key = Math.round(c.y * 100);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push(c.x);
    }

    const rowKeys = Array.from(rows.keys()).sort((a, b) => a - b);
    if (rowKeys.length >= 2) {
      const row0 = rows.get(rowKeys[0])!.sort((a, b) => a - b);
      const row1 = rows.get(rowKeys[1])!.sort((a, b) => a - b);
      const offset = Math.abs(row1[0] - row0[0]);
      expect(offset).toBeCloseTo(config.colSpacing / 2, 1);
    }
  });

  it('centers are symmetric around origin', () => {
    const centers = calculateStaggeredGrid(makeConfig());
    const avgX = centers.reduce((s, c) => s + c.x, 0) / centers.length;
    const avgY = centers.reduce((s, c) => s + c.y, 0) / centers.length;
    expect(Math.abs(avgX)).toBeLessThan(2);
    expect(Math.abs(avgY)).toBeLessThan(2);
  });

  it('more centers with larger fill area', () => {
    const small = calculateStaggeredGrid(makeConfig({ maxX: 10, maxY: 5 }));
    const large = calculateStaggeredGrid(makeConfig({ maxX: 40, maxY: 20 }));
    expect(large.length).toBeGreaterThan(small.length);
  });

  it('fewer centers with larger spacing', () => {
    const small = calculateStaggeredGrid(makeConfig({ colSpacing: 2, rowSpacing: 2 }));
    const large = calculateStaggeredGrid(makeConfig({ colSpacing: 6, rowSpacing: 6 }));
    expect(large.length).toBeLessThan(small.length);
  });
});
