import { describe, it, expect } from 'vitest';

describe('MobileCategoriesPanel', () => {
  it('should be defined', async () => {
    const mod = await import('./MobileCategoriesPanel');
    expect(mod.MobileCategoriesPanel).toBeDefined();
  });
});
