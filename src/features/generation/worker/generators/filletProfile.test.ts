// @vitest-environment node
/**
 * Tests for the shared concave fillet profile builder.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('buildFilletProfile', () => {
  it('returns a defined Drawing for valid inputs', async () => {
    const { buildFilletProfile } = await import('./filletProfile');
    const profile = buildFilletProfile(3, 10);
    expect(profile).toBeDefined();
    // Should be sketch-able (proves it is a valid Drawing)
    const sketched = profile.sketchOnPlane('XY');
    expect(sketched).toBeDefined();
  });

  it('handles radius > height by clamping gracefully', async () => {
    const { buildFilletProfile } = await import('./filletProfile');
    // radius 20 with height 5 → clamped to 4.9
    const profile = buildFilletProfile(20, 5);
    expect(profile).toBeDefined();
    const sketched = profile.sketchOnPlane('XY');
    expect(sketched).toBeDefined();
  });

  it('handles minimal radius', async () => {
    const { buildFilletProfile } = await import('./filletProfile');
    // Very small radius — should clamp to MIN_RADIUS (0.5)
    const profile = buildFilletProfile(0.1, 10);
    expect(profile).toBeDefined();
    const sketched = profile.sketchOnPlane('XY');
    expect(sketched).toBeDefined();
  });

  it('accepts explicit depth override wider than radius', async () => {
    const { buildFilletProfile } = await import('./filletProfile');
    const { mesh } = await import('brepjs');
    const { sketch } = await import('./meshUtils');
    // radius=3, height=10, depth=12 — profile should extend 12mm in depth
    const profile = buildFilletProfile(3, 10, 12);
    expect(profile).toBeDefined();
    const solid = sketch(profile, 'XY', 0).extrude(1);
    const tessellated = mesh(solid, { tolerance: 0.1, angularTolerance: 10 });
    const verts = tessellated.vertices;
    let minX = Infinity;
    for (let i = 0; i < verts.length; i += 3) {
      if (verts[i] < minX) minX = verts[i];
    }
    // The profile extends to -depth in X, so minX should be near -12
    expect(minX).toBeLessThan(-11);
  });
});
