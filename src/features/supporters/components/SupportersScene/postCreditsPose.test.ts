import { describe, expect, it, vi } from 'vitest';

vi.mock('../../data/meshes', () => ({
  MESH_META: {
    binHeight: 0.6,
    labelTab: { x0: 0, x1: 1, z0: 0, z1: 1, y: 0.5 },
    plateHeight: 0.12,
  },
}));

import { POST_CREDITS_LENGTH, postCreditsPose } from './postCreditsPose';
import { SEAT_DEPTH } from './supportersSceneGeometry';

describe('postCreditsPose', () => {
  it('drops in from above and sits in the socket', () => {
    expect(postCreditsPose(0).y).toBeGreaterThan(2);
    expect(postCreditsPose(0.8).y).toBeCloseTo(-SEAT_DEPTH, 5);
  });

  it('looks both ways while seated', () => {
    const yaws = [1.3, 2.2].map((t) => postCreditsPose(t).yaw);
    expect(Math.sign(yaws[0])).toBe(-Math.sign(yaws[1]));
  });

  it('is gone by the end, off to the side', () => {
    const end = postCreditsPose(POST_CREDITS_LENGTH);
    expect(end.scale).toBeCloseTo(0, 5);
    expect(end.x).toBeGreaterThan(2);
  });
});
