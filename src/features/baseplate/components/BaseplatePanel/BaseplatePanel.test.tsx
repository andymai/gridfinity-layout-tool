import { describe, it, expect } from 'vitest';

import { BaseplatePanel } from './BaseplatePanel';

describe('BaseplatePanel', () => {
  it('exports a component function', () => {
    expect(typeof BaseplatePanel).toBe('function');
  });
});
