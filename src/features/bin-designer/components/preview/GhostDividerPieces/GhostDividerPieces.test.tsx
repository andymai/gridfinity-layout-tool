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
    computeVertexNormals = vi.fn();
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

  describe('cross divider modes', () => {
    const bothAxesParams = (slotOverrides: Record<string, unknown> = {}) => ({
      ...DEFAULT_BIN_PARAMS,
      style: 'slotted' as const,
      width: 2,
      depth: 2,
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 20 },
        y: { enabled: true, pitch: 20 },
        ...slotOverrides,
      },
      dividerPieces: { height: 'auto' as const, thickness: 1.6, clearance: 0.25 },
    });

    it('lap mode renders in-bin ghosts plus one reference piece per axis', () => {
      useDesignerStore.setState({ params: bothAxesParams({ crossStyle: 'lap' }) });
      const { container } = render(<GhostDividerPieces />);
      expect(container.querySelectorAll('mesh')).toHaveLength(3);
    });

    it('insert mode renders the long reference plus interior and edge short pieces', () => {
      useDesignerStore.setState({
        params: bothAxesParams({ crossStyle: 'insert', longAxis: 'y' }),
      });
      const { container } = render(<GhostDividerPieces />);
      // in-bin ghosts + long piece + short interior + short edge
      expect(container.querySelectorAll('mesh')).toHaveLength(4);
    });

    it('insert mode without short-axis rows renders only the long reference', () => {
      useDesignerStore.setState({
        params: {
          ...bothAxesParams({
            crossStyle: 'insert',
            longAxis: 'y',
            // depth 1 at 50mm pitch → innerD too small for any rows
            x: { enabled: true, pitch: 50 },
          }),
          depth: 1,
        },
      });
      const { container } = render(<GhostDividerPieces />);
      expect(container.querySelectorAll('mesh')).toHaveLength(2);
    });

    it('insert mode degrades to lap rendering when the divider is too thin', () => {
      useDesignerStore.setState({
        params: {
          ...bothAxesParams({ crossStyle: 'insert', longAxis: 'y' }),
          dividerPieces: { height: 'auto' as const, thickness: 1.0, clearance: 0.25 },
        },
      });
      const { container } = render(<GhostDividerPieces />);
      // Same shape as lap mode: ghosts + one reference per axis
      expect(container.querySelectorAll('mesh')).toHaveLength(3);
    });
  });
});
