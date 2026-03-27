import { describe, it, expect, vi } from 'vitest';

vi.mock('three/examples/jsm/utils/BufferGeometryUtils.js', () => ({
  toCreasedNormals: vi.fn((geo: unknown) => geo),
}));

vi.mock('three', () => ({
  BufferGeometry: vi.fn().mockImplementation(() => ({
    setAttribute: vi.fn(),
    setIndex: vi.fn(),
    computeVertexNormals: vi.fn(),
    dispose: vi.fn(),
    clone: vi.fn().mockReturnThis(),
  })),
  Float32BufferAttribute: vi.fn(),
  BufferAttribute: vi.fn(),
  DoubleSide: 2,
}));

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ invalidate: vi.fn() }),
  useFrame: vi.fn(),
}));

vi.mock('../../store/baseplatePageStore', () => ({
  useBaseplatePageStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      generation: { mesh: null },
    };
    return selector(state);
  },
}));

vi.mock('./useMeshGeometry', () => ({
  useMeshGeometry: () => ({ geometry: null, edgesGeometry: null, hasPrecomputedNormals: false }),
}));

vi.mock('@/shared/printSettings/gridfinityGeometry', () => ({
  GRIDFINITY_SPEC: { SOCKET_HEIGHT: 5 },
}));

const { BaseplateMesh } = await import('./BaseplateMesh');

describe('BaseplateMesh', () => {
  it('exports a component function', () => {
    expect(typeof BaseplateMesh).toBe('function');
  });
});
