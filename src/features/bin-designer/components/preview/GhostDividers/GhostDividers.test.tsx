import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { DEFAULT_PULL_TAB } from '@/shared/utils/pullTabPlan';
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
        ...DEFAULT_GENERATION_STATE,
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
        ...DEFAULT_GENERATION_STATE,
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
        ...DEFAULT_GENERATION_STATE,
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostDividers />);
    expect(container.firstChild).not.toBeNull();
  });

  it.each([
    ['a pull tab thickens the front wall', { pullTab: { ...DEFAULT_PULL_TAB, enabled: true } }],
    ['an asymmetric overhang', { overhang: { left: 0, right: 8, front: 4, back: 0 } }],
  ])('draws in the cavity the worker cuts when %s', (_, change) => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      ...change,
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 2, cells: [0, 1, 2, 3] },
    };
    useDesignerStore.setState({
      params,
      generation: { ...DEFAULT_GENERATION_STATE, status: 'generating' },
    });
    const { innerW, innerD, offsetX, offsetY } = cutoutInterior(params);
    expect(offsetX !== 0 || offsetY !== 0).toBe(true);

    render(<GhostDividers />);

    const geometry = vi.mocked(LineSegments2).mock.calls[0]?.[0] as unknown as {
      setPositions: ReturnType<typeof vi.fn>;
    };
    const positions = geometry.setPositions.mock.calls[0]?.[0] as number[];
    const xs = positions.filter((_, i) => i % 3 === 0);
    const ys = positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...xs)).toBeCloseTo(offsetX - innerW / 2);
    expect(Math.max(...xs)).toBeCloseTo(offsetX + innerW / 2);
    expect(Math.min(...ys)).toBeCloseTo(offsetY - innerD / 2);
    expect(Math.max(...ys)).toBeCloseTo(offsetY + innerD / 2);
  });
});
