import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_UI_STATE,
  DEFAULT_GENERATION_STATE,
} from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import { PREVIEW_Z_OFFSET } from '../LidMesh/lidAnchorZ';
import { SlantSupportMesh } from './SlantSupportMesh';

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

const supported: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  slant: { angleDeg: 45, side: 'back', endSupport: true },
};

const tri = {
  vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint32Array([0, 1, 2]),
  edgeVertices: new Float32Array([0, 0, 0, 1, 0, 0]),
};

function seedSupport(): void {
  useDesignerStore.setState({
    generation: {
      ...DEFAULT_GENERATION_STATE,
      status: 'complete',
      mesh: { ...tri, error: null, timingMs: 1, slantSupportMesh: { ...tri, triangleCount: 1 } },
      progress: 0,
      epoch: 0,
    },
  });
}

beforeEach(() => {
  useDesignerStore.setState({
    params: supported,
    ui: { ...DEFAULT_UI_STATE },
    generation: { ...DEFAULT_GENERATION_STATE },
  });
});

describe('SlantSupportMesh', () => {
  it('renders nothing before the worker sends a support', () => {
    const { container } = render(<SlantSupportMesh color="#cccccc" />);
    expect(container.firstChild).toBeNull();
  });

  it('stands on the bin ground plane, already in the bin frame', () => {
    seedSupport();
    const { container } = render(<SlantSupportMesh color="#cccccc" />);
    const position = (container.querySelector('group')?.getAttribute('position') ?? '')
      .split(',')
      .map(Number);
    expect(position).toEqual([0, 0, PREVIEW_Z_OFFSET]);
  });

  it('drops a support the design no longer asks for', () => {
    seedSupport();
    useDesignerStore.setState({ params: { ...supported, slant: { angleDeg: 45, side: 'back' } } });
    const { container } = render(<SlantSupportMesh color="#cccccc" />);
    expect(container.firstChild).toBeNull();
  });

  it('drops the edge overlay in wireframe mode', () => {
    seedSupport();
    const { container } = render(<SlantSupportMesh color="#ccc" wireframe />);
    expect(container.querySelector('lineSegments')).toBeNull();
  });
});
