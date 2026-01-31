import { describe, it, expect } from 'vitest';

describe('DesignerPage', () => {
  it('should be defined', async () => {
    const mod = await import('./DesignerPage');
    expect(mod.DesignerPage).toBeDefined();
  });
});
