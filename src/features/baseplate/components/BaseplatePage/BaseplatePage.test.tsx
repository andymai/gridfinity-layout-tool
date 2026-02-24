import { describe, it, expect } from 'vitest';

import { BaseplatePage } from './BaseplatePage';

describe('BaseplatePage', () => {
  it('exports a component function', () => {
    expect(typeof BaseplatePage).toBe('function');
  });
});
