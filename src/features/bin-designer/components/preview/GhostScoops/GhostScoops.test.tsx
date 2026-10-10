import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import { baseWallHeight, cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { resolveOverhang, taperInsetAt } from '@/shared/utils/overhang';
import { DEFAULT_PULL_TAB } from '@/shared/utils/pullTabPlan';
import { GhostScoops } from './GhostScoops';

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
  class MockBufferGeometry {
    setAttribute = vi.fn();
    setIndex = vi.fn();
    computeVertexNormals = vi.fn();
    dispose = vi.fn();
  }

  class MockMeshBasicMaterial {
    dispose = vi.fn();
  }

  return {
    BufferGeometry: MockBufferGeometry,
    Float32BufferAttribute: vi.fn(),
    MeshBasicMaterial: MockMeshBasicMaterial,
    DoubleSide: 2,
  };
});

describe('GhostScoops', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: false, radius: 'auto' as const },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
  });

  it('renders nothing when scoops disabled', () => {
    const { container } = render(<GhostScoops />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when not generating', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 'auto' as const },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostScoops />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when scoop enabled and generating', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 'auto' as const },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostScoops />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders nothing when style is slotted', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        scoop: { enabled: true, radius: 'auto' as const },
      },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'generating',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
    const { container } = render(<GhostScoops />);
    expect(container.firstChild).toBeNull();
  });

  it.each([
    ['a pull tab thickens the front wall', { pullTab: { ...DEFAULT_PULL_TAB, enabled: true } }],
    ['an asymmetric overhang', { overhang: { left: 0, right: 8, front: 4, back: 0 } }],
  ])('centres ramps on all four walls on the cavity when %s', (_, change) => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      ...change,
      scoop: { enabled: true, radius: 'auto', sides: ['front', 'back', 'left', 'right'] },
    };
    useDesignerStore.setState({
      params,
      generation: { ...DEFAULT_GENERATION_STATE, status: 'generating' },
    });
    const { offsetX, offsetY } = cutoutInterior(params);
    expect(offsetX !== 0 || offsetY !== 0).toBe(true);

    render(<GhostScoops />);

    const positions = vi.mocked(THREE.Float32BufferAttribute).mock.calls[0]?.[0] as number[];
    const xs = positions.filter((_, i) => i % 3 === 0);
    const ys = positions.filter((_, i) => i % 3 === 1);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(offsetX);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(offsetY);
  });

  it.each(['chamfer', 'fillet'] as const)(
    'keeps a ramp inside a %s-tapered outer wall at every height',
    (profile) => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        overhang: {
          left: 0,
          right: 8,
          front: 0,
          back: 0,
          taper: { profile, bandHeight: 30, left: 0, right: 8, front: 0, back: 0 },
        },
        scoop: { enabled: true, radius: 'auto', sides: ['right'] },
      };
      useDesignerStore.setState({
        params,
        generation: { ...DEFAULT_GENERATION_STATE, status: 'generating' },
      });
      const { innerW, offsetX } = cutoutInterior(params);
      const taper = resolveOverhang(params.overhang).taper;
      if (!taper) throw new Error('expected a taper');
      const wallHeight = baseWallHeight(params.base, params.height * params.heightUnitMm);

      render(<GhostScoops />);

      const positions = vi.mocked(THREE.Float32BufferAttribute).mock.calls[0]?.[0] as number[];
      let deepest = -Infinity;
      for (let i = 0; i < positions.length; i += 3) {
        const [x, z] = [positions[i], positions[i + 2]];
        const wall = offsetX + innerW / 2 - taperInsetAt(taper, taper.right, z, wallHeight);
        deepest = Math.max(deepest, x - wall);
      }
      expect(deepest).toBeLessThanOrEqual(1e-6);
    }
  );
});
