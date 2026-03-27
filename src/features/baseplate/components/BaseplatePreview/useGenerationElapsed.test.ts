import { describe, it, expect } from 'vitest';
import { useGenerationElapsed } from './useGenerationElapsed';

describe('useGenerationElapsed', () => {
  it('exports a hook function', () => {
    expect(typeof useGenerationElapsed).toBe('function');
  });
});
