import { describe, it, expect } from 'vitest';
import { DimensionAnnotations3D } from './DimensionAnnotations3D';

/**
 * DimensionAnnotations3D is an R3F component that uses Html from drei.
 * Since we can't render R3F components in jsdom, we only test that
 * the component exports correctly and can be imported.
 */
describe('DimensionAnnotations3D', () => {
  it('exports a function component', () => {
    expect(typeof DimensionAnnotations3D).toBe('function');
    expect(DimensionAnnotations3D.name).toBe('DimensionAnnotations3D');
  });
});
