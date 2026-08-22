import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EXPORT_TOLERANCE,
  EXPORT_ANGULAR_TOLERANCE_RAD,
  PREVIEW_ANGULAR_TOLERANCE_RAD,
  computeTessellationTolerances,
} from './tolerances';

/** OCCT's own default. Anything at or above it leaves the criterion inert. */
const OCCT_DEFAULT_ANGULAR_RAD = 0.5;

describe('computeTessellationTolerances', () => {
  it('uses fine export tolerance regardless of size or lip', () => {
    for (const maxDimension of [50, 200, 700]) {
      for (const hasLip of [true, false]) {
        expect(computeTessellationTolerances(true, hasLip, maxDimension)).toEqual({
          tolerance: EXPORT_TOLERANCE,
          angularToleranceRad: EXPORT_ANGULAR_TOLERANCE_RAD,
        });
      }
    }
  });

  it('keeps a small lipped bin crisp (fine tolerance)', () => {
    const { tolerance } = computeTessellationTolerances(false, true, 100);
    expect(tolerance).toBeLessThanOrEqual(0.06);
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

  it('uses the moderate tier for small lip-less bins (≤200mm)', () => {
    const { tolerance } = computeTessellationTolerances(false, false, 150);
    expect(tolerance).toBeGreaterThanOrEqual(0.08);
    expect(tolerance).toBeLessThanOrEqual(0.2);
  });

  it('uses the coarse tier for large lip-less bins (>200mm)', () => {
    const { tolerance } = computeTessellationTolerances(false, false, 600);
    expect(tolerance).toBeGreaterThanOrEqual(0.15);
    expect(tolerance).toBeLessThanOrEqual(0.5);
  });

  it('scales preview quality on the chord height, never on the angle', () => {
    // The angular criterion is a floor on curve smoothness, not a size dial —
    // tightening it at preview chord heights costs ~a third more triangles for
    // no visible gain, so every preview tier shares one value.
    for (const [hasLip, maxDimension] of [
      [true, 100],
      [true, 672],
      [false, 150],
      [false, 600],
    ] as const) {
      expect(computeTessellationTolerances(false, hasLip, maxDimension).angularToleranceRad).toBe(
        PREVIEW_ANGULAR_TOLERANCE_RAD
      );
    }
  });
});

describe('angular tolerance units', () => {
  // These reach OCCT through brepjs's `mesh()` in RADIANS. Degrees-shaped
  // numbers (5, 10, 12, 15) are all looser than OCCT's 0.5 default, so they
  // silently disable the criterion instead of tightening it.
  it('keeps the shared constants at or below OCCT default', () => {
    expect(EXPORT_ANGULAR_TOLERANCE_RAD).toBeLessThanOrEqual(OCCT_DEFAULT_ANGULAR_RAD);
    expect(PREVIEW_ANGULAR_TOLERANCE_RAD).toBeLessThanOrEqual(OCCT_DEFAULT_ANGULAR_RAD);
    expect(EXPORT_ANGULAR_TOLERANCE_RAD).toBeGreaterThan(0);
  });

  it('leaves no degrees-shaped literal in the generators', () => {
    const root = join(__dirname, '..');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          // Kernel-test helpers mesh solids only to measure them, and are
          // excluded from normal runs — their deflection never ships.
          if (entry.name !== '__kernel-tests__') walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.includes('.test.')) continue;
        const src = readFileSync(full, 'utf8');
        for (const m of src.matchAll(/angularTolerance\s*(?::|=|\?\?)\s*([0-9]+(?:\.[0-9]+)?)/g)) {
          if (Number(m[1]) > OCCT_DEFAULT_ANGULAR_RAD) offenders.push(`${entry.name}: ${m[0]}`);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
