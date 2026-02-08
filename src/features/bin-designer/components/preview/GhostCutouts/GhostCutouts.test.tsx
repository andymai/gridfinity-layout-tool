import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore, useCutoutSelection } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { GhostCutouts } from './GhostCutouts';

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

  return { Vector2, Color };
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

const SOLID_CUTOUT = {
  id: 'c1',
  shape: 'rectangle' as const,
  x: 10,
  y: 10,
  width: 20,
  depth: 15,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};

describe('GhostCutouts', () => {
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
    useCutoutSelection.setState({ selectedIds: new Set() });
  });

  it('renders nothing when not generating and no selection', () => {
    const { container } = render(<GhostCutouts />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when not solid mode', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: false },
        cutouts: [SOLID_CUTOUT],
      },
      generation: {
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostCutouts />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no cutouts', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [],
      },
      generation: {
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostCutouts />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when solid mode + generating + has cutouts', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [SOLID_CUTOUT],
      },
      generation: {
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostCutouts />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders when a cutout is selected even without generating', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [SOLID_CUTOUT],
      },
      generation: {
        status: 'complete',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    useCutoutSelection.setState({ selectedIds: new Set(['c1']) });

    const { container } = render(<GhostCutouts />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders nothing when selection has no matching cutouts', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [SOLID_CUTOUT],
      },
      generation: {
        status: 'complete',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    useCutoutSelection.setState({ selectedIds: new Set(['nonexistent']) });

    const { container } = render(<GhostCutouts />);
    expect(container.firstChild).toBeNull();
  });
});
