import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { GhostWireframe } from './GhostWireframe';

const { capturedPositions } = vi.hoisted(() => ({
  capturedPositions: [] as number[][],
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
    setPositions(positions: number[]) {
      capturedPositions.push([...positions]);
    }
    dispose = vi.fn();
  },
}));

describe('GhostWireframe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedPositions.length = 0;
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
    const { container } = render(<GhostWireframe />);
    expect(container.firstChild).toBeNull();
  });

  it('renders wireframe when generating', () => {
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
      generation: {
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostWireframe />);
    expect(container.firstChild).not.toBeNull();
  });

  it('outer dimensions track params.gridUnitMm (regression for #1807-follow-up)', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, gridUnitMm: 30 },
      generation: {
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    render(<GhostWireframe />);

    expect(capturedPositions.length).toBeGreaterThan(0);
    const positions = capturedPositions[0];
    let maxAbsX = 0;
    let maxAbsY = 0;
    for (let i = 0; i < positions.length; i += 3) {
      maxAbsX = Math.max(maxAbsX, Math.abs(positions[i]));
      maxAbsY = Math.max(maxAbsY, Math.abs(positions[i + 1]));
    }
    // outerW = 2 × 30 − 0.5 = 59.5 → halfW = 29.75 (would be 41.75 with hardcoded 42)
    expect(maxAbsX).toBeCloseTo(29.75, 5);
    expect(maxAbsY).toBeCloseTo(29.75, 5);
  });

  it('renders nothing when generation is complete', () => {
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
      generation: {
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          indices: new Uint32Array([0, 1, 2]),
          edgeVertices: new Float32Array(0),
          error: null,
          timingMs: 50,
        },
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostWireframe />);
    expect(container.firstChild).toBeNull();
  });
});
