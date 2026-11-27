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

describe('isUntouchedDefault, for edits outside the obvious fields', () => {
  it('sees an interior fillet as an edit', () => {
    expect(isUntouchedDefault({ ...DEFAULT_BIN_PARAMS, interiorFilletMm: 2 })).toBe(false);
  });

  it('sees any field it was not told to ignore, so a new feature counts at once', () => {
    const later = { ...DEFAULT_BIN_PARAMS, wallLabelSlots: { enabled: true } };
    expect(isUntouchedDefault(later as unknown as typeof DEFAULT_BIN_PARAMS)).toBe(false);
  });
});
