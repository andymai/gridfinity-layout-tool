// @vitest-environment node
/**
 * Tests for the shared concave fillet profile builder.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__dual-kernel__/wasmInit';

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
});
