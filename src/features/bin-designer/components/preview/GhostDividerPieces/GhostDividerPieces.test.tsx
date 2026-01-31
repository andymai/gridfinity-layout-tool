import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { GhostDividerPieces } from './GhostDividerPieces';

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
  class MockBoxGeometry {
    getAttribute = vi.fn(() => ({
      count: 8,
      getX: vi.fn(() => 0),
      getY: vi.fn(() => 0),
      getZ: vi.fn(() => 0),
    }));
    getIndex = vi.fn(() => ({ count: 36, array: new Uint16Array(36) }));
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

  class MockMeshStandardMaterial {
    dispose = vi.fn();
    color = { r: 0.5, g: 0.5, b: 0.5 };
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
    clone = vi.fn().mockReturnThis();
    applyMatrix4 = vi.fn().mockReturnThis();
  }

  class Color {
    r = 0.5;
    g = 0.5;
    b = 0.5;
    set = vi.fn().mockReturnThis();
    getHex = vi.fn(() => 0xcccccc);
  }

  class Matrix4 {
    makeTranslation = vi.fn().mockReturnThis();
    identity = vi.fn().mockReturnThis();
  }
  return {
    Vector3,
    Color,
    Matrix4,
    BoxGeometry: MockBoxGeometry,
    BufferGeometry: MockBufferGeometry,
    Float32BufferAttribute: vi.fn(),
    MeshBasicMaterial: MockMeshBasicMaterial,
    MeshStandardMaterial: MockMeshStandardMaterial,
    DoubleSide: 2,
  };
});

describe('GhostDividerPieces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'standard',
      },
    });
  });

  it('renders nothing when style is not slotted', () => {
    const { container } = render(<GhostDividerPieces />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no slots enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        slotConfig: {
          x: { enabled: false, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      },
    });
    const { container } = render(<GhostDividerPieces />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when style is slotted and X slots enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        slotConfig: {
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      },
    });
    const { container } = render(<GhostDividerPieces />);
    expect(container.firstChild).not.toBeNull();
  });
});
