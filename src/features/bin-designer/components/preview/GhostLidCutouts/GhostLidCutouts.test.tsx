import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore, useCutoutSelection } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '@/features/bin-designer/constants';
import { GhostLidCutouts } from './GhostLidCutouts';

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

const LID_CUTOUT = {
  id: 'lc1',
  shape: 'rectangle' as const,
  x: 10,
  y: 10,
  width: 20,
  depth: 10,
  // Deliberately a pocket depth: the ghost must draw the plate's full thickness
  // instead, because that is what the worker cuts.
  cutDepth: 0.2,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};

function setParams(overrides: Partial<typeof DEFAULT_BIN_PARAMS>, generating = false) {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, ...overrides },
    generation: {
      ...DEFAULT_GENERATION_STATE,
      status: generating ? 'generating' : 'idle',
      mesh: null,
      progress: 0,
      epoch: 0,
    },
  });
}

const withLid = (cutouts: (typeof LID_CUTOUT)[]) => ({
  lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, cutouts },
});

describe('GhostLidCutouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setParams({});
    useCutoutSelection.setState({ selectedIds: new Set() });
  });

  it('renders nothing without lid cutouts', () => {
    const { container } = render(<GhostLidCutouts lidOffsetMm={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when idle with no selection', () => {
    setParams(withLid([LID_CUTOUT]));
    const { container } = render(<GhostLidCutouts lidOffsetMm={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders while generating', () => {
    setParams(withLid([LID_CUTOUT]), true);
    const { container } = render(<GhostLidCutouts lidOffsetMm={0} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders a selected cutout while idle', () => {
    setParams(withLid([LID_CUTOUT]));
    useCutoutSelection.setState({ selectedIds: new Set(['lc1']) });
    const { container } = render(<GhostLidCutouts lidOffsetMm={0} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders nothing when a gate refuses the lid its cutouts', () => {
    // A full stack grid owns the top face. The array is inert data then, and a
    // ghost drawn from it would promise a hole the worker never cuts.
    setParams(
      {
        lid: {
          ...DEFAULT_BIN_PARAMS.lid,
          enabled: true,
          stackableTop: true,
          stackLipOnly: false,
          cutouts: [LID_CUTOUT],
        },
      },
      true
    );
    const { container } = render(<GhostLidCutouts lidOffsetMm={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('ignores a bin cutout selection', () => {
    // Selection is shared with the bin's board and ids are UUIDs, so a bin
    // selection must not light up lid outlines.
    setParams({ ...withLid([LID_CUTOUT]), cutouts: [{ ...LID_CUTOUT, id: 'bin-1' }] });
    useCutoutSelection.setState({ selectedIds: new Set(['bin-1']) });
    const { container } = render(<GhostLidCutouts lidOffsetMm={0} />);
    expect(container.firstChild).toBeNull();
  });
});
