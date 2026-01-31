import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import { AxisLabels } from './AxisLabels';

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
  OrbitControls: () => <div data-testid="orbit-controls" />,
  ContactShadows: () => <div data-testid="contact-shadows" />,
  Line: ({ points }: { points: unknown[] }) => (
    <div data-testid="line" data-points={points?.length} />
  ),
  Text: ({ children }: { children: ReactNode }) => <div data-testid="r3f-text">{children}</div>,
  Html: ({ children }: { children: ReactNode }) => <div data-testid="r3f-html">{children}</div>,
  Billboard: ({ children }: { children: ReactNode }) => (
    <div data-testid="billboard">{children}</div>
  ),
  Edges: () => <div data-testid="edges" />,
  MeshTransmissionMaterial: () => <div data-testid="mesh-transmission-material" />,
  Environment: () => <div data-testid="environment" />,
  Center: ({ children }: { children: ReactNode }) => <div data-testid="center">{children}</div>,
  Float: ({ children }: { children: ReactNode }) => <div data-testid="float">{children}</div>,
  RoundedBox: (props: Record<string, unknown>) => <div data-testid="rounded-box" {...props} />,
  useGLTF: vi.fn(() => ({ nodes: {}, materials: {} })),
}));

// Mock Three.js
vi.mock('three', () => {
  // Use class syntax for proper constructors
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

  class BufferGeometry {
    setAttribute = vi.fn();
    setIndex = vi.fn();
    computeVertexNormals = vi.fn();
    dispose = vi.fn();
    translate = vi.fn();
  }

  class Float32BufferAttribute {
    _brand = 'Float32BufferAttribute' as const;
    data: unknown;
    size: unknown;
    constructor(data: unknown, size: unknown) {
      this.data = data;
      this.size = size;
    }
  }

  return {
    Vector3,
    Color,
    BufferGeometry,
    Float32BufferAttribute,
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
    Box3: vi.fn(() => ({
      min: new Vector3(),
      max: new Vector3(),
      setFromObject: vi.fn().mockReturnThis(),
      getSize: vi.fn(() => new Vector3(1, 1, 1)),
    })),
  };
});

describe('AxisLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing with integer dimensions', () => {
    const { container } = render(<AxisLabels width={10} depth={8} />);
    expect(container).toBeTruthy();
  });

  it('renders with fractional width', () => {
    const { container } = render(<AxisLabels width={10.5} depth={8} />);
    expect(container).toBeTruthy();
  });

  it('renders with fractional depth', () => {
    const { container } = render(<AxisLabels width={10} depth={8.5} />);
    expect(container).toBeTruthy();
  });

  it('renders with fractional width and depth', () => {
    const { container } = render(<AxisLabels width={10.5} depth={8.5} />);
    expect(container).toBeTruthy();
  });

  it('renders with fractionalEdgeX at start', () => {
    const { container } = render(<AxisLabels width={10.5} depth={8} fractionalEdgeX="start" />);
    expect(container).toBeTruthy();
  });

  it('renders with fractionalEdgeY at start', () => {
    const { container } = render(<AxisLabels width={10} depth={8.5} fractionalEdgeY="start" />);
    expect(container).toBeTruthy();
  });

  it('renders text labels for X and Y axes', () => {
    const { getAllByTestId } = render(<AxisLabels width={3} depth={2} />);
    const textElements = getAllByTestId('r3f-text');
    // Should have labels for X axis (1, 2, 3) and Y axis (1, 2)
    expect(textElements.length).toBeGreaterThan(0);
  });
});
