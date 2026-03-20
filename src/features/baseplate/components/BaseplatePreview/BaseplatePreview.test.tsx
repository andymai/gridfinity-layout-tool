import { describe, it, expect, vi } from 'vitest';

// Mock Three.js
vi.mock('three', () => ({
  Vector3: vi.fn().mockImplementation(() => ({
    normalize: vi.fn().mockReturnThis(),
    multiplyScalar: vi.fn().mockReturnThis(),
    add: vi.fn().mockReturnThis(),
    clone: vi.fn().mockReturnThis(),
    sub: vi.fn().mockReturnThis(),
    copy: vi.fn(),
    set: vi.fn(),
    lerpVectors: vi.fn(),
  })),
  Spherical: vi.fn().mockImplementation(() => ({
    setFromVector3: vi.fn().mockReturnThis(),
    radius: 100,
    phi: 1,
    theta: 1,
  })),
  Color: vi.fn(),
  ShaderMaterial: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
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

// Mock react-three/fiber
vi.mock('@react-three/fiber', () => ({
  Canvas: vi.fn(({ children }: { children: React.ReactNode }) => children),
  useThree: () => ({ invalidate: vi.fn(), camera: { position: { clone: vi.fn() } } }),
  useFrame: vi.fn(),
}));

// Mock drei
vi.mock('@react-three/drei', () => ({
  OrbitControls: vi.fn(() => null),
  Text: vi.fn(() => null),
}));

// Mock shared components
vi.mock('@/shared/components/preview/FootprintGrid', () => ({
  FootprintGrid: vi.fn(() => null),
}));
vi.mock('@/shared/components/preview/BinAxisLabels', () => ({
  BinAxisLabels: vi.fn(() => null),
}));
vi.mock('@/shared/components/preview/GradientBackground', () => ({
  GradientBackground: vi.fn(() => null),
}));
vi.mock('@/shared/components/preview/Spinner', () => ({
  Spinner: vi.fn(() => null),
}));

// Mock hooks
vi.mock('@/shared/hooks/useThemeEffect', () => ({
  useThreeColors: () => ({
    groundBounce: '#1a1a2e',
    gradientTop: '#2a2a3e',
    gradientMid: '#252535',
    gradientBottom: '#2a2a3e',
    labelColor: '#ffffff',
    contactShadowColor: '#000000',
  }),
}));
vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: true, isTouchDevice: false }),
}));
vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ settings: { baseplateFilamentColor: '#d4d8dc' } }),
}));
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

// Mock internal modules
vi.mock('../../store/baseplatePageStore', () => ({
  useBaseplatePageStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      wasmStatus: 'ready',
      generation: { mesh: null, status: 'idle' },
      pieceMeshes: [],
      tiling: null,
      splitViewMode: 'assembled',
      hoveredPieceLabel: null,
      selectedPieceLabel: null,
      splitProgress: null,
      setSplitViewMode: vi.fn(),
      setSelectedPieceLabel: vi.fn(),
    };
    return selector(state);
  },
}));
vi.mock('./SplitBaseplateMeshes', () => ({
  SplitBaseplateMeshes: vi.fn(() => null),
}));
vi.mock('./GhostPaddingOutline', () => ({
  GhostPaddingOutline: vi.fn(() => null),
}));
vi.mock('./useMeshGeometry', () => ({
  useMeshGeometry: () => ({ geometry: null, edgesGeometry: null, hasPrecomputedNormals: false }),
}));
vi.mock('@/shared/printSettings/gridfinityGeometry', () => ({
  GRIDFINITY_SPEC: { SOCKET_HEIGHT: 5 },
}));

const { BaseplatePreview } = await import('./BaseplatePreview');

describe('BaseplatePreview', () => {
  it('exports a component function', () => {
    expect(typeof BaseplatePreview).toBe('function');
  });

  it('imports shared material props for consistent rendering', async () => {
    const materialProps = await import('./materialProps');
    expect(materialProps.MESH_MATERIAL_PROPS).toBeDefined();
    expect(materialProps.MESH_MATERIAL_PROPS.roughness).toBe(0.45);
    expect(materialProps.EDGE_MATERIAL_PROPS).toBeDefined();
    expect(materialProps.EDGE_MATERIAL_PROPS.color).toBe('#000000');
  });
});
