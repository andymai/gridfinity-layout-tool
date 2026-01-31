import { describe, it, expect } from 'vitest';

describe('PrintLayout', () => {
  it('should be defined', async () => {
    const mod = await import('./PrintLayout');
    expect(mod.PrintLayout).toBeDefined();
  });
});
