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

  it('fits a low-profile plate once mount-down screws give it a pad', () => {
    const screws = {
      ...DEFAULT_BASEPLATE_PARAMS,
      screwHoles: {
        enabled: true,
        diameter: mm(3),
        headStyle: 'counterbore' as const,
        headDiameter: mm(6),
        counterboreDepth: mm(3),
      },
    };
    expect(snapClipFitsPlate(screws, true, 0.4)).toBe(true);
  });

  it('never blocks a stacked plate, which strips snap clips', () => {
    const stacked = { ...DEFAULT_BASEPLATE_PARAMS, stackPrint: { enabled: true, gapMm: mm(0.2) } };
    expect(snapClipFitsPlate(stacked, true, 0.4)).toBe(true);
  });
});
