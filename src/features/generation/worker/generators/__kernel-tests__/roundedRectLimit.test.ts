// @vitest-environment node
/**
 * Re-measures the radius/size ratio at which brepjs's `drawRoundedRectangle`
 * stops building, which is the threshold `MAX_SECTION_RADIUS_FRACTION`
 * (generatorConstants.ts) sits under.
 *
 * Worth re-running on a brepjs bump: the limit is a measured property of the
 * sketcher rather than a documented one, and it fails as a hard throw rather
 * than a clamp.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { drawRoundedRectangle, mesh } from 'brepjs';
import { initBrepjs } from './wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

/** Whether brepjs will build a rounded rectangle at these proportions. */
function builds(size: number, radius: number): boolean {
  try {
    drawRoundedRectangle(size, size, radius);
    return true;
  } catch {
    return false;
  }
}

const SCALES = [0.1, 1, 42];

describe('drawRoundedRectangle limit', () => {
  it('accepts any radius under half the shorter side, at every scale', () => {
    for (const size of SCALES) {
      for (const frac of [0.1, 0.25, 0.4, 0.45, 0.49, 0.499]) {
        expect(builds(size, size * frac), `size=${size} frac=${frac}`).toBe(true);
      }
    }
  });

  it('throws at half the shorter side and beyond', () => {
    for (const size of SCALES) {
      for (const frac of [0.5, 0.5001, 0.51, 0.6, 1.0]) {
        expect(builds(size, size * frac), `size=${size} frac=${frac}`).toBe(false);
      }
    }
  });

  it('lofts a floored section against a full-size one', () => {
    const top = drawRoundedRectangle(42, 42, 4).sketchOnPlane('XY', 5);
    const bot = drawRoundedRectangle(0.25, 0.25, 0.1).sketchOnPlane('XY', 0);
    const solid = bot.loftWith([top], { ruled: true });
    try {
      const m = mesh(solid, { tolerance: 0.01, angularTolerance: 0.05 });
      expect(m.vertices.length).toBeGreaterThan(0);
    } finally {
      solid.delete();
    }
  });
});
