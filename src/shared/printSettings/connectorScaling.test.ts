import { describe, it, expect } from 'vitest';
import {
  NOZZLE_BASELINE,
  scaleFeature,
  scaleClearance,
  isFeaturePrintable,
} from './connectorScaling';

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
});

describe('isFeaturePrintable', () => {
  it('passes when the available space covers the required beads', () => {
    expect(isFeaturePrintable(1.2, 0.6)).toBe(true);
    expect(isFeaturePrintable(0.8, 0.4)).toBe(true);
  });

  it('fails when a wide nozzle outgrows the available space', () => {
    expect(isFeaturePrintable(1.0, 0.6)).toBe(false); // needs 1.2
    expect(isFeaturePrintable(0.45, 0.6, 1)).toBe(false); // needs 0.6
  });

  it('treats the baseline constant as 0.4mm', () => {
    expect(NOZZLE_BASELINE).toBe(0.4);
  });
});
