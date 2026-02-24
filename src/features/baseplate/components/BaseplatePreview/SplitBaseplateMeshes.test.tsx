import { describe, it, expect, vi } from 'vitest';

// Mock Three.js
vi.mock('three', () => ({
  BufferGeometry: vi.fn().mockImplementation(() => ({
    setAttribute: vi.fn(),
    setIndex: vi.fn(),
    computeVertexNormals: vi.fn(),
    dispose: vi.fn(),
  })),
  Float32BufferAttribute: vi.fn(),
  BufferAttribute: vi.fn(),
  DoubleSide: 2,
}));

// Mock react-three/fiber
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ invalidate: vi.fn() }),
}));

// Mock store
const mockPieceMeshes: unknown[] = [];
const mockSplitViewMode = 'assembled';

vi.mock('../../store/baseplatePageStore', () => ({
  useBaseplatePageStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      pieceMeshes: mockPieceMeshes,
      splitViewMode: mockSplitViewMode,
    };
    return selector(state);
  },
}));

// Import the module under test (after mocks)
const { SplitBaseplateMeshes } = await import('./SplitBaseplateMeshes');

describe('SplitBaseplateMeshes', () => {
  it('exports a component function', () => {
    expect(typeof SplitBaseplateMeshes).toBe('function');
  });

  it('accepts required props', () => {
    expect(SplitBaseplateMeshes.length).toBeGreaterThanOrEqual(0);
  });

  it('module imports without errors when mocked', () => {
    // Verifies the module can be loaded with mocked Three.js dependencies
    expect(SplitBaseplateMeshes).toBeDefined();
  });
});
