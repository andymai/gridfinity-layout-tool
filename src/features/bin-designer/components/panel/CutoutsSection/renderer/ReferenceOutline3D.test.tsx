import { describe, it, expect } from 'vitest';
import { RENDER_ORDER } from './constants';
import { ReferenceOutline3D } from './ReferenceOutline3D';

describe('ReferenceOutline3D', () => {
  it('exports a function', () => {
    expect(typeof ReferenceOutline3D).toBe('function');
  });

  it('draws below the taper band', () => {
    // The outline marks where another PART is, not where this board ends, so it
    // must never draw over a real constraint. Asserted on the constant rather than
    // left to the comment: swapping the two would look fine until a lid cutout sat
    // on a tapered bin.
    expect(RENDER_ORDER.REFERENCE_OUTLINE).toBeLessThan(RENDER_ORDER.TAPER_BAND);
    expect(RENDER_ORDER.REFERENCE_OUTLINE).toBeLessThan(RENDER_ORDER.SHAPES);
    expect(RENDER_ORDER.REFERENCE_OUTLINE).toBeGreaterThan(RENDER_ORDER.BACKGROUND);
  });
});
