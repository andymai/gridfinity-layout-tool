import { describe, it, expect } from 'vitest';
import { RENDER_ORDER } from './constants';
import { ReferenceOutline3D } from './ReferenceOutline3D';

describe('ReferenceOutline3D', () => {
  it('exports a function', () => {
    expect(typeof ReferenceOutline3D).toBe('function');
  });

  it('draws as scenery: above the background, below every shape', () => {
    // The outline marks where another PART is, not where this board ends, so it
    // must never be mistaken for a boundary the shapes are clipped to. It is not
    // ordered against TAPER_BAND on purpose: the workspace passes `taperBand`
    // only on the bin board and `referenceOutline` only on the lid, so the two
    // never render together and any relation between them would be untestable.
    expect(RENDER_ORDER.REFERENCE_OUTLINE).toBeGreaterThan(RENDER_ORDER.BACKGROUND);
    expect(RENDER_ORDER.REFERENCE_OUTLINE).toBeLessThan(RENDER_ORDER.SHAPES);
  });
});
