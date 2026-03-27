import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/hooks/useThemeEffect', () => ({
  useThreeColors: () => ({
    groundBounce: '#1a1a2e',
  }),
}));

const { SceneLighting } = await import('./SceneLighting');

describe('SceneLighting', () => {
  it('exports a component function', () => {
    expect(typeof SceneLighting).toBe('function');
  });
});
