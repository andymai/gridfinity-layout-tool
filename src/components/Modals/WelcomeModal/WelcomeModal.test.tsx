import { describe, it, expect } from 'vitest';

describe('WelcomeModal', () => {
  it('should be defined', async () => {
    const mod = await import('./WelcomeModal');
    expect(mod.WelcomeModal).toBeDefined();
  });
});
