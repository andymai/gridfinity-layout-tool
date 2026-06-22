import { describe, it, expect } from 'vitest';
import {
  CREASE_ANGLE_DEG,
  CREASE_ANGLE_RAD,
  DRAFT_MIN_CIRCULAR_ANGLE_DEG,
  EDGE_ANGULAR_TOLERANCE_RAD,
} from './tessellation';

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

  it('keeps the edge angular tolerance a small radian value, not a degrees magnitude', () => {
    // Units guard: brepkit's meshEdges reads this as RADIANS (kernel default
    // ~0.35 rad ≈ 20°). A degrees-magnitude value (e.g. 4) would read as ~229°
    // and disable curve refinement — the exact bug this constant fixed. Must
    // stay well under the kernel default to actually refine curved edges.
    expect(EDGE_ANGULAR_TOLERANCE_RAD).toBeGreaterThan(0);
    expect(EDGE_ANGULAR_TOLERANCE_RAD).toBeLessThan(0.35);
  });
});
