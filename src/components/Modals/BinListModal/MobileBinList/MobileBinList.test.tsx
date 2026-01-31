import { describe, it, expect } from 'vitest';

describe('MobileBinList', () => {
  it('should be defined', async () => {
    const mod = await import('./MobileBinList');
    expect(mod.MobileBinList).toBeDefined();
  });
});
