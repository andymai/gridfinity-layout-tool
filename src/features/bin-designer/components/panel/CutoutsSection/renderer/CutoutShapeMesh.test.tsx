import { describe, it, expect } from 'vitest';
import { CutoutShapeMesh } from './CutoutShapeMesh';

describe('CutoutShapeMesh', () => {
  it('exports a memoized component', () => {
    expect(typeof CutoutShapeMesh).toBe('object');
    expect(CutoutShapeMesh.$$typeof).toBeDefined();
  });
});
