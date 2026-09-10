// @vitest-environment node
/**
 * Diagnostic (not a CI gate): re-measure the radius/size ratio at which
 * brepjs's `drawRoundedRectangle` stops building, which is where
 * `MAX_SECTION_RADIUS_FRACTION` (generatorConstants.ts) comes from.
 *
 * Worth re-running on a brepjs bump: the constant is a measured limit, not a
 * documented one, and the failure it guards is a hard throw rather than a
 * clamp.
 */
import { describe, it, beforeAll } from 'vitest';
import { initBrepjs } from './wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('drawRoundedRectangle limit', () => {
  it('sweeps radius as a fraction of the shorter side', async () => {
    const { drawRoundedRectangle } = await import('brepjs');
    for (const size of [0.1, 1, 42]) {
      const results: string[] = [];
      for (const frac of [0.1, 0.25, 0.4, 0.45, 0.49, 0.499, 0.5, 0.5001, 0.51, 0.6, 1.0]) {
        try {
          drawRoundedRectangle(size, size, size * frac);
          results.push(`${frac}:ok`);
        } catch {
          results.push(`${frac}:THROW`);
        }
      }
      console.log(`\nsize=${size}mm  ${results.join('  ')}`);
    }
  });

  it('confirms a capped section still lofts against a full-size one', async () => {
    const brepjs = await import('brepjs');
    const { drawRoundedRectangle } = brepjs;
    try {
      const top = drawRoundedRectangle(42, 42, 4).sketchOnPlane('XY', 5);
      const bot = drawRoundedRectangle(0.1, 0.1, 0.04).sketchOnPlane('XY', 0);
      const solid = bot.loftWith([top], { ruled: true });
      const m = brepjs.mesh(solid, { tolerance: 0.01, angularTolerance: 0.05 });
      console.log(`\nloft 0.1mm section -> 42mm section: ok, ${m.vertices.length / 3} vertices`);
      solid.delete();
    } catch (e) {
      console.log(`\nloft 0.1mm section -> 42mm section: THREW ${String(e).slice(0, 120)}`);
    }
  });
});
