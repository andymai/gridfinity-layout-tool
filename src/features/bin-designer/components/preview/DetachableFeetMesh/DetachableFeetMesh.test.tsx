import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_UI_STATE,
  DEFAULT_GENERATION_STATE,
} from '@/features/bin-designer/constants';
import { DetachableFeetMesh } from './DetachableFeetMesh';

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

function seedFeet(): void {
  useDesignerStore.setState({
    generation: {
      ...DEFAULT_GENERATION_STATE,
      status: 'complete',
      mesh: {
        ...tri,
        error: null,
        timingMs: 1,
        detachableFeetMesh: { ...tri, triangleCount: 1 },
      },
      progress: 0,
      epoch: 0,
    },
  });
}

const groupZ = (container: HTMLElement): number =>
  Number(container.querySelector('group')?.getAttribute('position')?.split(',')[2]);

describe('DetachableFeetMesh', () => {
  it('renders nothing when the bin has no detachable feet', () => {
    const { container } = render(
      <DetachableFeetMesh color="#cccccc" offsetMm={0} wireframe={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the feet where the worker put them, with no seat plane of its own', () => {
    // They arrive positioned in the bin's build frame, so re-deriving a seat
    // here is how the preview and the export come to disagree.
    seedFeet();
    const { container } = render(
      <DetachableFeetMesh color="#cccccc" offsetMm={0} wireframe={false} />
    );
    expect(groupZ(container)).toBe(0);
  });

  it('drops away from the bin on the explode slider, not toward it', () => {
    seedFeet();
    const closed = render(<DetachableFeetMesh color="#ccc" offsetMm={0} wireframe={false} />);
    const open = render(<DetachableFeetMesh color="#ccc" offsetMm={15} wireframe={false} />);
    expect(groupZ(open.container) - groupZ(closed.container)).toBeCloseTo(-15, 6);
  });

  it('uses the body colour', () => {
    seedFeet();
    const { container } = render(
      <DetachableFeetMesh color="#abcdef" offsetMm={0} wireframe={false} />
    );
    expect(container.querySelector('meshStandardMaterial')?.getAttribute('color')).toBe('#abcdef');
  });
});
