import { describe, it, expect } from 'vitest';
import { TextElementMesh } from './TextElementMesh';

describe('TextElementMesh', () => {
  it('exports a memoized component', () => {
    expect(typeof TextElementMesh).toBe('object');
    expect(TextElementMesh.$$typeof).toBeDefined();
  });
});
