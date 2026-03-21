import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { GhostHandles } from './GhostHandles';

let mockHandleLedgesEnabled = false;
vi.mock('@/shared/hooks/useFeatureFlag', () => ({
  useFeatureFlag: (id: string) => (id === 'handle_ledges' ? mockHandleLedgesEnabled : false),
}));

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
  class MockPlaneGeometry {
    getAttribute = vi.fn(() => ({
      count: 4,
      getX: vi.fn(() => 0),
      getY: vi.fn(() => 0),
      getZ: vi.fn(() => 0),
    }));
    getIndex = vi.fn(() => ({ count: 6, array: new Uint16Array(6) }));
    dispose = vi.fn();
  }

  class MockBufferGeometry {
    setAttribute = vi.fn();
    setIndex = vi.fn();
    dispose = vi.fn();
  }

  class MockMeshBasicMaterial {
    dispose = vi.fn();
  }

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
    applyMatrix4 = vi.fn().mockReturnThis();
  }

  class Color {
    r = 0.5;
    g = 0.5;
    b = 0.5;
  }

  class Matrix4 {
    makeScale = vi.fn().mockReturnThis();
    makeRotationZ = vi.fn().mockReturnThis();
    makeTranslation = vi.fn().mockReturnThis();
    multiplyMatrices = vi.fn().mockReturnThis();
    multiply = vi.fn().mockReturnThis();
    setPosition = vi.fn().mockReturnThis();
  }
  return {
    Vector3,
    Color,
    Matrix4,
    PlaneGeometry: MockPlaneGeometry,
    BufferGeometry: MockBufferGeometry,
    Float32BufferAttribute: vi.fn(),
    MeshBasicMaterial: MockMeshBasicMaterial,
    DoubleSide: 2,
  };
});

describe('GhostHandles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleLedgesEnabled = false;
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: false,
        },
      },
      generation: {
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
  });

  it('renders nothing when handles disabled', () => {
    const { container } = render(<GhostHandles />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when not generating', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
        },
      },
      generation: {
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostHandles />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when handles enabled, flag on, and generating', () => {
    mockHandleLedgesEnabled = true;
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
        },
      },
      generation: {
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostHandles />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders nothing when style is slotted', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
        },
      },
      generation: {
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostHandles />);
    expect(container.firstChild).toBeNull();
  });
});
