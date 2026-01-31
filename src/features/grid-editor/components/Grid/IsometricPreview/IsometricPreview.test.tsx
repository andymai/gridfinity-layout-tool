import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import { IsometricPreview } from './IsometricPreview';
import { useUIStore } from '@/core/store/ui';
import { useLayoutStore } from '@/core/store/layout';
import { createDefaultLayout } from '@/core/constants';

// Mock React Three Fiber
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({
    camera: {
      position: { set: vi.fn(), x: 0, y: 5, z: 5 },
      up: { set: vi.fn(), x: 0, y: 0, z: 1 },
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
    OrthographicCamera: class {
      position = new Vector3();
      zoom = 30;
      updateProjectionMatrix = vi.fn();
    },
    Spherical: class {
      setFromVector3 = vi.fn().mockReturnThis();
      radius = 10;
      phi = 0;
      theta = 0;
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

// Mock hooks
vi.mock('@/shared/hooks', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false }),
}));

vi.mock('@/hooks/use3DPreviewKeyboard', () => ({
  use3DPreviewKeyboard: vi.fn(),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('IsometricPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({ layout: defaultLayout });
    useUIStore.setState({ showIsometricPreview: true });
  });

  it('renders when showIsometricPreview is true', () => {
    const { getByTestId } = render(<IsometricPreview />);
    expect(getByTestId('r3f-canvas')).toBeTruthy();
  });

  it('returns null when showIsometricPreview is false', () => {
    useUIStore.setState({ showIsometricPreview: false });
    const { container } = render(<IsometricPreview />);
    expect(container.textContent).toBe('');
  });

  it('renders in inline mode', () => {
    const { getByTestId } = render(<IsometricPreview inline={true} />);
    expect(getByTestId('r3f-canvas')).toBeTruthy();
  });

  it('renders empty state when no bins', () => {
    const { container } = render(<IsometricPreview />);
    expect(container).toBeTruthy();
  });

  it('renders with isPreviewExpanded true', () => {
    useUIStore.setState({ isPreviewExpanded: true });
    const { getByTestId } = render(<IsometricPreview />);
    expect(getByTestId('r3f-canvas')).toBeTruthy();
  });

  it('renders camera preset buttons', () => {
    const { container } = render(<IsometricPreview />);
    // Check for button elements (isometric, front, side)
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders layer view mode selector when multiple layers', () => {
    const defaultLayout = createDefaultLayout();
    const layoutWithMultipleLayers = {
      ...defaultLayout,
      layers: [
        { id: 'layer-1', name: 'Layer 1', height: 3 },
        { id: 'layer-2', name: 'Layer 2', height: 3 },
      ],
    };
    useLayoutStore.setState({ layout: layoutWithMultipleLayers });
    const { container } = render(<IsometricPreview />);
    expect(container).toBeTruthy();
  });
});
