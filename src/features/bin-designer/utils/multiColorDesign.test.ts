import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import { isMultiColorDesign } from './multiColorDesign';

describe('isMultiColorDesign', () => {
  it('is false for a default design', () => {
    expect(isMultiColorDesign(DEFAULT_BIN_PARAMS)).toBe(false);
  });

  it('is true when feature colors are on', () => {
    expect(
      isMultiColorDesign({
        ...DEFAULT_BIN_PARAMS,
        featureColors: { ...DEFAULT_BIN_PARAMS.featureColors, enabled: true },
      })
    ).toBe(true);
  });
});
