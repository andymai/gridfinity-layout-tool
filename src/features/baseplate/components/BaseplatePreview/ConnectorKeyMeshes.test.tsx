import { describe, it, expect, vi } from 'vitest';

// Mock Three.js — only the bits the component constructs.
vi.mock('three', () => ({
  Shape: vi.fn().mockImplementation(() => ({
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
  })),
  ExtrudeGeometry: vi.fn().mockImplementation(() => ({
    computeVertexNormals: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ invalidate: vi.fn() }),
}));

// Layout store: a dovetail key + split configuration.
vi.mock('@/core/store/layout', () => ({
  useLayoutStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      layout: {
        gridUnitMm: 42,
        drawer: { width: 18, depth: 12, fractionalEdgeX: 'end', fractionalEdgeY: 'end' },
        baseplateParams: {
          magnetHoles: false,
          magnetDiameter: 6.5,
          magnetDepth: 2,
          paddingLeft: 0,
          paddingRight: 0,
          paddingFront: 0,
          paddingBack: 0,
          connectorNubs: true,
          connectorStyle: 'dovetailKey',
        },
      },
    }),
}));

vi.mock('../../store/baseplatePageStore', () => ({
  useBaseplatePageStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ tiling: null, splitViewMode: 'assembled' }),
}));

const { ConnectorKeyMeshes } = await import('./ConnectorKeyMeshes');

describe('ConnectorKeyMeshes', () => {
  it('exports a component function', () => {
    expect(typeof ConnectorKeyMeshes).toBe('function');
  });

  it('does not export the placement helper (it lives in connectorKeys util)', async () => {
    const mod = await import('./ConnectorKeyMeshes');
    expect('computeSeamJunctions' in mod).toBe(false);
  });
});
