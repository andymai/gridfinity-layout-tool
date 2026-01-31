import { describe, it, expect } from 'vitest';

describe('MultiBinContextMenu', () => {
  it('should be defined', async () => {
    const mod = await import('./MultiBinContextMenu');
    expect(mod.MultiBinContextMenu).toBeDefined();
  });
});
