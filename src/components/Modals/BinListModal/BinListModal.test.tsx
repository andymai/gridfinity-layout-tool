import { describe, it, expect } from 'vitest';

describe('BinListModal', () => {
  it('should be defined', async () => {
    const mod = await import('./BinListModal');
    expect(mod.BinListModal).toBeDefined();
  });
});
