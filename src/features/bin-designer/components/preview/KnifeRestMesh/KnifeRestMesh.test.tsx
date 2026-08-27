import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_UI_STATE,
  DEFAULT_GENERATION_STATE,
} from '@/features/bin-designer/constants';
import type { BinParams, Cutout, KnifeSpec } from '@/features/bin-designer/types';
import { KnifeRestMesh } from './KnifeRestMesh';

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
  class MockBufferGeometry {
    setAttribute = vi.fn();
    setIndex = vi.fn();
    computeVertexNormals = vi.fn();
    clearGroups = vi.fn();
    addGroup = vi.fn();
    dispose = vi.fn();
  }
  return {
    BufferGeometry: MockBufferGeometry,
    EdgesGeometry: MockBufferGeometry,
    BufferAttribute: vi.fn(),
    Float32BufferAttribute: vi.fn(),
    Color: vi.fn(),
    DoubleSide: 'DoubleSide',
    FrontSide: 'FrontSide',
  };
});

vi.mock('three/examples/jsm/utils/BufferGeometryUtils.js', () => ({
  toCreasedNormals: vi.fn((geo: unknown) => geo),
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

const tri = {
  vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint32Array([0, 1, 2]),
  edgeVertices: new Float32Array([0, 0, 0, 1, 0, 0]),
};

function seedRest(): void {
  useDesignerStore.setState({
    generation: {
      ...DEFAULT_GENERATION_STATE,
      status: 'complete',
      mesh: {
        ...tri,
        error: null,
        timingMs: 1,
        knifeRestMesh: { ...tri, triangleCount: 1 },
      },
      progress: 0,
      epoch: 0,
    },
  });
}

const groupPosition = (container: HTMLElement): number[] =>
  (container.querySelector('group')?.getAttribute('position') ?? '')
    .split(',')
    .map((v) => Number(v));

beforeEach(() => {
  useDesignerStore.setState({
    params: block(),
    ui: { ...DEFAULT_UI_STATE },
    generation: { ...DEFAULT_GENERATION_STATE },
  });
});

describe('KnifeRestMesh', () => {
  it('renders nothing when the design has no companion rest', () => {
    const { container } = render(<KnifeRestMesh color="#cccccc" offsetMm={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when a rest mesh arrives for a design that no longer plans one', () => {
    // The mesh outlives the params that produced it by one generation, and a
    // rest placed against a plan that no longer exists has nowhere to stand.
    seedRest();
    useDesignerStore.setState({ params: { ...block(), knifeRest: { enabled: false } } });
    const { container } = render(<KnifeRestMesh color="#cccccc" offsetMm={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('stands the rest beside the block, not on top of it', () => {
    seedRest();
    const { container } = render(<KnifeRestMesh color="#cccccc" offsetMm={0} />);
    const [x, y] = groupPosition(container);
    // Block half 125.75 + gap 21 + rest half 20.75.
    expect(x).toBeCloseTo(167.5, 6);
    expect(y).toBe(0);
  });

  it('moves away from the block on the explode slider', () => {
    seedRest();
    const mated = render(<KnifeRestMesh color="#ccc" offsetMm={0} />);
    const apart = render(<KnifeRestMesh color="#ccc" offsetMm={25} />);
    expect(groupPosition(apart.container)[0] - groupPosition(mated.container)[0]).toBeCloseTo(
      25,
      6
    );
  });

  it('uses the body colour by default', () => {
    seedRest();
    const { container } = render(<KnifeRestMesh color="#abcdef" offsetMm={0} />);
    expect(container.querySelector('meshStandardMaterial')?.getAttribute('color')).toBe('#abcdef');
  });

  it('takes the rest its own filament colour when the design names one', () => {
    seedRest();
    useDesignerStore.setState({
      params: block({ knifeRest: { enabled: true, color: '#ff0000' } }),
    });
    const { container } = render(<KnifeRestMesh color="#abcdef" offsetMm={0} />);
    expect(container.querySelector('meshStandardMaterial')?.getAttribute('color')).toBe('#ff0000');
  });

  it('drops the edge overlay in wireframe mode', () => {
    seedRest();
    const { container } = render(<KnifeRestMesh color="#ccc" offsetMm={0} wireframe />);
    expect(container.querySelector('lineSegments')).toBeNull();
  });
});
