import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { StackPlateMesh } from './StackPlateMesh';

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

function seedStackPlate(): void {
  useDesignerStore.setState({
    generation: {
      status: 'complete',
      mesh: { ...tri, error: null, timingMs: 1, stackPlateMesh: { ...tri, triangleCount: 1 } },
      progress: 0,
      epoch: 0,
    },
  });
}

describe('StackPlateMesh', () => {
  it('renders nothing when no stackPlateMesh is in the store', () => {
    const { container } = render(
      <StackPlateMesh color="#cccccc" lidOffsetMm={0} wireframe={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  const materialColor = (container: HTMLElement): string | null | undefined =>
    container.querySelector('meshStandardMaterial')?.getAttribute('color');

  it('follows the lid zone color when multi-color is enabled (matches the lid it glues to)', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        featureColors: { ...DEFAULT_BIN_PARAMS.featureColors, enabled: true, lid: '#ff0000' },
      },
    });
    seedStackPlate();
    const { container } = render(
      <StackPlateMesh color="#cccccc" lidOffsetMm={0} wireframe={false} />
    );
    expect(materialColor(container)).toBe('#ff0000');
  });

  it('falls back to the body color when multi-color is disabled', () => {
    seedStackPlate();
    const { container } = render(
      <StackPlateMesh color="#cccccc" lidOffsetMm={0} wireframe={false} />
    );
    expect(materialColor(container)).toBe('#cccccc');
  });
});
