import { describe, it, expect } from 'vitest';
import { CutoutWorkspace } from './CutoutWorkspace';

describe('CutoutWorkspace', () => {
  it('exports a function', () => {
    expect(typeof CutoutWorkspace).toBe('function');
  });
});
