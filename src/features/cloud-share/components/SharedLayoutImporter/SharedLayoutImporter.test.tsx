import { describe, it, expect } from 'vitest';

describe('SharedLayoutImporter', () => {
  it('should be defined', async () => {
    const mod = await import('./SharedLayoutImporter');
    expect(mod.SharedLayoutImporter).toBeDefined();
  });
});
