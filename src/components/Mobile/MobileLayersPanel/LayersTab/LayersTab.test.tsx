import { describe, it, expect } from 'vitest';

describe('LayersTab', () => {
  it('should be defined', async () => {
    const mod = await import('./LayersTab');
    expect(mod.LayersTab).toBeDefined();
  });
});
