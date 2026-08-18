import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { DEFAULT_LID_SLIDE_CONFIG } from '@/features/bin-designer/types/lid';
import type { BinParams, LidSlideConfig } from '@/features/bin-designer/types';
import { interiorReliefActive } from './lidInteriorRelief';

function relieved(over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...over,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      relieveInterior: true,
      ...over.lid,
    },
  };
}

function slideLid(placement: LidSlideConfig['placement'], stackingLip: boolean): BinParams {
  return relieved({
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip },
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      relieveInterior: true,
      attachment: 'slide',
      slide: { ...DEFAULT_LID_SLIDE_CONFIG, placement },
    },
  });
}

describe('interiorReliefActive', () => {
  it('is off unless both the lid and the relief are switched on', () => {
    expect(interiorReliefActive(DEFAULT_BIN_PARAMS)).toBe(false);
    expect(
      interiorReliefActive(relieved({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: false } }))
    ).toBe(false);
    expect(interiorReliefActive(relieved())).toBe(true);
  });

  it('requires a lip for a capping lid but not for a sliding one', () => {
    const lipless = { ...DEFAULT_BIN_PARAMS.base, stackingLip: false };
    expect(interiorReliefActive(relieved({ base: lipless }))).toBe(false);
    expect(interiorReliefActive(slideLid('recessed', false))).toBe(true);
  });

  // The flush placement on a lipped bin is a compatibility BLOCKER
  // (`slideFlushNeedsNoLip`): no channel or lid is built while it stands, so
  // relieving would gut the whole mouth of the cavity for a lid that is not
  // coming. The same design with the lip off builds, and relieves.
  it('stands down while the flush-vs-lip blocker is unresolved', () => {
    expect(interiorReliefActive(slideLid('flush', true))).toBe(false);
    expect(interiorReliefActive(slideLid('flush', false))).toBe(true);
    expect(interiorReliefActive(slideLid('recessed', true))).toBe(true);
  });

  it('has nothing to relieve on a base-only tile', () => {
    expect(
      interiorReliefActive(relieved({ base: { ...DEFAULT_BIN_PARAMS.base, tile: true } }))
    ).toBe(false);
  });
});
