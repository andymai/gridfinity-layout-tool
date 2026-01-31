import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { GhostDividers } from './GhostDividers';

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
  }

  class Vector2 {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    set = vi.fn().mockReturnThis();
  }

  class Color {
    getHex = vi.fn(() => 0xfbbf24);
  }

  return {
    Vector2,
    Vector3,
    Color,
  };
});

vi.mock('three/examples/jsm/lines/LineSegments2.js', () => ({
  LineSegments2: vi.fn(),
}));

vi.mock('three/examples/jsm/lines/LineMaterial.js', () => ({
  LineMaterial: class MockLineMaterial {
    resolution = { set: vi.fn() };
    dispose = vi.fn();
  },
}));

vi.mock('three/examples/jsm/lines/LineSegmentsGeometry.js', () => ({
  LineSegmentsGeometry: class MockLineSegmentsGeometry {
    setPositions = vi.fn();
    dispose = vi.fn();
  },
}));

describe('GhostDividers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
      generation: {
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
  });

  it('renders nothing when not generating', () => {
    const { container } = render(<GhostDividers />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when 1x1 grid during generation', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          cols: 1,
          rows: 1,
        },
      },
      generation: {
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostDividers />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when generating with dividers', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          cols: 2,
          rows: 2,
        },
      },
      generation: {
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostDividers />);
    expect(container.firstChild).not.toBeNull();
  });
});
