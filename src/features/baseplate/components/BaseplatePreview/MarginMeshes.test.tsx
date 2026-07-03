import { describe, it, expect, vi } from 'vitest';
import type { MarginMeshEntry } from '../../store/baseplatePageStore';

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ invalidate: vi.fn() }),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

// useMeshGeometry returns a ready geometry so a present rail renders.
vi.mock('./useMeshGeometry', () => ({
  useMeshGeometry: () => ({
    geometry: {},
    edgesGeometry: null,
    hasPrecomputedNormals: true,
  }),
}));

let storeState: { marginMeshes: readonly MarginMeshEntry[]; splitViewMode: string } = {
  marginMeshes: [],
  splitViewMode: 'exploded',
};

vi.mock('../../store/baseplatePageStore', () => ({
  useBaseplatePageStore: (selector: (s: unknown) => unknown) => selector(storeState),
}));

const { MarginMeshes } = await import('./MarginMeshes');

const rail = (over: Partial<MarginMeshEntry> = {}): MarginMeshEntry => ({
  id: 'margin-front',
  side: 'front',
  mesh: {
    vertices: new Float32Array(),
    normals: new Float32Array(),
    indices: new Uint32Array(),
    edgeVertices: new Float32Array(),
    error: null,
    timingMs: 0,
  },
  worldOffsetMm: { x: 0, y: -10 },
  lengthMm: 100,
  bandThicknessMm: 10,
  col: 0,
  row: 0,
  ...over,
});

describe('MarginMeshes', () => {
  it('renders nothing when there are no rails', () => {
    storeState = { marginMeshes: [], splitViewMode: 'exploded' };
    expect(MarginMeshes({ color: '#fff' })).toBeNull();
  });

  it('renders a fragment of rails when present', () => {
    storeState = {
      marginMeshes: [rail(), rail({ id: 'margin-left', side: 'left' })],
      splitViewMode: 'exploded',
    };
    const out = MarginMeshes({ color: '#fff' });
    expect(out).not.toBeNull();
  });
});
