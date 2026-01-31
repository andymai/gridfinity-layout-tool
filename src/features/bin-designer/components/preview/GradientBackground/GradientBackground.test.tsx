import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { GradientBackground } from './GradientBackground';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({
    camera: {
      position: { set: vi.fn(), x: 0, y: 5, z: 5 },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
    },
    invalidate: vi.fn(),
    gl: { domElement: document.createElement('canvas') },
    size: { width: 800, height: 600 },
    scene: {},
  }),
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

vi.mock('three', () => {
  class MockShaderMaterial {
    uniforms = {};
    dispose = vi.fn();
  }

  class MockColor {
    r = 0.5;
    g = 0.5;
    b = 0.5;
    set = vi.fn().mockReturnThis();
  }

  const Vector3 = vi.fn((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    set: vi.fn().mockReturnThis(),
  }));

  return {
    Vector3,
    Color: MockColor,
    ShaderMaterial: MockShaderMaterial,
  };
});

describe('GradientBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<GradientBackground />);
    expect(container.firstChild).not.toBeNull();
  });
});
