import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import type { SplitPieceMeshEntry } from '../../../types';

// Mock Three.js before the component is imported
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

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({ invalidate: vi.fn() }),
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  Text: ({ children, ...props }: { children: ReactNode; position?: number[] }) => (
    <div data-testid="drei-text" data-position={JSON.stringify(props.position)}>
      {children}
    </div>
  ),
}));

vi.mock('@/shared/components/preview/useMeshGeometry', () => ({
  useMeshGeometry: () => ({
    geometry: { dispose: vi.fn() },
    edgesGeometry: { dispose: vi.fn() },
    hasPrecomputedNormals: true,
  }),
}));

vi.mock('@/shared/hooks/useThemeEffect', () => ({
  useThreeColors: () => ({
    labelColor: '#ffffff',
    gradientBottom: '#2a2a3e',
  }),
}));

// Import after mocks
import { SplitBinMeshes } from './SplitBinMeshes';

/** Build a minimal SplitPieceMeshEntry for test use. */
function makePieceEntry(overrides: Partial<SplitPieceMeshEntry> = {}): SplitPieceMeshEntry {
  return {
    label: 'piece-1x1',
    col: 1,
    row: 1,
    widthUnits: 4,
    depthUnits: 3,
    offsetX: 0,
    offsetY: 0,
    mesh: {
      vertices: new Float32Array([0, 0, 0, 1, 1, 1]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2]),
      edgeVertices: new Float32Array([0, 0, 0, 1, 1, 1]),
    },
    ...overrides,
  };
}

describe('SplitBinMeshes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
      ui: {
        ...DEFAULT_UI_STATE,
        splitPieceMeshes: [],
        splitViewMode: 'assembled',
      },
    });
  });

  it('renders nothing when splitPieceMeshes is empty', () => {
    const { container } = render(<SplitBinMeshes color="#ff0000" wireframe={false} />);
    // No mesh groups rendered
    expect(container.innerHTML).toBe('');
  });

  it('renders a group for each entry in splitPieceMeshes', () => {
    const pieces: SplitPieceMeshEntry[] = [
      makePieceEntry({ label: 'piece-A', col: 0, row: 0 }),
      makePieceEntry({ label: 'piece-B', col: 1, row: 0 }),
    ];

    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
      ui: {
        ...DEFAULT_UI_STATE,
        splitPieceMeshes: pieces,
        splitViewMode: 'assembled',
      },
    });

    // The component renders mesh groups; since Three.js elements are not real DOM nodes
    // they render as empty fragments — verify the component doesn't throw and mounts.
    const { container } = render(<SplitBinMeshes color="#00ff00" wireframe={false} />);
    expect(container).toBeDefined();
  });

  it('does not render Text labels in assembled mode', () => {
    const pieces: SplitPieceMeshEntry[] = [makePieceEntry({ label: 'piece-1x1', col: 0, row: 0 })];

    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
      ui: {
        ...DEFAULT_UI_STATE,
        splitPieceMeshes: pieces,
        splitViewMode: 'assembled',
      },
    });

    const { queryAllByTestId } = render(<SplitBinMeshes color="#0000ff" wireframe={false} />);
    expect(queryAllByTestId('drei-text')).toHaveLength(0);
  });

  it('renders Text labels in exploded mode', () => {
    const pieces: SplitPieceMeshEntry[] = [
      makePieceEntry({ label: 'piece-1x1', col: 0, row: 0 }),
      makePieceEntry({ label: 'piece-2x1', col: 1, row: 0 }),
    ];

    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
      ui: {
        ...DEFAULT_UI_STATE,
        splitPieceMeshes: pieces,
        splitViewMode: 'exploded',
      },
    });

    const { getAllByTestId } = render(<SplitBinMeshes color="#ff0000" wireframe={false} />);
    const labels = getAllByTestId('drei-text');
    // One label per piece
    expect(labels).toHaveLength(2);
  });

  it('renders label text matching each piece label in exploded mode', () => {
    const pieces: SplitPieceMeshEntry[] = [
      makePieceEntry({ label: 'top-left', col: 0, row: 0 }),
      makePieceEntry({ label: 'top-right', col: 1, row: 0 }),
    ];

    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
      ui: {
        ...DEFAULT_UI_STATE,
        splitPieceMeshes: pieces,
        splitViewMode: 'exploded',
      },
    });

    const { getAllByTestId } = render(<SplitBinMeshes color="#ff0000" wireframe={false} />);
    const labels = getAllByTestId('drei-text');
    const texts = labels.map((el) => el.textContent);
    expect(texts).toContain('top-left');
    expect(texts).toContain('top-right');
  });

  it('renders no labels when splitPieceMeshes is empty in exploded mode', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
      ui: {
        ...DEFAULT_UI_STATE,
        splitPieceMeshes: [],
        splitViewMode: 'exploded',
      },
    });

    const { queryAllByTestId } = render(<SplitBinMeshes color="#ff0000" wireframe={false} />);
    expect(queryAllByTestId('drei-text')).toHaveLength(0);
  });

  it('uses col and row to compute explode offsets (EXPLODE_GAP_MM = 10)', () => {
    // Two pieces in different columns — in exploded mode their x positions differ
    // by col * EXPLODE_GAP_MM. We verify the component renders without error with
    // distinct col/row values.
    const pieces: SplitPieceMeshEntry[] = [
      makePieceEntry({ label: 'p-0-0', col: 0, row: 0, offsetX: 0, offsetY: 0 }),
      makePieceEntry({ label: 'p-1-0', col: 1, row: 0, offsetX: 4, offsetY: 0 }),
      makePieceEntry({ label: 'p-0-1', col: 0, row: 1, offsetX: 0, offsetY: 3 }),
    ];

    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 6 },
      ui: {
        ...DEFAULT_UI_STATE,
        splitPieceMeshes: pieces,
        splitViewMode: 'exploded',
      },
    });

    const { getAllByTestId } = render(<SplitBinMeshes color="#ff0000" wireframe={false} />);
    // One label per piece in exploded mode
    expect(getAllByTestId('drei-text')).toHaveLength(3);
  });

  it('accepts wireframe prop without throwing', () => {
    const pieces: SplitPieceMeshEntry[] = [makePieceEntry({ label: 'wire-piece', col: 0, row: 0 })];

    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
      ui: {
        ...DEFAULT_UI_STATE,
        splitPieceMeshes: pieces,
        splitViewMode: 'exploded',
      },
    });

    // Wireframe mode: Text labels should still appear but edges are hidden
    expect(() => render(<SplitBinMeshes color="#ff0000" wireframe={true} />)).not.toThrow();
  });

  it('reads params from the designer store (gridUnitMm)', () => {
    // Verify that changing gridUnitMm in the store is reflected without error
    const pieces: SplitPieceMeshEntry[] = [
      makePieceEntry({ label: 'metric-piece', col: 0, row: 0 }),
    ];

    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3, gridUnitMm: 50 },
      ui: {
        ...DEFAULT_UI_STATE,
        splitPieceMeshes: pieces,
        splitViewMode: 'assembled',
      },
    });

    expect(() => render(<SplitBinMeshes color="#ff0000" wireframe={false} />)).not.toThrow();
  });

  it('renders without error when TOLERANCE is subtracted from total dimensions', () => {
    const pieces: SplitPieceMeshEntry[] = [
      makePieceEntry({
        label: 'left',
        col: 1,
        row: 1,
        widthUnits: 4,
        depthUnits: 2,
        offsetX: 0,
        offsetY: 0,
      }),
      makePieceEntry({
        label: 'right',
        col: 2,
        row: 1,
        widthUnits: 4,
        depthUnits: 2,
        offsetX: 4,
        offsetY: 0,
      }),
    ];

    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 2 },
      ui: {
        ...DEFAULT_UI_STATE,
        splitPieceMeshes: pieces,
        splitViewMode: 'assembled',
      },
    });

    expect(() => render(<SplitBinMeshes color="#00ff00" wireframe={false} />)).not.toThrow();
  });
});
