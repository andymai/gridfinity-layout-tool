import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { BinMesh } from './BinMesh';

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
  class MockBufferGeometry {
    setAttribute = vi.fn();
    setIndex = vi.fn();
    computeVertexNormals = vi.fn();
    dispose = vi.fn();
    translate = vi.fn();
  }

  class MockEdgesGeometry {
    dispose = vi.fn();
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
    EdgesGeometry: MockEdgesGeometry,
    DoubleSide: 2,
  };
});

describe('BinMesh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState({
      generation: {
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
  });

  it('renders nothing when no mesh data available', () => {
    const { container } = render(<BinMesh wireframe={false} color="#d4d8dc" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders mesh when vertices are available', () => {
    useDesignerStore.setState({
      generation: {
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          error: null,
          timingMs: 50,
        },
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<BinMesh wireframe={false} color="#d4d8dc" />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders wireframe mode', () => {
    useDesignerStore.setState({
      generation: {
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          error: null,
          timingMs: 50,
        },
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<BinMesh wireframe={true} color="#d4d8dc" />);
    expect(container.firstChild).not.toBeNull();
  });
});
