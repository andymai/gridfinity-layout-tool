import { describe, it, expect } from 'vitest';
import { MeshFootprintMesh } from './MeshFootprintMesh';

describe('MeshFootprintMesh', () => {
  it('exports a memoized component', () => {
    expect(MeshFootprintMesh).toBeDefined();
    expect(typeof MeshFootprintMesh).toBe('object'); // memo() wraps as object
  });
});
