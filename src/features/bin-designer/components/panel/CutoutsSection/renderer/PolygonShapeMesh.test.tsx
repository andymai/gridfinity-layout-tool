import { describe, it, expect } from 'vitest';
import { PolygonShapeMesh } from './PolygonShapeMesh';

describe('PolygonShapeMesh', () => {
  it('exports a memoized component', () => {
    expect(PolygonShapeMesh).toBeDefined();
    expect(typeof PolygonShapeMesh).toBe('object'); // memo() wraps as object
  });
});
