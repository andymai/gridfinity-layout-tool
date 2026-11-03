import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '@/features/bin-designer/constants';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { CUT_RIM_CLEARANCE } from '@/shared/generation/generatorConstants';
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

  const lowestZ = (): number => {
    let min = Infinity;
    for (let i = 2; i < captured.positions.length; i += 3) {
      min = Math.min(min, captured.positions[i]);
    }
    return min;
  };

  it('bottoms a wide scoop out on the cut floor, as deep as a u-shape', () => {
    for (const cornerRadiusTop of [0, 6]) {
      const sides = {
        left: { ...DEFAULT_BIN_PARAMS.walls.left, cornerRadiusTop },
        right: { ...DEFAULT_BIN_PARAMS.walls.right, cornerRadiusTop },
      };
      captured.positions = [];
      generating({ ...sides, shape: 'u-shape' });
      render(<GhostWallCutouts />);
      const floor = lowestZ();

      captured.positions = [];
      generating({ ...sides, shape: 'scoop' });
      render(<GhostWallCutouts />);
      expect(lowestZ(), `top radius ${cornerRadiusTop}`).toBeCloseTo(floor, 6);
    }
  });

  it("turns a funnel's round-over smoothly onto its slope", () => {
    // Where two outline segments meet, the angle the outline turns through.
    // Along a tessellated arc that is one step of the arc; where a blend lands
    // vertically on a leaning side it is the whole lean on top.
    const ARC_STEP = Math.PI / 2 / 16;
    generating({
      shape: 'funnel',
      left: { ...DEFAULT_BIN_PARAMS.walls.left, cornerRadiusTop: 4 },
      right: { ...DEFAULT_BIN_PARAMS.walls.right, cornerRadiusTop: 4 },
    });
    render(<GhostWallCutouts />);

    const p = captured.positions;
    const segments: Array<[number[], number[]]> = [];
    for (let i = 0; i < p.length; i += 6) {
      segments.push([p.slice(i, i + 3), p.slice(i + 3, i + 6)]);
    }
    const zs = segments.flat().map((pt) => pt[2]);
    const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    const same = (a: number[], b: number[]): boolean =>
      Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-6;
    const away = (seg: [number[], number[]], at: number[]): number[] => {
      const far = same(seg[0], at) ? seg[1] : seg[0];
      return [far[0] - at[0], far[1] - at[1], far[2] - at[2]];
    };

    let junctions = 0;
    let sharpest = 0;
    segments.forEach((a, i) => {
      for (const at of a) {
        if (at[2] < midZ) continue;
        segments.slice(i + 1).forEach((b) => {
          if (!same(b[0], at) && !same(b[1], at)) return;
          const u = away(a, at);
          const v = away(b, at);
          const cos =
            (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v));
          sharpest = Math.max(sharpest, Math.PI - Math.acos(Math.min(1, Math.max(-1, cos))));
          junctions++;
        });
      }
    });
    expect(junctions).toBeGreaterThan(0);
    expect(sharpest).toBeLessThan(ARC_STEP + 1e-6);
  });

  it("tops out at the lip, where the solid's round-over lands", () => {
    // DEFAULT_BIN_PARAMS has a stacking lip, so the cut's highest material is
    // the lip's top face, not the wall's.
    const lipTop =
      DEFAULT_BIN_PARAMS.height * DEFAULT_BIN_PARAMS.heightUnitMm + GRIDFINITY_SPEC.LIP_HEIGHT;
    for (const shape of ['u-shape', 'scoop', 'funnel'] as const) {
      captured.positions = [];
      generating({
        shape,
        left: { ...DEFAULT_BIN_PARAMS.walls.left, cornerRadiusTop: 4 },
        right: { ...DEFAULT_BIN_PARAMS.walls.right, cornerRadiusTop: 4 },
      });
      render(<GhostWallCutouts />);
      let top = -Infinity;
      for (let i = 2; i < captured.positions.length; i += 3) {
        top = Math.max(top, captured.positions[i]);
      }
      expect(top, shape).toBeCloseTo(lipTop, 6);
    }
  });

  it("follows the solid's funnel taper, which starts above the rim", () => {
    // The profile's side runs from the cutter's top corner, CUT_RIM_CLEARANCE
    // above the rim, to 60% of the span at the floor. Drawn from the rim
    // instead, it leans further and opens wider than the cut.
    generating({
      shape: 'funnel',
      left: { ...DEFAULT_BIN_PARAMS.walls.left, cornerRadiusTop: 4 },
      right: { ...DEFAULT_BIN_PARAMS.walls.right, cornerRadiusTop: 4 },
    });
    render(<GhostWallCutouts />);

    const p = captured.positions;
    const floorZ = lowestZ();
    let rimZ = -Infinity;
    let floorHalf = 0;
    for (let i = 0; i < p.length; i += 3) {
      rimZ = Math.max(rimZ, p[i + 2]);
      if (Math.abs(p[i + 2] - floorZ) < 1e-6) floorHalf = Math.max(floorHalf, Math.abs(p[i + 1]));
    }
    const halfSpan = floorHalf / 0.6;
    const expectedLean = (halfSpan - floorHalf) / (rimZ - floorZ + CUT_RIM_CLEARANCE);

    let tapers = 0;
    for (let i = 0; i < p.length; i += 6) {
      const along = Math.abs(p[i + 4] - p[i + 1]);
      const rise = Math.abs(p[i + 5] - p[i + 2]);
      if (rise < 1e-6 || Math.hypot(along, rise) < 1) continue;
      expect(along / rise).toBeCloseTo(expectedLean, 6);
      tapers++;
    }
    expect(tapers).toBe(4);
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
