import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { withLowProfileBase, withoutLowProfileBase } from './lowProfileBase';

describe('withLowProfileBase', () => {
  it('marks a standard design low profile for a low-profile layout', () => {
    expect(withLowProfileBase(DEFAULT_BIN_PARAMS, true).base.lowProfile).toBe(true);
  });

  it('returns the same reference when nothing changes', () => {
    expect(withLowProfileBase(DEFAULT_BIN_PARAMS, false)).toBe(DEFAULT_BIN_PARAMS);
    const low = withLowProfileBase(DEFAULT_BIN_PARAMS, true);
    expect(withLowProfileBase(low, true)).toBe(low);
  });

  it('lets a standard layout override a low-profile design', () => {
    const low = withLowProfileBase(DEFAULT_BIN_PARAMS, true);
    expect('lowProfile' in withLowProfileBase(low, undefined).base).toBe(false);
  });
});

describe('withoutLowProfileBase', () => {
  it('removes the field entirely', () => {
    const low = withLowProfileBase(DEFAULT_BIN_PARAMS, true);
    expect(withoutLowProfileBase(low)).toEqual(DEFAULT_BIN_PARAMS);
  });
});
