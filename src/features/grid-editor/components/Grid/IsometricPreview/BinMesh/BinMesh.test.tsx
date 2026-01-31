import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import type { Bin } from '@/core/types';
import { BinMesh } from './BinMesh';

// Mock React Three Fiber
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
  useFrame: vi.fn((callback) => callback({ clock: { elapsedTime: 0 } })),
  extend: vi.fn(),
}));

// Mock Three.js
vi.mock('three', () => {
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
    lerp: vi.fn().mockReturnThis(),
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
    Box3: vi.fn(() => ({
      min: new Vector3(),
      max: new Vector3(),
      setFromObject: vi.fn().mockReturnThis(),
      getSize: vi.fn(() => new Vector3(1, 1, 1)),
    })),
    BufferGeometry: vi.fn(() => ({
      setAttribute: vi.fn(),
      setIndex: vi.fn(),
      computeVertexNormals: vi.fn(),
      dispose: vi.fn(),
      translate: vi.fn(),
    })),
    Float32BufferAttribute: vi.fn(),
    BufferAttribute: vi.fn(),
    MeshStandardMaterial: vi.fn(() => ({
      dispose: vi.fn(),
      color: new Color(),
      emissiveIntensity: 0,
    })),
    DoubleSide: 2,
    FrontSide: 0,
    BackSide: 1,
    Shape: vi.fn(() => ({ moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn() })),
    ExtrudeGeometry: vi.fn(() => ({
      translate: vi.fn(),
      dispose: vi.fn(),
      computeVertexNormals: vi.fn(),
    })),
    EdgesGeometry: vi.fn(() => ({ dispose: vi.fn() })),
    LineBasicMaterial: vi.fn(() => ({ dispose: vi.fn() })),
    LineSegments: vi.fn(() => ({ geometry: {}, material: {} })),
    Group: vi.fn(() => ({ add: vi.fn(), children: [] })),
    Mesh: vi.fn(() => ({ geometry: {}, material: {} })),
    Quaternion: vi.fn(() => ({ setFromEuler: vi.fn() })),
    Euler: vi.fn(() => ({})),
    Matrix4: vi.fn(() => ({ compose: vi.fn(), identity: vi.fn() })),
    InstancedMesh: vi.fn(() => ({
      setMatrixAt: vi.fn(),
      setColorAt: vi.fn(),
      instanceMatrix: { needsUpdate: false },
      instanceColor: { needsUpdate: false },
    })),
    Object3D: vi.fn(() => ({
      position: new Vector3(),
      quaternion: {},
      scale: new Vector3(1, 1, 1),
      updateMatrix: vi.fn(),
      matrix: {},
    })),
  };
});

// Mock useBinGeometry hook
vi.mock('@/hooks/useBinGeometry', () => ({
  useBinGeometry: () => ({ setAttribute: vi.fn(), dispose: vi.fn() }),
}));

describe('BinMesh', () => {
  const mockBin: Bin = {
    id: 'test-bin-1',
    x: 2,
    y: 2,
    width: 2,
    depth: 2,
    height: 3,
    layerId: 'layer-1',
    category: 'cat-1',
    label: 'Test Bin',
    notes: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <BinMesh bin={mockBin} x={2} y={2} z={0} height={3} color="#ff0000" opacity={1} />
    );
    expect(container).toBeTruthy();
  });

  it('renders with selected state', () => {
    const { container } = render(
      <BinMesh
        bin={mockBin}
        x={2}
        y={2}
        z={0}
        height={3}
        color="#ff0000"
        opacity={1}
        isSelected={true}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders with different opacity', () => {
    const { container } = render(
      <BinMesh bin={mockBin} x={2} y={2} z={0} height={3} color="#ff0000" opacity={0.5} />
    );
    expect(container).toBeTruthy();
  });

  it('renders at different positions', () => {
    const { container } = render(
      <BinMesh bin={mockBin} x={5} y={3} z={2} height={4} color="#00ff00" opacity={1} />
    );
    expect(container).toBeTruthy();
  });

  it('renders with different colors', () => {
    const { container } = render(
      <BinMesh bin={mockBin} x={2} y={2} z={0} height={3} color="#0000ff" opacity={1} />
    );
    expect(container).toBeTruthy();
  });
});
