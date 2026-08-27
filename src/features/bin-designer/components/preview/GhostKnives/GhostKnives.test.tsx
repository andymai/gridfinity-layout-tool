import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '@/features/bin-designer/constants';
import type { BinParams, Cutout, KnifeSpec } from '@/features/bin-designer/types';
import { GhostKnives } from './GhostKnives';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({
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
    getHex = vi.fn(() => 0x94a3b8);
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
    positions: number[] = [];
    setPositions = vi.fn((p: number[]) => {
      this.positions = p;
    });
    dispose = vi.fn();
  },
}));

const CHEF: KnifeSpec = {
  bladeLengthMm: 205,
  heelHeightMm: 47,
  spineThicknessMm: 2.3,
  handleWidthMm: 23,
  handleHeightMm: 23,
  openEnd: 'end',
};

function knifeSlot(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'k1',
    shape: 'knifeSlot',
    x: 20,
    y: 16,
    width: 215,
    depth: 3.8,
    cutDepth: 51,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    knife: CHEF,
    ...overrides,
  };
}

function block(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 6,
    depth: 1,
    height: 8,
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts: [knifeSlot()],
    knifeRest: { enabled: true },
    ...overrides,
  };
}

function setParams(params: BinParams): void {
  useDesignerStore.setState({
    params,
    generation: { ...DEFAULT_GENERATION_STATE },
  });
}

describe('GhostKnives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setParams({ ...DEFAULT_BIN_PARAMS });
  });

  it('renders nothing for a design with no knife slots', () => {
    const { container } = render(<GhostKnives />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the design plans no rest for its knives', () => {
    setParams(block({ knifeRest: undefined }));
    const { container } = render(<GhostKnives />);
    expect(container.firstChild).toBeNull();
  });

  it('draws the knives once the block has a rest to plan', () => {
    setParams(block());
    const { container } = render(<GhostKnives />);
    expect(container.firstChild).not.toBeNull();
  });

  it('draws with instanced fat lines, never a plain mesh', () => {
    // `exportPreviewGlb` merges every visible Mesh in this scene into the
    // published GLB and skips only instanced geometry, so a mesh-drawn ghost
    // would be baked into every published knife block.
    setParams(block());
    const { container } = render(<GhostKnives />);
    expect(vi.mocked(LineSegments2)).toHaveBeenCalledTimes(1);
    expect(container.querySelector('mesh')).toBeNull();
    expect(container.querySelector('lineSegments')).toBeNull();
  });

  it('sits in the block frame, on the block group nudge', () => {
    setParams(block());
    const { container } = render(<GhostKnives />);
    expect(container.querySelector('primitive')?.getAttribute('position')).toBe('0,0,0.1');
  });

  it('draws every knife the block lets out, not just the first', () => {
    const outlinePositions = (): number[] => {
      const geometry = vi.mocked(LineSegments2).mock.calls[0][0];
      return (geometry as unknown as { positions: number[] }).positions;
    };
    setParams(block());
    render(<GhostKnives />);
    const one = outlinePositions().length;

    vi.clearAllMocks();
    setParams(block({ cutouts: [knifeSlot(), knifeSlot({ id: 'k2', y: 24 })] }));
    render(<GhostKnives />);
    expect(outlinePositions()).toHaveLength(one * 2);
  });
});
