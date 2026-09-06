import { describe, it, expect } from 'vitest';
import { LIP_OVERLAP, LIP_SMALL_TAPER } from '../../generatorConstants';

describe('shellStage lip overlap', () => {
  it('LIP_OVERLAP is positive', () => {
    expect(LIP_OVERLAP).toBeGreaterThan(0);
  });

  it('LIP_OVERLAP is less than LIP_SMALL_TAPER so the skirt stays inside the wall', () => {
    // The skirt hangs LIP_OVERLAP below the lip's base plane, which is the
    // wall top; interiorHeight stops LIP_SMALL_TAPER below the same plane. A
    // skirt at or past that depth would reach into the interior instead of
    // staying buried in the wall it is there to fuse with.
    expect(LIP_OVERLAP).toBeLessThan(LIP_SMALL_TAPER);
  });

  it('LIP_OVERLAP is below FDM minimum layer height (0.12mm)', () => {
    expect(LIP_OVERLAP).toBeLessThanOrEqual(0.12);
  });
});
