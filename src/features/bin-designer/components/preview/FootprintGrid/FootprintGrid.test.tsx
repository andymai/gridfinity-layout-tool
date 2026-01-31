import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { FootprintGrid } from './FootprintGrid';

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

  class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set = vi.fn().mockReturnThis();
    clone = vi.fn().mockReturnThis();
    normalize = vi.fn().mockReturnThis();
    multiplyScalar = vi.fn().mockReturnThis();
    add = vi.fn().mockReturnThis();
    sub = vi.fn().mockReturnThis();
    copy = vi.fn().mockReturnThis();
    toArray = vi.fn(() => [this.x, this.y, this.z]);
  }

  class Vector2 {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    set = vi.fn().mockReturnThis();
  }

  class Color {
    r = 0.5;
    g = 0.5;
    b = 0.5;
    set = vi.fn().mockReturnThis();
    getHex = vi.fn(() => 0xcccccc);
    lerp = vi.fn().mockReturnThis();
  }

  return {
    Vector2,
    Vector3,
    Color,
    ShaderMaterial: MockShaderMaterial,
    DoubleSide: 2,
  };
});

describe('FootprintGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<FootprintGrid width={2} depth={3} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders with fractional dimensions', () => {
    const { container } = render(<FootprintGrid width={2.5} depth={3.5} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders with minimal dimensions', () => {
    const { container } = render(<FootprintGrid width={1} depth={1} />);
    expect(container.firstChild).not.toBeNull();
  });
});
