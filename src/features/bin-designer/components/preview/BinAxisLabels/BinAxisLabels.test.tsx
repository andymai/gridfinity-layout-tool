import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BinAxisLabels } from './BinAxisLabels';

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

vi.mock('@react-three/drei', () => ({
  Text: ({ children }: { children: ReactNode }) => <div data-testid="r3f-text">{children}</div>,
}));

vi.mock('three', () => {
  class MockBufferGeometry {
    setAttribute = vi.fn();
    setIndex = vi.fn();
    computeVertexNormals = vi.fn();
    dispose = vi.fn();
    translate = vi.fn();
  }

  const Vector3 = vi.fn((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    set: vi.fn().mockReturnThis(),
    clone: vi.fn().mockReturnThis(),
    normalize: vi.fn().mockReturnThis(),
    multiplyScalar: vi.fn().mockReturnThis(),
    add: vi.fn().mockReturnThis(),
    sub: vi.fn().mockReturnThis(),
    copy: vi.fn().mockReturnThis(),
    toArray: vi.fn(() => [x, y, z]),
  }));
  const Color = vi.fn(() => ({
    r: 0.5,
    g: 0.5,
    b: 0.5,
    set: vi.fn().mockReturnThis(),
    getHex: vi.fn(() => 0xcccccc),
    lerp: vi.fn().mockReturnThis(),
  }));
  return {
    Vector3,
    Color,
    BufferGeometry: MockBufferGeometry,
    Float32BufferAttribute: vi.fn(),
  };
});

describe('BinAxisLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing with integer dimensions', () => {
    render(<BinAxisLabels width={2} depth={3} />);
    expect(screen.getAllByTestId('r3f-text').length).toBeGreaterThan(0);
  });

  it('renders without crashing with fractional dimensions', () => {
    render(<BinAxisLabels width={2.5} depth={3.5} />);
    expect(screen.getAllByTestId('r3f-text').length).toBeGreaterThan(0);
  });

  it('renders without crashing with minimal dimensions', () => {
    render(<BinAxisLabels width={1} depth={1} />);
    expect(screen.getAllByTestId('r3f-text').length).toBeGreaterThan(0);
  });
});
