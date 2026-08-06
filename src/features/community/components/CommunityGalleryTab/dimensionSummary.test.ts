import { describe, it, expect } from 'vitest';
import { summariseDimensionFilters } from './dimensionSummary';
import type { DimensionSummaryFilters } from './dimensionSummary';

const LABELS = { width: 'W', depth: 'D', height: 'H' };

function filters(overrides: Partial<DimensionSummaryFilters> = {}): DimensionSummaryFilters {
  return {
    widthMin: null,
    widthMax: null,
    depthMin: null,
    depthMax: null,
    maxHeight: null,
    ...overrides,
  };
}

describe('summariseDimensionFilters', () => {
  it('is null when nothing is constrained', () => {
    expect(summariseDimensionFilters(filters(), LABELS)).toBeNull();
  });

  it('renders a range', () => {
    expect(summariseDimensionFilters(filters({ widthMin: 2, widthMax: 4 }), LABELS)).toBe('W 2–4');
  });

  it('collapses an equal min and max to one value', () => {
    expect(summariseDimensionFilters(filters({ widthMin: 3, widthMax: 3 }), LABELS)).toBe('W 3');
  });

  it('renders an open-ended minimum', () => {
    expect(summariseDimensionFilters(filters({ depthMin: 2 }), LABELS)).toBe('D 2+');
  });

  it('renders a ceiling', () => {
    expect(summariseDimensionFilters(filters({ depthMax: 5 }), LABELS)).toBe('D ≤5');
  });

  it('treats height as a ceiling only', () => {
    expect(summariseDimensionFilters(filters({ maxHeight: 6 }), LABELS)).toBe('H ≤6');
  });

  it('joins every constrained axis', () => {
    expect(
      summariseDimensionFilters(
        filters({ widthMin: 1, widthMax: 3, depthMax: 2, maxHeight: 6 }),
        LABELS
      )
    ).toBe('W 1–3 · D ≤2 · H ≤6');
  });

  it('keeps half-unit values readable', () => {
    expect(summariseDimensionFilters(filters({ widthMin: 1.5, widthMax: 2.5 }), LABELS)).toBe(
      'W 1.5–2.5'
    );
  });
});
