import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import { SplitLineOverlay } from './SplitLineOverlay';

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

// Mock Drei
vi.mock('@react-three/drei', () => ({
  Line: ({ points }: { points: unknown[] }) => (
    <div data-testid="line" data-points={points?.length} />
  ),
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
    r: number;
    g: number;
    b: number;
    constructor(hex = 0xffffff) {
      this.r = ((hex >> 16) & 255) / 255;
      this.g = ((hex >> 8) & 255) / 255;
      this.b = (hex & 255) / 255;
    }
    set = vi.fn().mockReturnThis();
    getHex = vi.fn(() => 0xffffff);
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
      color = new Color(0xffffff);
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

describe('SplitLineOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing for oversized bin', () => {
    const { container } = render(
      <SplitLineOverlay
        x={0}
        y={0}
        z={0}
        width={15}
        depth={8}
        height={3}
        maxGridUnits={10}
        opacity={1}
      />
    );
    expect(container).toBeTruthy();
  });

  it('returns null when bin is not oversized', () => {
    const { container } = render(
      <SplitLineOverlay
        x={0}
        y={0}
        z={0}
        width={5}
        depth={5}
        height={3}
        maxGridUnits={10}
        opacity={1}
      />
    );
    expect(container.textContent).toBe('');
  });

  it('renders split lines when width exceeds maxGridUnits', () => {
    const { getAllByTestId } = render(
      <SplitLineOverlay
        x={0}
        y={0}
        z={0}
        width={15}
        depth={5}
        height={3}
        maxGridUnits={10}
        opacity={1}
      />
    );
    const lines = getAllByTestId('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders split lines when depth exceeds maxGridUnits', () => {
    const { getAllByTestId } = render(
      <SplitLineOverlay
        x={0}
        y={0}
        z={0}
        width={5}
        depth={15}
        height={3}
        maxGridUnits={10}
        opacity={1}
      />
    );
    const lines = getAllByTestId('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders split lines when both width and depth exceed maxGridUnits', () => {
    const { getAllByTestId } = render(
      <SplitLineOverlay
        x={0}
        y={0}
        z={0}
        width={15}
        depth={15}
        height={3}
        maxGridUnits={10}
        opacity={1}
      />
    );
    const lines = getAllByTestId('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders with different opacity', () => {
    const { container } = render(
      <SplitLineOverlay
        x={0}
        y={0}
        z={0}
        width={15}
        depth={8}
        height={3}
        maxGridUnits={10}
        opacity={0.5}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders at different positions', () => {
    const { container } = render(
      <SplitLineOverlay
        x={5}
        y={3}
        z={2}
        width={15}
        depth={8}
        height={4}
        maxGridUnits={10}
        opacity={1}
      />
    );
    expect(container).toBeTruthy();
  });
});
