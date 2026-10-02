import { describe, it, expect } from 'vitest';
import { mm } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { snapClipFitsPlate } from './snapClipFit';

describe('snapClipFitsPlate', () => {
  it('fits a standard floorless plate', () => {
    expect(snapClipFitsPlate(DEFAULT_BASEPLATE_PARAMS, false, 0.4)).toBe(true);
  });

  it('does not fit a floorless low-profile plate', () => {
    expect(snapClipFitsPlate(DEFAULT_BASEPLATE_PARAMS, true, 0.4)).toBe(false);
  });

  it('fits a low-profile plate once magnets give it a floor', () => {
    const magnets = { ...DEFAULT_BASEPLATE_PARAMS, magnetHoles: true, magnetDepth: mm(2.4) };
    expect(snapClipFitsPlate(magnets, true, 0.4)).toBe(true);
  });
});
