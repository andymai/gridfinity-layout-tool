import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import { FloorGrid } from './FloorGrid';

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

describe('FloorGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing with integer dimensions', () => {
    const { container } = render(<FloorGrid width={10} depth={8} />);
    expect(container).toBeTruthy();
  });

  it('renders with fractional width', () => {
    const { container } = render(<FloorGrid width={10.5} depth={8} />);
    expect(container).toBeTruthy();
  });

  it('renders with fractional depth', () => {
    const { container } = render(<FloorGrid width={10} depth={8.5} />);
    expect(container).toBeTruthy();
  });

  it('renders with fractional width and depth', () => {
    const { container } = render(<FloorGrid width={10.5} depth={8.5} />);
    expect(container).toBeTruthy();
  });

  it('renders with fractionalEdgeX at start', () => {
    const { container } = render(<FloorGrid width={10.5} depth={8} fractionalEdgeX="start" />);
    expect(container).toBeTruthy();
  });

  it('renders with fractionalEdgeY at start', () => {
    const { container } = render(<FloorGrid width={10} depth={8.5} fractionalEdgeY="start" />);
    expect(container).toBeTruthy();
  });

  it('renders with both fractional edges at start', () => {
    const { container } = render(
      <FloorGrid width={10.5} depth={8.5} fractionalEdgeX="start" fractionalEdgeY="start" />
    );
    expect(container).toBeTruthy();
  });

  it('renders with small dimensions', () => {
    const { container } = render(<FloorGrid width={2} depth={2} />);
    expect(container).toBeTruthy();
  });

  it('renders with large dimensions', () => {
    const { container } = render(<FloorGrid width={50} depth={50} />);
    expect(container).toBeTruthy();
  });
});
