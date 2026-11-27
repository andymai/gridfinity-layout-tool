import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import { isUntouchedDefault } from './untouchedDesign';

describe('isUntouchedDefault', () => {
  it('recognises the default params', () => {
    expect(isUntouchedDefault({ ...DEFAULT_BIN_PARAMS })).toBe(true);
  });

  it('ignores the fields that settings and the layout write', () => {
    expect(
      isUntouchedDefault({
        ...DEFAULT_BIN_PARAMS,
        nozzleSizeMm: 0.6,
        magnetAnchor: 'center',
        base: { ...DEFAULT_BIN_PARAMS.base, lowProfile: true },
      })
    ).toBe(true);
  });

  it('sees an edit to the part', () => {
    expect(isUntouchedDefault({ ...DEFAULT_BIN_PARAMS, height: 6 })).toBe(false);
    expect(
      isUntouchedDefault({
        ...DEFAULT_BIN_PARAMS,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: !DEFAULT_BIN_PARAMS.scoop.enabled },
      })
    ).toBe(false);
  });
});
