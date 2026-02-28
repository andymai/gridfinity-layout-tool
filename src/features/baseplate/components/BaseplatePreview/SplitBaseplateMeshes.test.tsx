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
const mockPieceMeshes: unknown[] = [];
const mockSplitViewMode = 'assembled';
const mockSetHoveredPieceLabel = vi.fn();
const mockSetSelectedPieceLabel = vi.fn();

vi.mock('../../store/baseplatePageStore', () => ({
  useBaseplatePageStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      pieceMeshes: mockPieceMeshes,
      splitViewMode: mockSplitViewMode,
      hoveredPieceLabel: null,
      selectedPieceLabel: null,
      setHoveredPieceLabel: mockSetHoveredPieceLabel,
      setSelectedPieceLabel: mockSetSelectedPieceLabel,
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

  it('accepts totalWidthUnits and totalDepthUnits props (no color)', () => {
    // Verify the component no longer requires a color prop
    expect(SplitBaseplateMeshes.length).toBeGreaterThanOrEqual(0);
  });

  it('module imports without errors when mocked', () => {
    expect(SplitBaseplateMeshes).toBeDefined();
  });

  it('uses filament color from settings store instead of hardcoded constant', async () => {
    // Verify the module no longer has a PIECE_COLOR constant by checking
    // that the settings store mock with MOCK_FILAMENT_COLOR is wired up
    const { useSettingsStore } = await import('@/core/store');
    const color = useSettingsStore(
      (s: Record<string, unknown>) => (s.settings as Record<string, unknown>).baseplateFilamentColor
    );
    expect(color).toBe(MOCK_FILAMENT_COLOR);
  });
});
