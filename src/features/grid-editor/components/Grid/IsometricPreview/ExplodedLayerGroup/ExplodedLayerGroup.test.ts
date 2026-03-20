import { describe, it, expect } from 'vitest';
import { ExplodedLayerGroup } from './ExplodedLayerGroup';
import { lerpStep, SNAP_THRESHOLD } from './lerpStep';

describe('ExplodedLayerGroup', () => {
  it('exports the component', () => {
    expect(ExplodedLayerGroup).toBeDefined();
    expect(typeof ExplodedLayerGroup).toBe('function');
  });
});

describe('lerpStep', () => {
  it('moves toward target by fraction of remaining distance', () => {
    const result = lerpStep(0, 1.5, 1 / 60);
    expect(result).not.toBeNull();
    // delta=1/60 * LERP_SPEED=8 → factor ~0.133, so result ≈ 0 + 1.5 * 0.133 ≈ 0.2
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1.5);
  });

  it('returns null when already at target (no update needed)', () => {
    expect(lerpStep(1.5, 1.5, 1 / 60)).toBeNull();
  });

  it('snaps to target when within SNAP_THRESHOLD', () => {
    const almostThere = 1.5 - SNAP_THRESHOLD / 2;
    const result = lerpStep(almostThere, 1.5, 1 / 60);
    expect(result).toBe(1.5);
  });

  it('converges toward target over multiple steps', () => {
    let current = 0;
    const target = 1.5;
    const delta = 1 / 60;

    for (let i = 0; i < 60; i++) {
      const next = lerpStep(current, target, delta);
      if (next === null) break;
      current = next;
    }

    // After ~1 second at 60fps, should be very close to target
    expect(current).toBeCloseTo(target, 2);
  });

  it('works in reverse (animating back to 0)', () => {
    let current = 1.5;
    const target = 0;
    const delta = 1 / 60;

    for (let i = 0; i < 60; i++) {
      const next = lerpStep(current, target, delta);
      if (next === null) break;
      current = next;
    }

    expect(current).toBeCloseTo(target, 2);
  });

  it('clamps lerp factor to 1 for large delta values', () => {
    // delta=1s * LERP_SPEED=8 → clamped to 1, so jumps directly
    const result = lerpStep(0, 1.5, 1);
    expect(result).toBe(1.5);
  });
});
