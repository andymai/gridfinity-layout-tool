import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '@/features/bin-designer/constants';
import { GhostLabelTabs } from './GhostLabelTabs';

const tabScales = vi.hoisted(() => [] as number[][]);

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
    makeScale = vi.fn((...scale: number[]) => {
      tabScales.push(scale);
      return this;
    });
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

describe('GhostLabelTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabScales.length = 0;
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: false,
          width: 80,
          depth: 12,
          alignment: 'center',
        },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
  });

  it('renders nothing when labels disabled', () => {
    const { container } = render(<GhostLabelTabs />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when not generating', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          width: 80,
          depth: 12,
          alignment: 'center',
        },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostLabelTabs />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when label enabled and generating', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          width: 80,
          depth: 12,
          alignment: 'center',
        },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostLabelTabs />);
    expect(container.firstChild).not.toBeNull();
  });

  it('draws one full-width tab per row when no compartment fits a plate', () => {
    // Four columns across a 3-wide bin: each compartment is narrower than a 1U socket.
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 3,
        depth: 2,
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          mode: 'socket',
          width: 100,
          depth: 14,
          alignment: 'center',
        },
        compartments: { cols: 4, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5, 6, 7] },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    render(<GhostLabelTabs />);

    const innerW = 3 * 42 - 0.5 - 2 * DEFAULT_BIN_PARAMS.wallThickness;
    expect(tabScales.map(([w]) => w)).toEqual([innerW, innerW]);
  });

  it('keeps per-compartment tabs when overhang widens compartments to fit a plate', () => {
    // Nominally too narrow for a 1U socket; the overhang-widened interior the
    // worker plans in fits one per compartment.
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        overhang: { left: 19, right: 19, front: 0, back: 0 },
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          mode: 'socket',
          width: 100,
          depth: 14,
          alignment: 'center',
        },
        compartments: { cols: 3, rows: 1, thickness: 1.2, cells: [0, 1, 2] },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    render(<GhostLabelTabs />);

    expect(tabScales).toHaveLength(3);
  });

  it('renders nothing when style is slotted', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          width: 80,
          depth: 12,
          alignment: 'center',
        },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostLabelTabs />);
    expect(container.firstChild).toBeNull();
  });
});
