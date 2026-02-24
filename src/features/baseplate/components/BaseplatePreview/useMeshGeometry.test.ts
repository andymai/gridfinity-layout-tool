import { describe, it, expect } from 'vitest';
import { useMeshGeometry } from './useMeshGeometry';

describe('useMeshGeometry', () => {
  it('exports a function', () => {
    expect(typeof useMeshGeometry).toBe('function');
  });
});
