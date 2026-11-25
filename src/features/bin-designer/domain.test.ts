import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from './constants/defaults';
import { estimateStandardBin } from './domain';
import { estimatePrint } from './utils/printEstimates';

describe('estimateStandardBin', () => {
  it('estimates the designer default bin at the given size', () => {
    expect(estimateStandardBin({ width: 3, depth: 2, height: 6 })).toEqual(
      estimatePrint({ ...DEFAULT_BIN_PARAMS, width: 3, depth: 2, height: 6 })
    );
  });
});
