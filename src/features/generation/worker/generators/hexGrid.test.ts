import { describe, it, expect } from 'vitest';
import { calculateHexCenters } from './hexGrid';
import type { HexGridConfig } from './hexGrid';

function makeConfig(overrides: Partial<HexGridConfig> = {}): HexGridConfig {
  return {
    fillW: 40,
    fillH: 12,
    hexRadius: 1.8,
    webThickness: 0.8,
    ...overrides,
  };
}

describe('calculateHexCenters', () => {
  it('returns empty for zero hex radius', () => {
    expect(calculateHexCenters(makeConfig({ hexRadius: 0 }))).toEqual([]);
  });

  it('all hexes stay within fill bounds', () => {
    const config = makeConfig();
    const centers = calculateHexCenters(config);
    expect(centers.length).toBeGreaterThan(0);

    const R = config.hexRadius;
    const inradius = (Math.sqrt(3) / 2) * R;

    // Pointy-top: horizontal extent is inradius, vertical extent is R
    for (const c of centers) {
      expect(Math.abs(c.x) + inradius).toBeLessThanOrEqual(config.fillW / 2 + 0.001);
      expect(Math.abs(c.y) + R).toBeLessThanOrEqual(config.fillH / 2 + 0.001);
    }
  });

  it('produces dense grid for typical wall (40×12mm)', () => {
    const centers = calculateHexCenters(makeConfig());
    expect(centers.length).toBeGreaterThan(20);
  });

  it('more hexes with larger fill area', () => {
    const small = calculateHexCenters(makeConfig({ fillW: 20, fillH: 10 }));
    const large = calculateHexCenters(makeConfig({ fillW: 80, fillH: 25 }));
    expect(large.length).toBeGreaterThan(small.length);
  });

  it('fewer hexes with larger hex radius', () => {
    const small = calculateHexCenters(makeConfig({ hexRadius: 1.8 }));
    const large = calculateHexCenters(makeConfig({ hexRadius: 4.0 }));
    expect(large.length).toBeLessThan(small.length);
  });

  it('odd rows are staggered horizontally (pointy-top pattern)', () => {
    const config = makeConfig();
    const centers = calculateHexCenters(config);
    const R = config.hexRadius;
    const web = config.webThickness;
    const colSpacing = Math.sqrt(3) * R + web;

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
      expect(offset).toBeCloseTo(colSpacing / 2, 1);
    }
  });

  it('centers are symmetric around origin', () => {
    const centers = calculateHexCenters(makeConfig());
    const avgX = centers.reduce((s, c) => s + c.x, 0) / centers.length;
    const avgY = centers.reduce((s, c) => s + c.y, 0) / centers.length;
    expect(Math.abs(avgX)).toBeLessThan(2);
    expect(Math.abs(avgY)).toBeLessThan(2);
  });
});
