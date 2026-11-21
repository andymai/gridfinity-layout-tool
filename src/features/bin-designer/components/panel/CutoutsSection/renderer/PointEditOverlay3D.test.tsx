import { describe, it, expect } from 'vitest';
import { FalloffRing3D, TransformBox3D } from './PointEditOverlay3D';

describe('PointEditOverlay3D', () => {
  it('exports the transform box and the pull ring', () => {
    expect(typeof TransformBox3D).toBe('function');
    expect(typeof FalloffRing3D).toBe('function');
  });
});
