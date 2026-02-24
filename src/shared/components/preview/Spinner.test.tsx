import { describe, it, expect } from 'vitest';

import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('exports a component function', () => {
    expect(typeof Spinner).toBe('function');
  });
});
