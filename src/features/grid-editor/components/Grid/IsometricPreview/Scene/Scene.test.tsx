import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import { Scene } from './Scene';

// Mock React Three Fiber
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({
    camera: {
      position: { set: vi.fn(), x: 0, y: 5, z: 5 },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
      up: { set: vi.fn() },
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
  OrbitControls: () => <div data-testid="orbit-controls" />,
  ContactShadows: () => <div data-testid="contact-shadows" />,
  Line: ({ points }: { points: unknown[] }) => (
    <div data-testid="line" data-points={points?.length} />
  ),
  Text: ({ children }: { children: ReactNode }) => <div data-testid="r3f-text">{children}</div>,
  Clone: ({ object }: { object: unknown }) => (
    <div data-testid="clone" data-object={String(object)} />
  ),
  useGLTF: Object.assign(
    vi.fn(() => ({ scene: { name: 'banana' }, nodes: {}, materials: {} })),
    { preload: vi.fn() }
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
    setFromSpherical = vi.fn().mockReturnThis();
  }

  class Color {
    r = 0.5;
    g = 0.5;
    b = 0.5;
    set = vi.fn().mockReturnThis();
    getHex = vi.fn(() => 0xcccccc);
    lerp = vi.fn().mockReturnThis();
  }

  class Spherical {
    setFromVector3 = vi.fn().mockReturnThis();
    radius = 10;
    phi = 0;
    theta = 0;
  }

  return {
    Vector3,
    Color,
    Spherical,
    OrthographicCamera: class {
      position = new Vector3();
      zoom = 30;
      updateProjectionMatrix = vi.fn();
      up = { set: vi.fn() };
    },
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

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('Scene', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <Scene
        drawerWidth={10}
        drawerDepth={8}
        drawerHeight={21}
        gridUnitMm={42}
        heightUnitMm={7}
        layoutName="Test Layout"
      >
        <div>Test children</div>
      </Scene>
    );
    expect(container).toBeTruthy();
  });

  it('renders children', () => {
    const { getByText } = render(
      <Scene
        drawerWidth={10}
        drawerDepth={8}
        drawerHeight={21}
        gridUnitMm={42}
        heightUnitMm={7}
        layoutName="Test Layout"
      >
        <div>Test children</div>
      </Scene>
    );
    expect(getByText('Test children')).toBeTruthy();
  });

  it('renders orbit controls', () => {
    const { getByTestId } = render(
      <Scene
        drawerWidth={10}
        drawerDepth={8}
        drawerHeight={21}
        gridUnitMm={42}
        heightUnitMm={7}
        layoutName="Test Layout"
      >
        <div>Test</div>
      </Scene>
    );
    expect(getByTestId('orbit-controls')).toBeTruthy();
  });

  it('renders contact shadows', () => {
    const { getByTestId } = render(
      <Scene
        drawerWidth={10}
        drawerDepth={8}
        drawerHeight={21}
        gridUnitMm={42}
        heightUnitMm={7}
        layoutName="Test Layout"
      >
        <div>Test</div>
      </Scene>
    );
    expect(getByTestId('contact-shadows')).toBeTruthy();
  });

  it('renders with different drawer dimensions', () => {
    const { container } = render(
      <Scene
        drawerWidth={15}
        drawerDepth={12}
        drawerHeight={30}
        gridUnitMm={42}
        heightUnitMm={7}
        layoutName="Large Layout"
      >
        <div>Test</div>
      </Scene>
    );
    expect(container).toBeTruthy();
  });

  it('renders with isExpanded prop', () => {
    const { container } = render(
      <Scene
        drawerWidth={10}
        drawerDepth={8}
        drawerHeight={21}
        gridUnitMm={42}
        heightUnitMm={7}
        layoutName="Test Layout"
        isExpanded={true}
      >
        <div>Test</div>
      </Scene>
    );
    expect(container).toBeTruthy();
  });

  it('renders with fractional edges', () => {
    const { container } = render(
      <Scene
        drawerWidth={10.5}
        drawerDepth={8.5}
        drawerHeight={21}
        gridUnitMm={42}
        heightUnitMm={7}
        layoutName="Test Layout"
        fractionalEdgeX="start"
        fractionalEdgeY="start"
      >
        <div>Test</div>
      </Scene>
    );
    expect(container).toBeTruthy();
  });
});
