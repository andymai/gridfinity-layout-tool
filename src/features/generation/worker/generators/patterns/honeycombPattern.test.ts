import { describe, it, expect } from 'vitest';
import {
  HoneycombPatternCalculator,
  createHoneycombCalculator,
  DEFAULT_HEX_RADIUS,
  DEFAULT_HEX_WEB_THICKNESS,
} from './honeycombPattern';
import type { PatternGridConfig } from './types';

function makeConfig(overrides: Partial<PatternGridConfig> = {}): PatternGridConfig {
  return {
    fillW: 40,
    fillH: 12,
    ...overrides,
  };
}

describe('HoneycombPatternCalculator', () => {
  it('throws error for zero hex radius', () => {
    expect(() => new HoneycombPatternCalculator(0, DEFAULT_HEX_WEB_THICKNESS)).toThrow(
      'hexRadius must be positive'
    );
  });

  it('throws error for negative hex radius', () => {
    expect(() => new HoneycombPatternCalculator(-1, DEFAULT_HEX_WEB_THICKNESS)).toThrow(
      'hexRadius must be positive'
    );
  });

  it('throws error for negative web thickness', () => {
    expect(() => new HoneycombPatternCalculator(DEFAULT_HEX_RADIUS, -0.5)).toThrow(
      'webThickness must be non-negative'
    );
  });

  it('returns correct shape metadata', () => {
    const calculator = new HoneycombPatternCalculator(2.0, 0.8);
    expect(calculator.getShapeRadius()).toBe(2.0);
    expect(calculator.getSidesCount()).toBe(6);
    expect(calculator.getWebThickness()).toBe(0.8);
    expect(calculator.getPatternType()).toBe('honeycomb');
  });

  it('all hexes stay within fill bounds', () => {
    const calculator = new HoneycombPatternCalculator(
      DEFAULT_HEX_RADIUS,
      DEFAULT_HEX_WEB_THICKNESS
    );
    const config = makeConfig();
    const centers = calculator.calculateCenters(config);
    expect(centers.length).toBeGreaterThan(0);

    const R = DEFAULT_HEX_RADIUS;
    const inradius = (Math.sqrt(3) / 2) * R;

    // Pointy-top: horizontal extent is inradius, vertical extent is R
    for (const c of centers) {
      expect(Math.abs(c.x) + inradius).toBeLessThanOrEqual(config.fillW / 2 + 0.001);
      expect(Math.abs(c.y) + R).toBeLessThanOrEqual(config.fillH / 2 + 0.001);
    }
  });

  it('produces dense grid for typical wall (40×12mm)', () => {
    const calculator = new HoneycombPatternCalculator(
      DEFAULT_HEX_RADIUS,
      DEFAULT_HEX_WEB_THICKNESS
    );
    const centers = calculator.calculateCenters(makeConfig());
    expect(centers.length).toBeGreaterThan(20);
  });

  it('more hexes with larger fill area', () => {
    const calculator = new HoneycombPatternCalculator(
      DEFAULT_HEX_RADIUS,
      DEFAULT_HEX_WEB_THICKNESS
    );
    const small = calculator.calculateCenters(makeConfig({ fillW: 20, fillH: 10 }));
    const large = calculator.calculateCenters(makeConfig({ fillW: 80, fillH: 25 }));
    expect(large.length).toBeGreaterThan(small.length);
  });

  it('fewer hexes with larger hex radius', () => {
    const smallCalc = new HoneycombPatternCalculator(1.8, DEFAULT_HEX_WEB_THICKNESS);
    const largeCalc = new HoneycombPatternCalculator(4.0, DEFAULT_HEX_WEB_THICKNESS);
    const config = makeConfig();
    expect(largeCalc.calculateCenters(config).length).toBeLessThan(
      smallCalc.calculateCenters(config).length
    );
  });

  it('centers are symmetric around origin', () => {
    const calculator = new HoneycombPatternCalculator(
      DEFAULT_HEX_RADIUS,
      DEFAULT_HEX_WEB_THICKNESS
    );
    const centers = calculator.calculateCenters(makeConfig());
    const avgX = centers.reduce((s, c) => s + c.x, 0) / centers.length;
    const avgY = centers.reduce((s, c) => s + c.y, 0) / centers.length;
    expect(Math.abs(avgX)).toBeLessThan(2);
    expect(Math.abs(avgY)).toBeLessThan(2);
  });
});

describe('createHoneycombCalculator', () => {
  it('uses smaller hexes for small bins (≤3u)', () => {
    const smallBin = createHoneycombCalculator(2);
    const largeBin = createHoneycombCalculator(6);
    expect(smallBin.getShapeRadius()).toBeLessThan(largeBin.getShapeRadius());
  });

  it('returns 2.1mm radius for 3u bins', () => {
    const calculator = createHoneycombCalculator(3);
    expect(calculator.getShapeRadius()).toBeCloseTo(2.1);
  });

  it('returns 3.6mm radius for 4u bins', () => {
    const calculator = createHoneycombCalculator(4);
    expect(calculator.getShapeRadius()).toBeCloseTo(3.6);
  });
});
