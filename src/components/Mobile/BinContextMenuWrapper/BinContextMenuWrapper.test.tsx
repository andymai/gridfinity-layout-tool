import { describe, it, expect } from 'vitest';

describe('BinContextMenuWrapper', () => {
  it('should be defined', async () => {
    const mod = await import('./BinContextMenuWrapper');
    expect(mod.BinContextMenuWrapper).toBeDefined();
  });
});
