import { describe, it, expect } from 'vitest';
import { NOZZLE_BASELINE, scaleFeature, scaleClearance } from './connectorScaling';

describe('scaleFeature', () => {
  it('returns the 0.4mm value unchanged at the baseline (zero regression)', () => {
    expect(scaleFeature(0.7, 0.4)).toBe(0.7);
    expect(scaleFeature(1.0, 0.4)).toBe(1.0);
  });

  it('returns the 0.4mm value unchanged below the baseline', () => {
    expect(scaleFeature(0.7, 0.2)).toBe(0.7);
  });

  it('enforces a 2-bead floor above the baseline', () => {
    expect(scaleFeature(0.7, 0.6)).toBeCloseTo(1.2); // 2 × 0.6
    expect(scaleFeature(0.7, 0.8)).toBeCloseTo(1.6); // 2 × 0.8
  });

  it('keeps a generous legacy value when it already exceeds the floor', () => {
    // 1.0mm legacy width already beats 2 × 0.4; only grows once the floor passes it.
    expect(scaleFeature(1.0, 0.4)).toBe(1.0);
    expect(scaleFeature(1.0, 0.6)).toBeCloseTo(1.2);
  });

  it('supports single-bead features (barbs) that only need to exist', () => {
    expect(scaleFeature(0.45, 0.4, 1)).toBe(0.45);
    expect(scaleFeature(0.45, 0.6, 1)).toBeCloseTo(0.6);
    expect(scaleFeature(0.45, 0.8, 1)).toBeCloseTo(0.8);
  });

  it('falls back to the legacy value for a non-finite nozzle (no NaN geometry)', () => {
    expect(scaleFeature(0.7, NaN)).toBe(0.7);
    expect(scaleFeature(0.7, Infinity)).toBe(0.7);
  });
});

describe('scaleClearance', () => {
  it('returns the 0.4mm clearance unchanged at or below the baseline', () => {
    expect(scaleClearance(0.15, 0.4)).toBe(0.15);
    expect(scaleClearance(0.15, 0.3)).toBe(0.15);
  });

  it('grows clearance with bead width above the baseline', () => {
    expect(scaleClearance(0.15, 0.6)).toBeCloseTo(0.25); // +0.5 × 0.2
    expect(scaleClearance(0.1, 0.8)).toBeCloseTo(0.3); // +0.5 × 0.4
  });

  it('honors a custom growth rate', () => {
    expect(scaleClearance(0.1, 0.6, 1.0)).toBeCloseTo(0.3);
  });

  it('falls back to the base clearance for a non-finite nozzle', () => {
    expect(scaleClearance(0.15, NaN)).toBe(0.15);
  });

  it('pins the baseline constant at 0.4mm (the tuning all the helpers assume)', () => {
    expect(NOZZLE_BASELINE).toBe(0.4);
  });
});
