import { describe, it, expect, vi } from 'vitest';

// Mock @react-three/fiber
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ invalidate: vi.fn() }),
}));

// Mock @react-three/postprocessing — lazy import will resolve to this
vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: vi.fn(({ children }: { children: React.ReactNode }) => children),
  SSAO: vi.fn(() => null),
  Bloom: vi.fn(() => null),
}));

const { BaseplateEffects } = await import('./BaseplateEffects');

describe('BaseplateEffects', () => {
  it('exports a component function', () => {
    expect(typeof BaseplateEffects).toBe('function');
  });

  it('always returns a non-null element (invalidator is always mounted)', () => {
    const resultDisabled = BaseplateEffects({ enabled: false });
    expect(resultDisabled).not.toBeNull();

    const resultEnabled = BaseplateEffects({ enabled: true });
    expect(resultEnabled).not.toBeNull();
  });
});
