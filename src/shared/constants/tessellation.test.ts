import { describe, it, expect } from 'vitest';
import { CREASE_ANGLE_DEG, CREASE_ANGLE_RAD, DRAFT_MIN_CIRCULAR_ANGLE_DEG } from './tessellation';

describe('tessellation constants', () => {
  it('exposes the crease threshold in degrees and radians', () => {
    expect(CREASE_ANGLE_DEG).toBe(35);
    expect(CREASE_ANGLE_RAD).toBeCloseTo((35 * Math.PI) / 180, 10);
  });

  it('keeps the draft circular angle below the crease threshold', () => {
    // Invariant: a draft facet step at/above the crease angle would make the
    // worker emit a line at every curve facet (longitudinal wireframe noise).
    expect(DRAFT_MIN_CIRCULAR_ANGLE_DEG).toBeLessThan(CREASE_ANGLE_DEG);
  });
});
