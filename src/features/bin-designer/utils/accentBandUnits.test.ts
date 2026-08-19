import { describe, it, expect } from 'vitest';
import { accentBandLayers, accentBandScale } from './accentBandUnits';

describe('accentBandScale', () => {
  it('offers a 0.1mm slider in mm mode, clamped to the bin', () => {
    const scale = accentBandScale(2, 21, 'mm', 0.2);
    expect(scale).toMatchObject({ min: 0, max: 21, step: 0.1, value: 2 });
    expect(scale.toMm(3.4)).toBe(3.4);
  });

  it('clamps a stored height taller than the bin to the slider max', () => {
    expect(accentBandScale(40, 21, 'mm', 0.2).value).toBe(21);
    expect(accentBandScale(40, 21, 'layers', 0.2).value).toBe(105);
  });

  it('offers whole layers in layers mode, bounded by what fits', () => {
    const scale = accentBandScale(2, 21, 'layers', 0.2);
    // 21mm / 0.2mm = 105 layers; 2mm reads as 10.
    expect(scale).toMatchObject({ min: 0, max: 105, step: 1, value: 10 });
  });

  it('stores clean mm from a layer count', () => {
    const { toMm } = accentBandScale(2, 21, 'layers', 0.2);
    // 12 * 0.2 is 2.4000000000000004 in binary floating point.
    expect(toMm(12)).toBe(2.4);
    expect(toMm(7)).toBe(1.4);
  });

  it('rounds a stored mm value to the nearest whole layer for display', () => {
    // 2.35mm is not a layer multiple; the slider shows the layer it is nearest.
    expect(accentBandScale(2.35, 21, 'layers', 0.2).value).toBe(12);
  });

  it('falls back to mm when the layer height cannot divide', () => {
    for (const bad of [0, -0.2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const scale = accentBandScale(2, 21, 'layers', bad);
      expect(scale).toMatchObject({ max: 21, step: 0.1, value: 2 });
    }
  });

  it('keeps at least one layer of range on a bin shorter than a layer', () => {
    // Not reachable through the panel (the cap has a 1mm floor against a layer
    // height of at most 0.32mm), but a corrupt param must not produce an empty
    // slider — nor author past the cap, which is the one case where a single
    // layer is taller than the whole bin.
    const scale = accentBandScale(0, 0.1, 'layers', 0.2);
    expect(scale.max).toBe(1);
    expect(scale.toMm(1)).toBe(0.1);
  });

  it('never authors past the cap in layers mode', () => {
    const scale = accentBandScale(2, 21, 'layers', 0.2);
    expect(scale.toMm(scale.max)).toBeLessThanOrEqual(21);
  });

  // `migrateParams` rejects a corrupt persisted height, so this is unreachable
  // in practice — but `value` is documented as living inside [min, max], and a
  // slider handed NaN renders at an undefined position rather than failing.
  it('keeps value inside the range for a corrupt stored height', () => {
    for (const unit of ['mm', 'layers'] as const) {
      for (const bad of [Number.NaN, -5, Number.NEGATIVE_INFINITY]) {
        const scale = accentBandScale(bad, 21, unit, 0.2);
        expect(Number.isFinite(scale.value)).toBe(true);
        expect(scale.value).toBeGreaterThanOrEqual(scale.min);
        expect(scale.value).toBeLessThanOrEqual(scale.max);
      }
    }
  });
});

describe('accentBandLayers', () => {
  it('reports the layer span to one decimal', () => {
    expect(accentBandLayers(2, 0.2)).toBe(10);
    expect(accentBandLayers(2.35, 0.2)).toBe(11.8);
  });

  it('returns null when the layer height cannot divide', () => {
    expect(accentBandLayers(2, 0)).toBeNull();
    expect(accentBandLayers(2, Number.NaN)).toBeNull();
  });

  it('reports zero layers for a corrupt height rather than NaN', () => {
    expect(accentBandLayers(Number.NaN, 0.2)).toBe(0);
    expect(accentBandLayers(-5, 0.2)).toBe(0);
  });
});
