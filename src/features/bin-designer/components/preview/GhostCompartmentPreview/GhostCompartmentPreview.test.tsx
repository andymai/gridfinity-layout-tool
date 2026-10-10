import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { DEFAULT_PULL_TAB } from '@/shared/utils/pullTabPlan';
import { GhostCompartmentPreview } from './GhostCompartmentPreview';

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

const planes = vi.hoisted(() => [] as { args: number[]; translate: ReturnType<typeof vi.fn> }[]);

vi.mock('three', () => {
  class MockPlaneGeometry {
    translate = vi.fn();
    dispose = vi.fn();
    constructor(...args: number[]) {
      planes.push({ args, translate: this.translate });
    }
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
    clone = vi.fn().mockReturnThis();
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
    r = 0.5;
    g = 0.5;
    b = 0.5;
    set = vi.fn().mockReturnThis();
    getHex = vi.fn(() => 0xcccccc);
  }

  return {
    Vector2,
    Vector3,
    Color,
    PlaneGeometry: MockPlaneGeometry,
    MeshBasicMaterial: MockMeshBasicMaterial,
    DoubleSide: 2,
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

describe('GhostCompartmentPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
      ui: {
        ...DEFAULT_UI_STATE,
        previewCompartments: null,
        previewSelection: null,
        designListOpen: false,
        exportDialogOpen: false,
      },
    });
  });

  it('renders nothing when no preview selection', () => {
    const { container } = render(<GhostCompartmentPreview />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing with null preview selection', () => {
    useDesignerStore.setState({
      ui: {
        ...DEFAULT_UI_STATE,
        previewCompartments: null,
        previewSelection: null,
        designListOpen: false,
        exportDialogOpen: false,
      },
    });
    const { container } = render(<GhostCompartmentPreview />);
    expect(container.firstChild).toBeNull();
  });

  it('renders merge preview when preview selection is set for merge', () => {
    useDesignerStore.setState({
      ui: {
        ...DEFAULT_UI_STATE,
        previewCompartments: null,
        previewSelection: {
          action: 'merge',
          minCol: 0,
          maxCol: 1,
          minRow: 0,
          maxRow: 1,
        },
        designListOpen: false,
        exportDialogOpen: false,
      },
    });
    const { container } = render(<GhostCompartmentPreview />);
    expect(container.firstChild).not.toBeNull();
  });

  describe('in the cavity the worker cuts', () => {
    const changes: [string, Partial<BinParams>][] = [
      ['a pull tab thickens the front wall', { pullTab: { ...DEFAULT_PULL_TAB, enabled: true } }],
      ['an asymmetric overhang', { overhang: { left: 0, right: 8, front: 4, back: 0 } }],
    ];
    const grid = { cols: 2, rows: 2, cells: [0, 1, 2, 3] };
    const whole = { minCol: 0, maxCol: 1, minRow: 0, maxRow: 1 };

    function show(change: Partial<BinParams>, action: 'merge' | 'split'): BinParams {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        ...change,
        compartments: { ...DEFAULT_BIN_PARAMS.compartments, ...grid },
      };
      useDesignerStore.setState({
        params,
        ui: {
          ...DEFAULT_UI_STATE,
          previewCompartments: action === 'split' ? { ...grid, thickness: 1.2 } : null,
          previewSelection: { action, ...whole },
        },
      });
      planes.length = 0;
      render(<GhostCompartmentPreview />);
      return params;
    }

    it.each(changes)('covers the merged cells when %s', (_, change) => {
      const { innerW, innerD, offsetX, offsetY } = cutoutInterior(show(change, 'merge'));
      expect(planes).toHaveLength(1);
      expect(planes[0].args[0]).toBeCloseTo(innerW);
      expect(planes[0].args[1]).toBeCloseTo(innerD);
      const [x, y] = planes[0].translate.mock.calls[0] as number[];
      expect(x).toBeCloseTo(offsetX);
      expect(y).toBeCloseTo(offsetY);
    });

    it.each(changes)('crosses at the cavity centre when %s', (_, change) => {
      const { innerD, offsetX, offsetY } = cutoutInterior(show(change, 'split'));
      const geometry = vi.mocked(LineSegments2).mock.calls[0]?.[0] as unknown as {
        setPositions: ReturnType<typeof vi.fn>;
      };
      const positions = geometry.setPositions.mock.calls[0]?.[0] as number[];
      const xs = positions.filter((_, i) => i % 3 === 0);
      const ys = positions.filter((_, i) => i % 3 === 1);
      expect(Math.min(...ys)).toBeCloseTo(offsetY - innerD / 2);
      expect(Math.max(...ys)).toBeCloseTo(offsetY + innerD / 2);
      expect(xs).toContainEqual(expect.closeTo(offsetX));
    });
  });
});
