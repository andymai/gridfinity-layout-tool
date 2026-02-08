import { describe, it, expect } from 'vitest';
import { SnapIndicators3D } from './SnapIndicators3D';

/**
 * SnapIndicators3D is an R3F component that renders WebGL primitives.
 * Since we can't render R3F components in jsdom, we only test that
 * the component exports correctly and can be imported.
 */
describe('SnapIndicators3D', () => {
  it('exports a function component', () => {
    expect(typeof SnapIndicators3D).toBe('function');
    expect(SnapIndicators3D.name).toBe('SnapIndicators3D');
  });
});
