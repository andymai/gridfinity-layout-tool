import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import { MergedBinMeshes } from './MergedBinMeshes';
import { clearGeometryCache } from './geometryCache';

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
  useFrame: vi.fn(),
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
    MeshStandardMaterial: vi.fn(() => ({ dispose: vi.fn(), color: new Color() })),
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

// Mock BufferGeometryUtils
vi.mock('three/examples/jsm/utils/BufferGeometryUtils.js', () => ({
  mergeGeometries: vi.fn((_geometries: unknown[]) => ({
    setAttribute: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// Mock useBinGeometry hook
vi.mock('@/shared/hooks/useBinGeometry', () => ({
  createBinGeometry: vi.fn(() => {
    const mockGeometry = {
      setAttribute: vi.fn(),
      dispose: vi.fn(),
      translate: vi.fn(),
      clone: vi.fn(() => ({
        setAttribute: vi.fn(),
        dispose: vi.fn(),
        translate: vi.fn(),
        clone: vi.fn(),
      })),
    };
    return mockGeometry;
  }),
}));

describe('MergedBinMeshes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing with empty bins array', () => {
    const { container } = render(<MergedBinMeshes bins={[]} />);
    expect(container).toBeTruthy();
  });

  it('returns null when bins array is empty', () => {
    const { container } = render(<MergedBinMeshes bins={[]} />);
    expect(container.textContent).toBe('');
  });

  it('renders with single bin', () => {
    const bins = [
      {
        bin: { id: 'bin-1', width: 2, depth: 2 },
        x: 0,
        y: 0,
        z: 0,
        height: 3,
        color: '#ff0000',
        opacity: 1,
      },
    ];
    const { container } = render(<MergedBinMeshes bins={bins} />);
    expect(container).toBeTruthy();
  });

  it('renders with multiple bins', () => {
    const bins = [
      {
        bin: { id: 'bin-1', width: 2, depth: 2 },
        x: 0,
        y: 0,
        z: 0,
        height: 3,
        color: '#ff0000',
        opacity: 1,
      },
      {
        bin: { id: 'bin-2', width: 1, depth: 3 },
        x: 3,
        y: 0,
        z: 0,
        height: 3,
        color: '#00ff00',
        opacity: 1,
      },
      {
        bin: { id: 'bin-3', width: 3, depth: 2 },
        x: 5,
        y: 3,
        z: 0,
        height: 3,
        color: '#0000ff',
        opacity: 1,
      },
    ];
    const { container } = render(<MergedBinMeshes bins={bins} />);
    expect(container).toBeTruthy();
  });

  it('renders with bins at different heights', () => {
    const bins = [
      {
        bin: { id: 'bin-1', width: 2, depth: 2 },
        x: 0,
        y: 0,
        z: 0,
        height: 3,
        color: '#ff0000',
        opacity: 1,
      },
      {
        bin: { id: 'bin-2', width: 1, depth: 3 },
        x: 3,
        y: 0,
        z: 3,
        height: 6,
        color: '#00ff00',
        opacity: 1,
      },
    ];
    const { container } = render(<MergedBinMeshes bins={bins} />);
    expect(container).toBeTruthy();
  });

  it('renders with different opacity', () => {
    const bins = [
      {
        bin: { id: 'bin-1', width: 2, depth: 2 },
        x: 0,
        y: 0,
        z: 0,
        height: 3,
        color: '#ff0000',
        opacity: 0.5,
      },
    ];
    const { container } = render(<MergedBinMeshes bins={bins} />);
    expect(container).toBeTruthy();
  });
});

describe('clearGeometryCache', () => {
  it('is exported and callable', () => {
    expect(typeof clearGeometryCache).toBe('function');
    // Should not throw when called
    expect(() => clearGeometryCache()).not.toThrow();
  });

  it('clears cache on component unmount', () => {
    const bins = [
      {
        bin: { id: 'bin-1', width: 2, depth: 2 },
        x: 0,
        y: 0,
        z: 0,
        height: 3,
        color: '#ff0000',
        opacity: 1,
      },
    ];
    render(<MergedBinMeshes bins={bins} />);
    // Unmount should not throw (cache cleanup happens internally)
    expect(() => cleanup()).not.toThrow();
  });
});

describe('geometry caching', () => {
  beforeEach(() => {
    clearGeometryCache();
  });

  it('reuses geometry for bins with identical dimensions', async () => {
    const { createBinGeometry } = vi.mocked(await import('@/shared/hooks/useBinGeometry'));

    // Two bins with same dimensions and color
    const bins = [
      {
        bin: { id: 'bin-1', width: 2, depth: 2 },
        x: 0,
        y: 0,
        z: 0,
        height: 3,
        color: '#ff0000',
        opacity: 1,
      },
      {
        bin: { id: 'bin-2', width: 2, depth: 2 },
        x: 3,
        y: 0,
        z: 0,
        height: 3,
        color: '#ff0000',
        opacity: 1,
      },
    ];

    createBinGeometry.mockClear();
    render(<MergedBinMeshes bins={bins} />);

    // Should only create geometry once due to caching
    expect(createBinGeometry).toHaveBeenCalledTimes(1);
  });

  it('creates separate geometries for different dimensions', async () => {
    const { createBinGeometry } = vi.mocked(await import('@/shared/hooks/useBinGeometry'));

    // Two bins with different dimensions
    const bins = [
      {
        bin: { id: 'bin-1', width: 2, depth: 2 },
        x: 0,
        y: 0,
        z: 0,
        height: 3,
        color: '#ff0000',
        opacity: 1,
      },
      {
        bin: { id: 'bin-2', width: 3, depth: 1 },
        x: 3,
        y: 0,
        z: 0,
        height: 5,
        color: '#00ff00',
        opacity: 1,
      },
    ];

    createBinGeometry.mockClear();
    render(<MergedBinMeshes bins={bins} />);

    // Should create geometry twice for different dimensions
    expect(createBinGeometry).toHaveBeenCalledTimes(2);
  });
});
