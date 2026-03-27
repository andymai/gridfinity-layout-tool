import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => ({
  BufferGeometry: vi.fn().mockImplementation(() => ({
    setAttribute: vi.fn(),
    dispose: vi.fn(),
  })),
  Float32BufferAttribute: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  Text: vi.fn(() => null),
}));

vi.mock('@/shared/hooks/useThemeEffect', () => ({
  useThreeColors: () => ({
    labelColor: '#ffffff',
  }),
}));

const { DimensionLabels } = await import('./DimensionLabels');

describe('DimensionLabels', () => {
  it('exports a component function', () => {
    expect(typeof DimensionLabels).toBe('function');
  });
});
