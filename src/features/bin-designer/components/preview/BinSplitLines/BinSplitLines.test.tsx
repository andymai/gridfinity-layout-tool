import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { BinSplitLines } from './BinSplitLines';

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

vi.mock('@react-three/drei', () => ({
  Line: ({ points }: { points: unknown }) => (
    <div data-testid="drei-line" data-points={JSON.stringify(points)} />
  ),
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

  class Color {
    getHex = vi.fn(() => 0xfbbf24);
  }

  class SphereGeometry {
    dispose = vi.fn();
  }

  return {
    Vector3,
    Color,
    SphereGeometry,
    DoubleSide: 2,
  };
});

describe('BinSplitLines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
    });
  });

  it('renders nothing when bin fits print bed', () => {
    // Default bin is small (2x1), print bed is 256mm -> maxGridUnits = 6
    const { container } = render(<BinSplitLines />);
    expect(container.innerHTML).toBe('');
  });

  it('renders split lines when bin exceeds print bed in width', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 8, // Exceeds maxGridUnits of 6
        depth: 3,
      },
    });

    const { getAllByTestId } = render(<BinSplitLines />);
    const lines = getAllByTestId('drei-line');
    // Should have at least top + vertical edge lines for X split
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders split lines for both dimensions when both exceed', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 8,
        depth: 8,
      },
    });

    const { getAllByTestId } = render(<BinSplitLines />);
    const lines = getAllByTestId('drei-line');
    // Should have lines for both X and Y splits (3 lines each = 6 total)
    expect(lines.length).toBe(6);
  });

  it('split line extent matches actual bin edge (TOLERANCE subtracted)', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 8,
        depth: 3,
        height: 3,
      },
    });

    const { getAllByTestId } = render(<BinSplitLines />);
    const lines = getAllByTestId('drei-line');
    const firstLine = lines[0];
    const points = JSON.parse(firstLine.getAttribute('data-points') ?? '[]') as number[][];

    // halfD = (3 * 42 - 0.5) / 2 = 62.75, not 63
    if (points.length === 2) {
      const yValues = points.map((p) => Math.abs(p[1]));
      const expectedHalfD = (3 * 42 - 0.5) / 2;
      for (const y of yValues) {
        expect(y).toBeCloseTo(expectedHalfD, 2);
      }
    }
  });

  it('respects custom print bed size from settings', () => {
    // Set a very small print bed so a normal bin needs splitting
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        defaultPrintBedSize: 80, // Only fits 1 grid unit
      },
    });

    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 3,
        depth: 1,
      },
    });

    const { getAllByTestId } = render(<BinSplitLines />);
    const lines = getAllByTestId('drei-line');
    expect(lines.length).toBeGreaterThan(0);
  });
});
