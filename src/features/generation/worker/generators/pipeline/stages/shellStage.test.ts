import { describe, it, expect } from 'vitest';
import { LIP_OVERLAP, LIP_SMALL_TAPER } from '../../generatorConstants';

describe('shellStage lip overlap', () => {
  it('LIP_OVERLAP is positive', () => {
    expect(LIP_OVERLAP).toBeGreaterThan(0);
  });

  it('LIP_OVERLAP is less than LIP_SMALL_TAPER so interiorHeight clears the lip', () => {
    // interiorHeight = wallHeight - LIP_SMALL_TAPER, and the lip base is at
    // wallHeight - LIP_OVERLAP. If LIP_OVERLAP >= LIP_SMALL_TAPER, interior
    // features would collide with the lip.
    expect(LIP_OVERLAP).toBeLessThan(LIP_SMALL_TAPER);
  });

  it('LIP_OVERLAP is below FDM minimum layer height (0.12mm)', () => {
    expect(LIP_OVERLAP).toBeLessThanOrEqual(0.12);
  });
});
