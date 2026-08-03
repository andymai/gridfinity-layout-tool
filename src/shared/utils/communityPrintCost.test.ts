import { describe, expect, it } from 'vitest';
import type { CommunityDesignMetrics } from '@/shared/types/community';
import type { CommunityPrintSummary } from '@/shared/types/communityPrint';
import { OBSERVED_MIN_SAMPLE, fitsPrintBed, resolvePrintCost } from './communityPrintCost';
import type { CommunityPrintEstimate } from './communityPrintCost';

const ESTIMATE: CommunityPrintEstimate = { grams: 20, meters: 6.7, minutes: 100 };

function summary(overrides: Partial<CommunityPrintSummary> = {}): CommunityPrintSummary {
  return {
    count: 5,
    asDesigned: 5,
    adjusted: 0,
    didNotFit: 0,
    commonMaterial: 'pla',
    commonLayerHeightMm: 0.2,
    medianPrintMinutes: 130,
    medianFilamentGrams: 24,
    ...overrides,
  };
}

describe('resolvePrintCost', () => {
  it('falls back to the estimate when nobody has printed it', () => {
    const { time, filament } = resolvePrintCost(ESTIMATE, null);

    expect(time).toMatchObject({ minutes: 100, source: { kind: 'estimated' } });
    expect(filament).toMatchObject({ grams: 20, source: { kind: 'estimated' } });
  });

  it('prefers observed medians once the sample is large enough', () => {
    const { time, filament } = resolvePrintCost(ESTIMATE, summary());

    expect(time).toMatchObject({ minutes: 130, source: { kind: 'observed', sampleSize: 5 } });
    expect(filament).toMatchObject({ grams: 24, source: { kind: 'observed', sampleSize: 5 } });
  });

  it('keeps the estimate while only one person has reported', () => {
    const { time } = resolvePrintCost(ESTIMATE, summary({ count: 1 }));

    // One print is a data point, not a distribution: they may have printed at
    // 0.3mm on a machine nothing like yours.
    expect(time).toMatchObject({ minutes: 100, source: { kind: 'estimated' } });
  });

  it('switches over exactly at the sample threshold', () => {
    const below = resolvePrintCost(ESTIMATE, summary({ count: OBSERVED_MIN_SAMPLE - 1 }));
    const at = resolvePrintCost(ESTIMATE, summary({ count: OBSERVED_MIN_SAMPLE }));

    expect(below.time.source.kind).toBe('estimated');
    expect(at.time.source.kind).toBe('observed');
  });

  it('resolves time and filament independently', () => {
    // Reporting filament is optional, so an observed time alongside an
    // estimated weight is the normal case, not an edge case.
    const { time, filament } = resolvePrintCost(ESTIMATE, summary({ medianFilamentGrams: null }));

    expect(time.source.kind).toBe('observed');
    expect(filament).toMatchObject({ grams: 20, source: { kind: 'estimated' } });
  });

  it('reports nulls rather than zeros when there is neither estimate nor report', () => {
    const { time, filament } = resolvePrintCost(null, null);

    // A missing figure must not render as a measured zero.
    expect(time.minutes).toBeNull();
    expect(filament.grams).toBeNull();
  });

  it('still surfaces observed data when the design has no estimate', () => {
    const { time } = resolvePrintCost(null, summary());
    expect(time).toMatchObject({ minutes: 130, source: { kind: 'observed', sampleSize: 5 } });
  });
});

describe('fitsPrintBed', () => {
  function metrics(width: number, depth: number): CommunityDesignMetrics {
    return { width, depth, height: 42, gridUnitMm: 42 };
  }

  it('fits a design well inside the bed', () => {
    expect(fitsPrintBed(metrics(83.5, 125.5), 256, 256)).toBe('fits');
  });

  it('fits a design that only works rotated', () => {
    // Every slicer will rotate it for you, so refusing this would be wrong.
    expect(fitsPrintBed(metrics(200, 100), 120, 250)).toBe('fits');
  });

  it('rejects a design larger than the bed in both orientations', () => {
    expect(fitsPrintBed(metrics(300, 300), 256, 256)).toBe('too-large');
  });

  it('accepts a design exactly the size of the bed', () => {
    expect(fitsPrintBed(metrics(256, 256), 256, 256)).toBe('fits');
  });

  it.each([
    [0, 256],
    [256, 0],
    [Number.NaN, 256],
    [Number.POSITIVE_INFINITY, 256],
  ])('reports unknown for an unusable bed (%s x %s)', (w, d) => {
    expect(fitsPrintBed(metrics(83.5, 125.5), w, d)).toBe('unknown');
  });

  it('reports unknown for unusable metrics rather than guessing', () => {
    expect(fitsPrintBed(metrics(0, 125.5), 256, 256)).toBe('unknown');
  });
});
