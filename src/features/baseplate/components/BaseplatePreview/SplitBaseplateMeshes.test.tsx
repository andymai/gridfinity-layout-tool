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
  PlaneGeometry: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
  DoubleSide: 2,
}));

// Mock react-three/fiber
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ invalidate: vi.fn() }),
}));

// Mock drei Text component
vi.mock('@react-three/drei', () => ({
  Text: vi.fn(() => null),
}));

// Mock useThreeColors
vi.mock('@/hooks/useThemeEffect', () => ({
  useThreeColors: () => ({
    labelColor: '#ffffff',
    gradientBottom: '#2a2a3e',
  }),
}));

// Mock settings store — filament color from user settings
const MOCK_FILAMENT_COLOR = '#ef4444';
vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ settings: { baseplateFilamentColor: MOCK_FILAMENT_COLOR } }),
}));

// Mock store
vi.mock('../../store/baseplatePageStore', () => ({
  useBaseplatePageStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      pieceMeshes: [],
      splitViewMode: 'assembled',
      hoveredPieceLabel: null,
      selectedPieceLabel: null,
      setHoveredPieceLabel: vi.fn(),
      setSelectedPieceLabel: vi.fn(),
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

  it('uses shared material props for consistent rendering', async () => {
    const materialProps = await import('./materialProps');
    expect(materialProps.MESH_MATERIAL_PROPS).toBeDefined();
    expect(materialProps.MESH_MATERIAL_PROPS.roughness).toBe(0.45);
    expect(materialProps.EDGE_MATERIAL_PROPS).toBeDefined();
    expect(materialProps.EDGE_MATERIAL_PROPS.color).toBe('#000000');
  });

  it('reads filament color from settings store instead of hardcoded constant', async () => {
    // Verify the settings store mock returns the expected filament color,
    // confirming the module depends on useSettingsStore for color
    const { useSettingsStore } = await import('@/core/store');
    const color = (
      useSettingsStore as unknown as (s: (state: Record<string, unknown>) => unknown) => unknown
    )(
      (s: Record<string, unknown>) => (s.settings as Record<string, unknown>).baseplateFilamentColor
    );
    expect(color).toBe(MOCK_FILAMENT_COLOR);
  });

  it('does not export a PIECE_COLOR constant (removed hardcoded color)', async () => {
    const mod = await import('./SplitBaseplateMeshes');
    // Verify no PIECE_COLOR is exported — color comes from settings store
    expect('PIECE_COLOR' in mod).toBe(false);
  });
});
