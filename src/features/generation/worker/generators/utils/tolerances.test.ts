import { describe, it, expect } from 'vitest';
import {
  EXPORT_TOLERANCE,
  EXPORT_ANGULAR_TOLERANCE,
  computeTessellationTolerances,
} from './tolerances';

describe('computeTessellationTolerances', () => {
  it('uses fine export tolerance regardless of size or lip', () => {
    for (const maxDimension of [50, 200, 700]) {
      for (const hasLip of [true, false]) {
        expect(computeTessellationTolerances(true, hasLip, maxDimension)).toEqual({
          tolerance: EXPORT_TOLERANCE,
          angularTolerance: EXPORT_ANGULAR_TOLERANCE,
        });
      }
    }
  });

  it('keeps a small lipped bin crisp (fine tolerance, tight angular)', () => {
    const { tolerance, angularTolerance } = computeTessellationTolerances(false, true, 100);
    expect(tolerance).toBeLessThanOrEqual(0.06);
    expect(angularTolerance).toBe(8);
  });

  it('relaxes the lip tolerance on large bins instead of pinning it at 0.06', () => {
    // Regression: the lip branch used to clamp at 0.06 for ANY size, so a
    // 16-grid bin (~672mm) was meshed at near-export fidelity in preview,
    // bloating the preview triangle count (memory/transfer/GPU weight). This
    // does not drive the generation timeout — the hex boolean cut does — but a
    // lighter preview mesh is worth it on large bins.
    const small = computeTessellationTolerances(false, true, 100).tolerance;
    const large = computeTessellationTolerances(false, true, 672).tolerance;
    expect(large).toBeGreaterThan(0.06);
    expect(large).toBeGreaterThan(small);
  });

  it('caps the large lipped-bin tolerance so the chamfer stays acceptable', () => {
    const large = computeTessellationTolerances(false, true, 2000).tolerance;
    expect(large).toBeLessThanOrEqual(0.15);
  });

  it('loosens the angular tolerance on large lipped bins', () => {
    expect(computeTessellationTolerances(false, true, 672).angularTolerance).toBeGreaterThan(8);
  });

  it('uses the moderate tier for small lip-less bins (≤200mm)', () => {
    const { tolerance, angularTolerance } = computeTessellationTolerances(false, false, 150);
    expect(tolerance).toBeGreaterThanOrEqual(0.08);
    expect(tolerance).toBeLessThanOrEqual(0.2);
    expect(angularTolerance).toBe(10);
  });

  it('uses the coarse tier for large lip-less bins (>200mm)', () => {
    const { tolerance, angularTolerance } = computeTessellationTolerances(false, false, 600);
    expect(tolerance).toBeGreaterThanOrEqual(0.15);
    expect(tolerance).toBeLessThanOrEqual(0.5);
    expect(angularTolerance).toBe(15);
  });
});
