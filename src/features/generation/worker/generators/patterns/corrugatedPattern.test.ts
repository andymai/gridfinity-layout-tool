import { describe, it, expect } from 'vitest';
import {
  createCorrugatedSpec,
  getBaseWavelength,
  generateInnerFacePoints,
  SEGMENTS_PER_HALF_WAVE,
} from './corrugatedPattern';

describe('createCorrugatedSpec', () => {
  it('returns null when wall thickness is below minimum', () => {
    expect(createCorrugatedSpec(0.8, 30, 40, 4)).toBeNull();
    expect(createCorrugatedSpec(1.2, 30, 40, 4)).toBeNull();
  });

  it('returns a spec when wall thickness meets minimum', () => {
    const spec = createCorrugatedSpec(1.6, 30, 40, 4);
    expect(spec).not.toBeNull();
  });

  it('computes amplitude as wallThickness × 0.4', () => {
    const spec = createCorrugatedSpec(1.6, 30, 40, 4);
    expect(spec?.amplitude).toBeCloseTo(0.64);

    const spec2 = createCorrugatedSpec(2.4, 30, 40, 4);
    expect(spec2?.amplitude).toBeCloseTo(0.96);
  });

  it('computes bottomZ as max(1.0, wallThickness)', () => {
    const spec = createCorrugatedSpec(1.6, 30, 40, 4);
    expect(spec?.bottomZ).toBe(1.6);

    const spec2 = createCorrugatedSpec(2.4, 30, 40, 4);
    expect(spec2?.bottomZ).toBe(2.4);
  });

  it('phase-aligns wavelength to fit integer waves in span', () => {
    // Base wavelength for height=4 is 12mm. Span=40 → round(40/12)=3 → λ=40/3≈13.33
    const spec = createCorrugatedSpec(1.6, 30, 40, 4);
    expect(spec?.waveCount).toBe(3);
    expect(spec?.wavelength).toBeCloseTo(40 / 3);
  });

  it('returns null when pattern height is too short for half a wavelength', () => {
    // Very short wall: wallHeight=4, bottomKeepOut=1.6, topKeepOut=1.5 → patternH=0.9
    const spec = createCorrugatedSpec(1.6, 4, 40, 4);
    expect(spec).toBeNull();
  });

  it('returns null when wall span is too narrow for corrugation', () => {
    // Span=3mm with base wavelength 12mm → 3 < 12/2 = too narrow
    const spec = createCorrugatedSpec(1.6, 30, 3, 4);
    expect(spec).toBeNull();
  });
});

describe('getBaseWavelength', () => {
  it('returns 8mm for short bins (≤3u)', () => {
    expect(getBaseWavelength(1)).toBe(8);
    expect(getBaseWavelength(3)).toBe(8);
  });

  it('returns 12mm for medium bins (4-6u)', () => {
    expect(getBaseWavelength(4)).toBe(12);
    expect(getBaseWavelength(6)).toBe(12);
  });

  it('returns 16mm for tall bins (>6u)', () => {
    expect(getBaseWavelength(7)).toBe(16);
    expect(getBaseWavelength(10)).toBe(16);
  });
});

describe('generateInnerFacePoints', () => {
  it('generates correct number of points', () => {
    const spec = createCorrugatedSpec(1.6, 30, 40, 4);
    expect(spec).not.toBeNull();
    const points = generateInnerFacePoints(spec!);
    // waveCount * segmentsPerHalfWave * 2 + 1 (fence-post)
    expect(points.length).toBe(spec!.waveCount * SEGMENTS_PER_HALF_WAVE * 2 + 1);
  });

  it('starts and ends at span edges', () => {
    const spec = createCorrugatedSpec(1.6, 30, 40, 4);
    expect(spec).not.toBeNull();
    const points = generateInnerFacePoints(spec!);
    expect(points[0][0]).toBeCloseTo(-20); // -halfSpan
    expect(points[points.length - 1][0]).toBeCloseTo(20); // +halfSpan
  });

  it('has Y values within expected range', () => {
    const spec = createCorrugatedSpec(1.6, 30, 40, 4);
    expect(spec).not.toBeNull();
    const points = generateInnerFacePoints(spec!);
    const minY = spec!.wallThickness;
    const maxY = spec!.wallThickness + spec!.amplitude;
    for (const [, y] of points) {
      expect(y).toBeGreaterThanOrEqual(minY - 0.001);
      expect(y).toBeLessThanOrEqual(maxY + 0.001);
    }
  });

  it('has crests (maximum thickness) at span edges', () => {
    const spec = createCorrugatedSpec(1.6, 30, 40, 4);
    expect(spec).not.toBeNull();
    const points = generateInnerFacePoints(spec!);
    const maxY = spec!.wallThickness + spec!.amplitude;
    // First and last points should be at wave crests (cosine=1 at x=0 offset)
    expect(points[0][1]).toBeCloseTo(maxY);
    expect(points[points.length - 1][1]).toBeCloseTo(maxY);
  });
});
