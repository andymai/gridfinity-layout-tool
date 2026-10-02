import { describe, it, expect } from 'vitest';
import { RIDGE_RELIEF_MM } from './ridgeReliefBuilder';

describe('RIDGE_RELIEF_MM', () => {
  it('clears the crest by the headroom a stock foot keeps over it', () => {
    // Half-clearance closed on the taper, plus the 0.1mm a stock bin stands
    // above the crest when it lands on the pocket floor. The seat itself is
    // measured on mated meshes in `lowProfileBase.kernel.test`.
    expect(RIDGE_RELIEF_MM).toBeCloseTo(0.35, 6);
  });
});
