import { describe, it, expect } from 'vitest';
import {
  clampScale,
  scaleFactor,
  elementRadiusFloor,
  resolveElementRadius,
  PATTERN_WEB_THICKNESS,
} from './patternScale';

describe('clampScale', () => {
  it('clamps out-of-range and non-finite values', () => {
    expect(clampScale(-1)).toBe(0);
    expect(clampScale(2)).toBe(1);
    expect(clampScale(0.3)).toBe(0.3);
    expect(clampScale(NaN)).toBe(0.5);
    expect(clampScale(Infinity)).toBe(1);
  });
});

describe('scaleFactor', () => {
  it('is 1.0 at the neutral midpoint so defaults reproduce legacy size', () => {
    expect(scaleFactor(0.5)).toBeCloseTo(1.0);
  });

  it('spans 0.6× (finest) to 1.4× (boldest) monotonically', () => {
    expect(scaleFactor(0)).toBeCloseTo(0.6);
    expect(scaleFactor(1)).toBeCloseTo(1.4);
    expect(scaleFactor(0.25)).toBeLessThan(scaleFactor(0.75));
  });
});

describe('elementRadiusFloor', () => {
  it('grows with bin height to bound element count on large walls', () => {
    expect(elementRadiusFloor(2)).toBeLessThan(elementRadiusFloor(4));
    expect(elementRadiusFloor(4)).toBeLessThan(elementRadiusFloor(6));
  });
});

describe('resolveElementRadius', () => {
  it('scales the base multiplicatively at neutral scale', () => {
    expect(resolveElementRadius(3.6, 4, 0.5)).toBeCloseTo(3.6);
  });

  it('never drops below the size-aware floor', () => {
    // Tiny base on a tall bin would explode element count without the floor.
    expect(resolveElementRadius(0.1, 6, 0)).toBe(elementRadiusFloor(6));
  });
});

describe('PATTERN_WEB_THICKNESS', () => {
  it('is a fixed positive structural constant', () => {
    expect(PATTERN_WEB_THICKNESS).toBeGreaterThan(0);
  });
});
