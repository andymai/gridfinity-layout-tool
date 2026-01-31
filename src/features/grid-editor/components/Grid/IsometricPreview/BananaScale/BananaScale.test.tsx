import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import { BananaScale } from './BananaScale';

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

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('BananaScale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing', () => {
    const { container } = render(<BananaScale drawerDepth={8} gridUnitMm={42} />);
    expect(container).toBeTruthy();
  });

  it('renders Clone component for banana model', () => {
    const { getByTestId } = render(<BananaScale drawerDepth={8} gridUnitMm={42} />);
    expect(getByTestId('clone')).toBeTruthy();
  });

  it('renders text label', () => {
    const { getByTestId } = render(<BananaScale drawerDepth={8} gridUnitMm={42} />);
    expect(getByTestId('r3f-text')).toBeTruthy();
  });

  it('renders with different drawer depths', () => {
    const { container } = render(<BananaScale drawerDepth={10} gridUnitMm={42} />);
    expect(container).toBeTruthy();
  });

  it('renders with different grid unit sizes', () => {
    const { container } = render(<BananaScale drawerDepth={8} gridUnitMm={50} />);
    expect(container).toBeTruthy();
  });
});
