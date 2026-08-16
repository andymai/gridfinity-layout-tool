import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '@/features/bin-designer/constants';
import { GhostWallCutouts } from './GhostWallCutouts';

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

const captured = vi.hoisted(() => ({ positions: [] as number[] }));

vi.mock('three/examples/jsm/lines/LineSegmentsGeometry.js', () => ({
  LineSegmentsGeometry: class MockLineSegmentsGeometry {
    setPositions = vi.fn((p: number[]) => {
      captured.positions = p;
    });
    dispose = vi.fn();
  },
}));

describe('GhostWallCutouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.positions = [];
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
  });

  it('renders nothing when wall cutouts are disabled', () => {
    const { container } = render(<GhostWallCutouts />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when not generating', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostWallCutouts />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when wall cutouts enabled and generating', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true, width: 70, depth: 50 },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostWallCutouts />);
    expect(container.firstChild).not.toBeNull();
  });

  // The left and right walls run along Y, so the outline's span is its Y
  // extent. A round-over widens the opening at the rim, and the whole point of
  // drawing it here is that dragging the stepper moves something before the
  // worker returns.
  const spanAlongWall = (): number => {
    let max = 0;
    for (let i = 1; i < captured.positions.length; i += 3) {
      max = Math.max(max, Math.abs(captured.positions[i]));
    }
    return max;
  };

  const generating = (walls: Partial<(typeof DEFAULT_BIN_PARAMS)['walls']>) => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true, ...walls },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
  };

  it('opens the outline by the top radius on each side', () => {
    generating({});
    render(<GhostWallCutouts />);
    const square = spanAlongWall();

    captured.positions = [];
    generating({
      left: { ...DEFAULT_BIN_PARAMS.walls.left, cornerRadiusTop: 4 },
      right: { ...DEFAULT_BIN_PARAMS.walls.right, cornerRadiusTop: 4 },
    });
    render(<GhostWallCutouts />);

    expect(spanAlongWall()).toBeCloseTo(square + 4, 6);
  });

  it('reaches its widest exactly at the rim, not below it', () => {
    // The blend is a quarter arc, so getting its quadrant wrong still widens
    // the outline by the right amount — it just does it in the wrong place.
    // Only the Z of the widest point separates the two.
    generating({
      left: { ...DEFAULT_BIN_PARAMS.walls.left, cornerRadiusTop: 4 },
      right: { ...DEFAULT_BIN_PARAMS.walls.right, cornerRadiusTop: 4 },
    });
    render(<GhostWallCutouts />);

    const widest = spanAlongWall();
    let zAtWidest = -Infinity;
    let rimZ = -Infinity;
    for (let i = 1; i < captured.positions.length; i += 3) {
      rimZ = Math.max(rimZ, captured.positions[i + 1]);
      if (Math.abs(Math.abs(captured.positions[i]) - widest) < 1e-6) {
        zAtWidest = Math.max(zAtWidest, captured.positions[i + 1]);
      }
    }
    expect(zAtWidest).toBeCloseTo(rimZ, 6);
  });

  it('draws nothing extra when both radii are on their defaults', () => {
    generating({});
    render(<GhostWallCutouts />);
    const plain = captured.positions.length;

    captured.positions = [];
    generating({
      left: { ...DEFAULT_BIN_PARAMS.walls.left, cornerRadiusTop: 3, cornerRadiusBottom: 2 },
      right: { ...DEFAULT_BIN_PARAMS.walls.right, cornerRadiusTop: 3, cornerRadiusBottom: 2 },
    });
    render(<GhostWallCutouts />);

    expect(captured.positions.length).toBeGreaterThan(plain);
  });
});
