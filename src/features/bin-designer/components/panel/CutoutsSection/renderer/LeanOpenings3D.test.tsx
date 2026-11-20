import { describe, it, expect } from 'vitest';
import { RENDER_ORDER } from './constants';
import { LeanOpenings3D } from './LeanOpenings3D';

describe('LeanOpenings3D', () => {
  it('exports a function', () => {
    expect(typeof LeanOpenings3D).toBe('function');
  });

  it('draws over the shapes, because the opening reaches past them', () => {
    expect(RENDER_ORDER.LEAN_OPENING).toBeGreaterThan(RENDER_ORDER.GROUP_STROKE);
    expect(RENDER_ORDER.LEAN_OPENING).toBeLessThan(RENDER_ORDER.OFF_BOARD);
  });
});
