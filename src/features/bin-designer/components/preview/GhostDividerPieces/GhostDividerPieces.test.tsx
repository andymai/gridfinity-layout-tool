import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { GhostDividerPieces } from './GhostDividerPieces';
import { referencePieceGeometry } from './referencePieceOutline';
import { resolveDividerFilletSeat } from '@/shared/utils/slottedFillet';
import { calculateSlotPositions, dividerInterior } from '@/shared/utils/slotMath';
import { baseWallHeight } from '@/features/bin-designer/utils/binDimensions';

vi.mock('./referencePieceOutline', () => ({
  referencePieceGeometry: vi.fn(() => ({
    getAttribute: vi.fn(() => ({
      count: 3,
      getX: vi.fn(() => 0),
      getY: vi.fn(() => 0),
      getZ: vi.fn(() => 0),
    })),
    getIndex: vi.fn(() => null),
    dispose: vi.fn(),
  })),
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
  class MockBoxGeometry {
    getAttribute = vi.fn(() => ({
      count: 8,
      getX: vi.fn(() => 0),
      getY: vi.fn(() => 0),
      getZ: vi.fn(() => 0),
    }));
    getIndex = vi.fn(() => ({ count: 36, array: new Uint16Array(36) }));
    dispose = vi.fn();
  }

  class MockBufferGeometry {
    setAttribute = vi.fn();
    setIndex = vi.fn();
    computeVertexNormals = vi.fn();
    dispose = vi.fn();
  }

  class MockMeshBasicMaterial {
    dispose = vi.fn();
  }

  class MockMeshStandardMaterial {
    dispose = vi.fn();
    color = { r: 0.5, g: 0.5, b: 0.5 };
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
    applyMatrix4 = vi.fn().mockReturnThis();
  }

  class Color {
    r = 0.5;
    g = 0.5;
    b = 0.5;
    set = vi.fn().mockReturnThis();
    getHex = vi.fn(() => 0xcccccc);
  }

  class Matrix4 {
    makeTranslation = vi.fn().mockReturnThis();
    makeRotationZ = vi.fn().mockReturnThis();
    multiply = vi.fn().mockReturnThis();
    identity = vi.fn().mockReturnThis();
  }
  return {
    Vector3,
    Color,
    Matrix4,
    BoxGeometry: MockBoxGeometry,
    BufferGeometry: MockBufferGeometry,
    Float32BufferAttribute: vi.fn(),
    MeshBasicMaterial: MockMeshBasicMaterial,
    MeshStandardMaterial: MockMeshStandardMaterial,
    DoubleSide: 2,
  };
});

describe('GhostDividerPieces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'standard',
      },
    });
  });

  it('renders nothing when style is not slotted', () => {
    const { container } = render(<GhostDividerPieces />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no slots enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: false, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      },
    });
    const { container } = render(<GhostDividerPieces />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when style is slotted and X slots enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      },
    });
    const { container } = render(<GhostDividerPieces />);
    expect(container.firstChild).not.toBeNull();
  });

  describe('cross divider modes', () => {
    const bothAxesParams = (slotOverrides: Record<string, unknown> = {}) => ({
      ...DEFAULT_BIN_PARAMS,
      style: 'slotted' as const,
      width: 2,
      depth: 2,
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 20 },
        y: { enabled: true, pitch: 20 },
        ...slotOverrides,
      },
      dividerPieces: {
        height: 'auto' as const,
        thickness: 1.6,
        clearance: 0.25,
        floorGroove: true,
      },
    });

    it('lap mode renders in-bin ghosts plus one reference piece per axis', () => {
      useDesignerStore.setState({ params: bothAxesParams({ crossStyle: 'lap' }) });
      const { container } = render(<GhostDividerPieces />);
      expect(container.querySelectorAll('mesh')).toHaveLength(3);
    });

    it('insert mode renders the long reference plus interior and edge short pieces', () => {
      useDesignerStore.setState({
        params: bothAxesParams({ crossStyle: 'insert', longAxis: 'y' }),
      });
      const { container } = render(<GhostDividerPieces />);
      // in-bin ghosts + long piece + short interior + short edge
      expect(container.querySelectorAll('mesh')).toHaveLength(4);
    });

    it('insert mode without short-axis rows renders only the long reference', () => {
      useDesignerStore.setState({
        params: {
          ...bothAxesParams({
            crossStyle: 'insert',
            longAxis: 'y',
            // depth 1 at 50mm pitch → innerD too small for any rows
            x: { enabled: true, pitch: 50 },
          }),
          depth: 1,
        },
      });
      const { container } = render(<GhostDividerPieces />);
      expect(container.querySelectorAll('mesh')).toHaveLength(2);
    });

    it('insert mode degrades to lap rendering when the divider is too thin', () => {
      useDesignerStore.setState({
        params: {
          ...bothAxesParams({ crossStyle: 'insert', longAxis: 'y' }),
          dividerPieces: {
            height: 'auto' as const,
            thickness: 1.0,
            clearance: 0.25,
            floorGroove: true,
          },
        },
      });
      const { container } = render(<GhostDividerPieces />);
      // Same shape as lap mode: ghosts + one reference per axis
      expect(container.querySelectorAll('mesh')).toHaveLength(3);
    });
  });
});

describe('pieces over an interior fillet', () => {
  const filleted = (slotOverrides: Record<string, unknown> = {}) => ({
    ...DEFAULT_BIN_PARAMS,
    style: 'slotted' as const,
    width: 2,
    depth: 2,
    interiorFilletMm: 2.5,
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 20 },
      y: { enabled: false, pitch: 20 },
      ...slotOverrides,
    },
  });

  const cornerRadius = (params: ReturnType<typeof filleted>): number => {
    const { innerW, innerD } = dividerInterior(params);
    const wallHeight = baseWallHeight(params.base, params.height * params.heightUnitMm);
    const seat = resolveDividerFilletSeat(params, {
      innerW,
      innerD,
      wallHeight,
      hasLip: params.base.stackingLip,
    });
    if (!seat) throw new Error('no seat');
    return seat.cornerRadius;
  };

  beforeEach(() => {
    vi.mocked(referencePieceGeometry).mockClear();
  });

  it('rounds both ends of the reference piece and of every in-bin ghost', () => {
    const params = filleted();
    useDesignerStore.setState({ params });
    render(<GhostDividerPieces />);
    const corners = vi.mocked(referencePieceGeometry).mock.calls.map((call) => call[6]);
    // One outline per in-bin ghost, then the reference piece's last.
    const { innerD } = dividerInterior(params);
    const lipOverhang = 2.6 - params.wallThickness;
    expect(corners).toHaveLength(calculateSlotPositions(innerD, 20, lipOverhang).length + 1);
    for (const c of corners) {
      expect(c?.low).toBe(true);
      expect(c?.high).toBe(true);
      expect(c?.radius).toBeCloseTo(cornerRadius(params), 9);
    }
  });

  it('rounds only the wall end of an insert edge piece and neither end of an interior one', () => {
    const params = filleted({
      y: { enabled: true, pitch: 20 },
      crossStyle: 'insert',
      longAxis: 'y',
    });
    useDesignerStore.setState({ params });
    render(<GhostDividerPieces />);
    const calls = vi.mocked(referencePieceGeometry).mock.calls;
    const ends = calls.map((call) => [call[6]?.low ?? false, call[6]?.high ?? false]);
    // The in-bin ghosts come first: long pieces take both ends, and a short
    // segment at either wall takes that end.
    expect(ends).toContainEqual([true, true]);
    expect(ends).toContainEqual([false, true]);
    // Then the reference pieces: the short edge piece rounds its wall end
    // only, and the long piece both.
    expect(ends.slice(-2)).toEqual([
      [true, false],
      [true, true],
    ]);
    // An interior short piece has no wall end, so it never takes an outline.
    expect(ends).not.toContainEqual([false, false]);
  });

  it('keeps square pieces without a fillet', () => {
    useDesignerStore.setState({ params: { ...filleted(), interiorFilletMm: undefined } });
    render(<GhostDividerPieces />);
    expect(referencePieceGeometry).not.toHaveBeenCalled();
  });
});
