import { describe, it, expect } from 'vitest';
import { PathShapeMesh } from './PathShapeMesh';

describe('PathShapeMesh', () => {
  it('exports a memoized component', () => {
    expect(PathShapeMesh).toBeDefined();
    expect(typeof PathShapeMesh).toBe('object'); // memo() wraps as object
  });
});
