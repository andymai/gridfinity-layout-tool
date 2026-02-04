import { describe, it, expect } from 'vitest';
import {
  GothicPatternCalculator,
  createGothicCalculator,
  DEFAULT_GOTHIC_RADIUS,
  DEFAULT_GOTHIC_WEB_THICKNESS,
} from './gothicPattern';
import type { PatternGridConfig } from './types';

function makeConfig(overrides: Partial<PatternGridConfig> = {}): PatternGridConfig {
  return {
    fillW: 40,
    fillH: 15,
    ...overrides,
  };
}

describe('GothicPatternCalculator', () => {
  it('throws error for zero arch radius', () => {
    expect(() => new GothicPatternCalculator(0, DEFAULT_GOTHIC_WEB_THICKNESS)).toThrow(
      'archRadius must be positive'
    );
  });

  it('throws error for negative arch radius', () => {
    expect(() => new GothicPatternCalculator(-1, DEFAULT_GOTHIC_WEB_THICKNESS)).toThrow(
      'archRadius must be positive'
    );
  });

  it('throws error for negative web thickness', () => {
    expect(() => new GothicPatternCalculator(DEFAULT_GOTHIC_RADIUS, -0.5)).toThrow(
      'webThickness must be non-negative'
    );
  });

  it('returns correct shape metadata', () => {
    const calculator = new GothicPatternCalculator(2.0, 0.8);
    expect(calculator.getShapeRadius()).toBe(2.0);
    expect(calculator.getSidesCount()).toBe(0); // Gothic uses custom shape, not polygon
    expect(calculator.getWebThickness()).toBe(0.8);
    expect(calculator.getPatternType()).toBe('gothic');
  });

  it('provides arch dimensions', () => {
    const calculator = new GothicPatternCalculator(2.0, 0.8);
    // Arch width = 1.2 × radius, height = 1.8 × radius
    expect(calculator.getArchWidth()).toBeCloseTo(2.4);
    expect(calculator.getArchHeight()).toBeCloseTo(3.6);
  });

  it('all arches stay within fill bounds', () => {
    const calculator = new GothicPatternCalculator(
      DEFAULT_GOTHIC_RADIUS,
      DEFAULT_GOTHIC_WEB_THICKNESS
    );
    const config = makeConfig();
    const centers = calculator.calculateCenters(config);
    expect(centers.length).toBeGreaterThan(0);

    const halfW = calculator.getArchWidth() / 2;
    const halfH = calculator.getArchHeight() / 2;

    // Arches centered at (x, y) extend ±halfW horizontally and ±halfH vertically
    for (const c of centers) {
      expect(Math.abs(c.x) + halfW).toBeLessThanOrEqual(config.fillW / 2 + 0.001);
      expect(Math.abs(c.y) + halfH).toBeLessThanOrEqual(config.fillH / 2 + 0.001);
    }
  });

  it('produces arches for typical wall (40×15mm)', () => {
    const calculator = new GothicPatternCalculator(
      DEFAULT_GOTHIC_RADIUS,
      DEFAULT_GOTHIC_WEB_THICKNESS
    );
    const centers = calculator.calculateCenters(makeConfig());
    expect(centers.length).toBeGreaterThan(5);
  });

  it('more arches with larger fill area', () => {
    const calculator = new GothicPatternCalculator(
      DEFAULT_GOTHIC_RADIUS,
      DEFAULT_GOTHIC_WEB_THICKNESS
    );
    const small = calculator.calculateCenters(makeConfig({ fillW: 20, fillH: 10 }));
    const large = calculator.calculateCenters(makeConfig({ fillW: 80, fillH: 25 }));
    expect(large.length).toBeGreaterThan(small.length);
  });

  it('fewer arches with larger arch radius', () => {
    const smallCalc = new GothicPatternCalculator(2.0, DEFAULT_GOTHIC_WEB_THICKNESS);
    const largeCalc = new GothicPatternCalculator(4.0, DEFAULT_GOTHIC_WEB_THICKNESS);
    const config = makeConfig();
    expect(largeCalc.calculateCenters(config).length).toBeLessThan(
      smallCalc.calculateCenters(config).length
    );
  });

  it('centers are symmetric around origin', () => {
    const calculator = new GothicPatternCalculator(
      DEFAULT_GOTHIC_RADIUS,
      DEFAULT_GOTHIC_WEB_THICKNESS
    );
    const centers = calculator.calculateCenters(makeConfig());
    const avgX = centers.reduce((s, c) => s + c.x, 0) / centers.length;
    const avgY = centers.reduce((s, c) => s + c.y, 0) / centers.length;
    expect(Math.abs(avgX)).toBeLessThan(2);
    expect(Math.abs(avgY)).toBeLessThan(2);
  });

  it('has staggered rows like honeycomb', () => {
    const calculator = new GothicPatternCalculator(
      DEFAULT_GOTHIC_RADIUS,
      DEFAULT_GOTHIC_WEB_THICKNESS
    );
    const centers = calculator.calculateCenters(makeConfig());
    const colSpacing = calculator.getArchWidth() + calculator.getWebThickness();

    // Group centers by Y coordinate (row)
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
      // Adjacent rows should be offset by half the column spacing
      const offset = Math.abs(row1[0] - row0[0]);
      expect(offset).toBeCloseTo(colSpacing / 2, 1);
    }
  });
});

describe('createGothicCalculator', () => {
  it('uses smaller arches for small bins (≤3u)', () => {
    const smallBin = createGothicCalculator(2);
    const largeBin = createGothicCalculator(6);
    expect(smallBin.getShapeRadius()).toBeLessThan(largeBin.getShapeRadius());
  });

  it('returns 2.0mm radius for 3u bins', () => {
    const calculator = createGothicCalculator(3);
    expect(calculator.getShapeRadius()).toBeCloseTo(2.0);
  });

  it('returns 3.2mm radius for 4u bins', () => {
    const calculator = createGothicCalculator(4);
    expect(calculator.getShapeRadius()).toBeCloseTo(3.2);
  });
});
