import { describe, it, expect } from 'vitest';
import { VertexMagnifier3D } from './VertexMagnifier3D';

// Rendering needs a WebGL context; where the inset sits is tested in loupe.test.ts.
describe('VertexMagnifier3D', () => {
  it('exports a component', () => {
    expect(typeof VertexMagnifier3D).toBe('function');
  });
});
