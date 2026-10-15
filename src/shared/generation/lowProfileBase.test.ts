import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { lidTopAboveRimMm } from '@/shared/printSettings/assembledHeight';
import { withSyncedLidHeight } from '@/features/bin-designer/utils/lidHeightUnits';
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

// Layout preview and export apply the profile to saved params without ever
// passing through the designer, so the lid has to follow the grid here.
describe('a lid sized in height units', () => {
  const unitLid = withSyncedLidHeight({
    ...DEFAULT_BIN_PARAMS,
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true, heightUnits: 1 },
  });

  it('keeps its grid top one unit above the rim in a low-profile layout', () => {
    const low = withLowProfileBase(unitLid, true);
    expect(lidTopAboveRimMm(low)).toBeCloseTo(low.heightUnitMm, 6);
  });

  it('keeps it when a low-profile design leaves with standard feet', () => {
    const standard = withoutLowProfileBase(withLowProfileBase(unitLid, true));
    expect(lidTopAboveRimMm(standard)).toBeCloseTo(standard.heightUnitMm, 6);
  });
});
