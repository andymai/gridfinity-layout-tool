import { describe, it, expect } from 'vitest';

import { BaseplatePreview } from './BaseplatePreview';

describe('BaseplatePreview', () => {
  it('exports a component function', () => {
    expect(typeof BaseplatePreview).toBe('function');
  });
});
