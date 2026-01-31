import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import { BatchedCornerMarkers } from './BatchedCornerMarkers';

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
  class Vector3 {
    constructor(
      public x = 0,
      public y = 0,
      public z = 0
    ) {}
    set = vi.fn().mockReturnThis();
    clone = vi.fn().mockReturnThis();
    normalize = vi.fn().mockReturnThis();
    multiplyScalar = vi.fn().mockReturnThis();
    add = vi.fn().mockReturnThis();
    sub = vi.fn().mockReturnThis();
    copy = vi.fn().mockReturnThis();
    lerp = vi.fn().mockReturnThis();
    toArray = vi.fn(() => [this.x, this.y, this.z]);
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
    Vector3,
    Color,
    Box3: class {
      min = new Vector3();
      max = new Vector3();
      setFromObject = vi.fn().mockReturnThis();
      getSize = vi.fn(() => new Vector3(1, 1, 1));
    },
    BufferGeometry: class {
      setAttribute = vi.fn();
      setIndex = vi.fn();
      computeVertexNormals = vi.fn();
      dispose = vi.fn();
      translate = vi.fn();
    },
    Float32BufferAttribute: class {
      constructor(
        public array: unknown,
        public itemSize: number
      ) {}
    },
    BufferAttribute: class {
      constructor(
        public array: unknown,
        public itemSize: number
      ) {}
    },
    MeshStandardMaterial: class {
      dispose = vi.fn();
      color = new Color();
    },
    DoubleSide: 2,
    FrontSide: 0,
    BackSide: 1,
    Shape: class {
      moveTo = vi.fn();
      lineTo = vi.fn();
      closePath = vi.fn();
    },
    ExtrudeGeometry: class {
      translate = vi.fn();
      dispose = vi.fn();
      computeVertexNormals = vi.fn();
    },
    EdgesGeometry: class {
      dispose = vi.fn();
    },
    LineBasicMaterial: class {
      dispose = vi.fn();
    },
    LineSegments: class {
      geometry = {};
      material = {};
    },
    Group: class {
      add = vi.fn();
      children = [];
    },
    Mesh: class {
      geometry = {};
      material = {};
    },
    Quaternion: class {
      setFromEuler = vi.fn();
    },
    Euler: class {
      _brand = 'Euler' as const;
    },
    Matrix4: class {
      compose = vi.fn();
      identity = vi.fn();
    },
    InstancedMesh: class {
      setMatrixAt = vi.fn();
      setColorAt = vi.fn();
      instanceMatrix = { needsUpdate: false };
      instanceColor = { needsUpdate: false };
    },
    Object3D: class {
      position = new Vector3();
      quaternion = {};
      scale = new Vector3(1, 1, 1);
      updateMatrix = vi.fn();
      matrix = {};
    },
  };
});

describe('BatchedCornerMarkers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing with empty bins array', () => {
    const { container } = render(<BatchedCornerMarkers bins={[]} />);
    expect(container).toBeTruthy();
  });

  it('returns null when bins array is empty', () => {
    const { container } = render(<BatchedCornerMarkers bins={[]} />);
    expect(container.textContent).toBe('');
  });

  it('renders with single bin', () => {
    const bins = [{ x: 0, y: 0, z: 0, width: 2, depth: 2, height: 3, opacity: 1 }];
    const { container } = render(<BatchedCornerMarkers bins={bins} />);
    expect(container).toBeTruthy();
  });

  it('renders with multiple bins', () => {
    const bins = [
      { x: 0, y: 0, z: 0, width: 2, depth: 2, height: 3, opacity: 1 },
      { x: 3, y: 0, z: 0, width: 1, depth: 3, height: 3, opacity: 1 },
      { x: 5, y: 3, z: 0, width: 3, depth: 2, height: 3, opacity: 1 },
    ];
    const { container } = render(<BatchedCornerMarkers bins={bins} />);
    expect(container).toBeTruthy();
  });

  it('renders with bins at different heights', () => {
    const bins = [
      { x: 0, y: 0, z: 0, width: 2, depth: 2, height: 3, opacity: 1 },
      { x: 3, y: 0, z: 3, width: 1, depth: 3, height: 3, opacity: 1 },
    ];
    const { container } = render(<BatchedCornerMarkers bins={bins} />);
    expect(container).toBeTruthy();
  });

  it('renders with bins at different opacities', () => {
    const bins = [
      { x: 0, y: 0, z: 0, width: 2, depth: 2, height: 3, opacity: 1 },
      { x: 3, y: 0, z: 0, width: 1, depth: 3, height: 3, opacity: 0.5 },
    ];
    const { container } = render(<BatchedCornerMarkers bins={bins} />);
    expect(container).toBeTruthy();
  });
});
