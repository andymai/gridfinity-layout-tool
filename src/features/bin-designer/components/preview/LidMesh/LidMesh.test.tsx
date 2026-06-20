import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { LidMesh } from './LidMesh';
import { lidAnchorZ as lidAnchorZMain, lidWallBottomZ as lidWallBottomZMain } from './lidAnchorZ';
import {
  lidAnchorZ as lidAnchorZWorker,
  lidWallBottomZ as lidWallBottomZWorker,
} from '@/features/generation/worker/generators/lidConstants';
import { LID_FIT_CLEARANCE } from '@/features/bin-designer/types';

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

describe('LidMesh', () => {
  it('renders nothing when no lidMesh is in the store', () => {
    const { container } = render(<LidMesh color="#cccccc" lidOffsetMm={0} wireframe={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no mesh is generated yet (regardless of offset)', () => {
    const { container } = render(<LidMesh color="#cccccc" lidOffsetMm={15} wireframe={false} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('LidMesh color (#1654)', () => {
  const tri = {
    vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    edgeVertices: new Float32Array([0, 0, 0, 1, 0, 0]),
  };

  function seedLidMesh(): void {
    useDesignerStore.setState({
      generation: {
        status: 'complete',
        mesh: { ...tri, error: null, timingMs: 1, lidMesh: { ...tri, triangleCount: 1 } },
        progress: 0,
        epoch: 0,
      },
    });
  }

  const lidMaterialColor = (container: HTMLElement): string | null | undefined =>
    container.querySelector('meshStandardMaterial')?.getAttribute('color');

  it('paints the lid with the lid zone color when multi-color is enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        featureColors: { ...DEFAULT_BIN_PARAMS.featureColors, enabled: true, lid: '#ff0000' },
      },
    });
    seedLidMesh();
    const { container } = render(<LidMesh color="#cccccc" lidOffsetMm={0} wireframe={false} />);
    // Body fallback ("#cccccc") would be the bug; the lid must follow its zone.
    expect(lidMaterialColor(container)).toBe('#ff0000');
  });

  it('falls back to the body color when multi-color is disabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        featureColors: { ...DEFAULT_BIN_PARAMS.featureColors, enabled: false, lid: '#ff0000' },
      },
    });
    seedLidMesh();
    const { container } = render(<LidMesh color="#cccccc" lidOffsetMm={0} wireframe={false} />);
    expect(lidMaterialColor(container)).toBe('#cccccc');
  });
});

describe('lid Z formulas cross-thread agreement', () => {
  // The lidAnchorZ + lidWallBottomZ formulas are duplicated between the
  // worker (lidConstants.ts) and the main thread (lidAnchorZ.ts) because
  // the worker module can't be imported into the rendered preview bundle.
  // This test compares both implementations across representative inputs
  // so silent drift fails fast.
  const HEIGHT_UNITS = [4, 7, 10] as const; // common Gridfinity values + edges
  for (const heightUnitMm of HEIGHT_UNITS) {
    it(`lidAnchorZ agrees for heightUnitMm=${heightUnitMm}`, () => {
      const main = lidAnchorZMain(heightUnitMm, LID_FIT_CLEARANCE);
      const worker = lidAnchorZWorker(heightUnitMm, LID_FIT_CLEARANCE);
      // Both formulas use Math.SQRT2 → exact equality is reasonable.
      expect(main).toBe(worker);
    });
    it(`lidWallBottomZ agrees for heightUnitMm=${heightUnitMm}`, () => {
      const main = lidWallBottomZMain(heightUnitMm, LID_FIT_CLEARANCE);
      const worker = lidWallBottomZWorker(heightUnitMm, LID_FIT_CLEARANCE);
      expect(main).toBe(worker);
    });
  }
});
