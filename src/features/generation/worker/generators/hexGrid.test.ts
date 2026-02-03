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

    for (const c of centers) {
      expect(Math.abs(c.x) + R).toBeLessThanOrEqual(config.fillW / 2 + 0.001);
      expect(Math.abs(c.y) + inradius).toBeLessThanOrEqual(config.fillH / 2 + 0.001);
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

  it('odd columns are staggered vertically', () => {
    const config = makeConfig();
    const centers = calculateHexCenters(config);
    const R = config.hexRadius;
    const web = config.webThickness;
    const rowSpacing = Math.sqrt(3) * R + web;

    const cols = new Map<number, number[]>();
    for (const c of centers) {
      const key = Math.round(c.x * 100);
      if (!cols.has(key)) cols.set(key, []);
      cols.get(key)!.push(c.y);
    }

    const colKeys = Array.from(cols.keys()).sort((a, b) => a - b);
    if (colKeys.length >= 2) {
      const col0 = cols.get(colKeys[0])!.sort((a, b) => a - b);
      const col1 = cols.get(colKeys[1])!.sort((a, b) => a - b);
      const offset = Math.abs(col1[0] - col0[0]);
      expect(offset).toBeCloseTo(rowSpacing / 2, 1);
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
