import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_UI_STATE,
  DEFAULT_GENERATION_STATE,
} from '@/features/bin-designer/constants';
import { SlideTrayMesh } from './SlideTrayMesh';

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

beforeEach(() => {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS },
    ui: { ...DEFAULT_UI_STATE },
  });
});

const tri = {
  vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint32Array([0, 1, 2]),
  edgeVertices: new Float32Array([0, 0, 0, 1, 0, 0]),
};

function seedTray(restZ = 21): void {
  useDesignerStore.setState({
    generation: {
      ...DEFAULT_GENERATION_STATE,
      status: 'complete',
      mesh: {
        ...tri,
        error: null,
        timingMs: 1,
        slideTrayMesh: { ...tri, triangleCount: 1, restZ },
      },
      progress: 0,
      epoch: 0,
    },
  });
}

const groupZ = (container: HTMLElement): number =>
  Number(container.querySelector('group')?.getAttribute('position')?.split(',')[2]);

describe('SlideTrayMesh', () => {
  it('renders nothing when no tray mesh is in the store', () => {
    const { container } = render(
      <SlideTrayMesh color="#cccccc" lidOffsetMm={0} wireframe={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('seats the tray at its rest height rather than at the origin', () => {
    // The tray is BUILT floor-down at Z=0 for printing; showing it there would
    // bury it in the bin's base instead of on its rail.
    seedTray(21);
    const { container } = render(
      <SlideTrayMesh color="#cccccc" lidOffsetMm={0} wireframe={false} />
    );
    expect(groupZ(container)).toBeGreaterThanOrEqual(21);
  });

  it('rides the explode slider so the assembly opens as one', () => {
    seedTray(21);
    const closed = render(<SlideTrayMesh color="#ccc" lidOffsetMm={0} wireframe={false} />);
    const open = render(<SlideTrayMesh color="#ccc" lidOffsetMm={15} wireframe={false} />);
    expect(groupZ(open.container) - groupZ(closed.container)).toBeCloseTo(15, 6);
  });

  it('uses the body colour', () => {
    seedTray();
    const { container } = render(
      <SlideTrayMesh color="#abcdef" lidOffsetMm={0} wireframe={false} />
    );
    expect(container.querySelector('meshStandardMaterial')?.getAttribute('color')).toBe('#abcdef');
  });
});
