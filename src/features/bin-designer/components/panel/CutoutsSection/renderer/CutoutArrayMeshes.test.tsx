import { describe, it, expect } from 'vitest';
import { CutoutArrayMeshes } from './CutoutArrayMeshes';

describe('CutoutArrayMeshes', () => {
  it('exports a memoized component', () => {
    expect(CutoutArrayMeshes).toBeDefined();
    expect(typeof CutoutArrayMeshes).toBe('object'); // memo() wraps as object
  });
});
