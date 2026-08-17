import { describe, it, expect } from 'vitest';
import { RENDER_ORDER } from './constants';
import { KeepoutCircles3D } from './KeepoutCircles3D';

describe('KeepoutCircles3D', () => {
  it('exports a function', () => {
    expect(typeof KeepoutCircles3D).toBe('function');
  });

  it('draws as scenery: above the background, below every shape', () => {
    // The discs mark where the worker will leave material standing, not an area
    // the pointer is refused. A shape drawn over one is flagged through the
    // off-board affordance instead, so these must never read as a boundary.
    expect(RENDER_ORDER.REFERENCE_OUTLINE).toBeGreaterThan(RENDER_ORDER.BACKGROUND);
    expect(RENDER_ORDER.REFERENCE_OUTLINE).toBeLessThan(RENDER_ORDER.SHAPES);
  });
});
