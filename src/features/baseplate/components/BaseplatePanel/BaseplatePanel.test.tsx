import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseplatePanel } from './BaseplatePanel';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce((str, [k, v]) => str.replace(`{${k}}`, String(v)), key);
    }
    return key;
  },
}));

// Mock layout store
const mockSetBaseplateParams = vi.fn();
const mockSetPrintBedSize = vi.fn();
let mockLayoutState = {
  layout: {
    drawer: { width: 4, depth: 6 },
    gridUnitMm: 42,
    printBedSize: 256,
    baseplateParams: { ...DEFAULT_BASEPLATE_PARAMS },
  },
  setBaseplateParams: mockSetBaseplateParams,
  setPrintBedSize: mockSetPrintBedSize,
};

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: (selector: (state: typeof mockLayoutState) => unknown) => {
    if (typeof selector === 'function') {
      return selector(mockLayoutState);
    }
    return mockLayoutState;
  },
}));

// Give useLayoutStore a getState
const { useLayoutStore } = await import('@/core/store/layout');
(useLayoutStore as unknown as { getState: () => typeof mockLayoutState }).getState = () =>
  mockLayoutState;

// Mock page store
let mockTiling: unknown = null;
let mockSplitViewMode = 'assembled';
let mockHoveredPieceLabel: string | null = null;
let mockSelectedPieceLabel: string | null = null;
const mockSetSplitViewMode = vi.fn();
const mockSetHoveredPieceLabel = vi.fn();
const mockSetSelectedPieceLabel = vi.fn();

vi.mock('../../store/baseplatePageStore', () => ({
  useBaseplatePageStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      tiling: mockTiling,
      splitViewMode: mockSplitViewMode,
      hoveredPieceLabel: mockHoveredPieceLabel,
      selectedPieceLabel: mockSelectedPieceLabel,
      setSplitViewMode: mockSetSplitViewMode,
      setHoveredPieceLabel: mockSetHoveredPieceLabel,
      setSelectedPieceLabel: mockSetSelectedPieceLabel,
    };
    return selector(state);
  },
}));

const splitTiling = {
  isSplit: true,
  cols: 2,
  rows: 1,
  pieces: [
    { label: 'A1', col: 0, row: 0, widthUnits: 5, depthUnits: 4, gridOffsetX: 0, gridOffsetY: 0 },
    { label: 'B1', col: 1, row: 0, widthUnits: 4, depthUnits: 4, gridOffsetX: 5, gridOffsetY: 0 },
  ],
  totalWidthUnits: 9,
  totalDepthUnits: 6,
  stackCount: 1,
  stackSeparatorThickness: 0,
};

describe('BaseplatePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLayoutState = {
      layout: {
        drawer: { width: 4, depth: 6 },
        gridUnitMm: 42,
        printBedSize: 256,
        baseplateParams: { ...DEFAULT_BASEPLATE_PARAMS },
      },
      setBaseplateParams: mockSetBaseplateParams,
      setPrintBedSize: mockSetPrintBedSize,
    };
    mockTiling = null;
    mockSplitViewMode = 'assembled';
    mockHoveredPieceLabel = null;
    mockSelectedPieceLabel = null;
  });

  it('renders dimensions strip with grid and mm values (no padding)', () => {
    render(<BaseplatePanel />);
    // No padding: single line with grid units and mm dimensions
    expect(screen.getByText('baseplate.dimensionsUnits')).toBeInTheDocument();
    expect(screen.getByText(/168\s*×\s*252\s*mm/)).toBeInTheDocument();
  });

  it('renders hero total dimensions when padding is set', () => {
    mockLayoutState.layout.baseplateParams = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingLeft: 5,
      paddingRight: 3,
    };
    render(<BaseplatePanel />);
    // With padding: total mm is primary, grid+padding is secondary
    expect(screen.getByText('baseplate.totalDimensions')).toBeInTheDocument();
    expect(screen.getByText('baseplate.gridPlusPadding')).toBeInTheDocument();
  });

  it('renders print settings section', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionPrintSettings')).toBeInTheDocument();
  });

  it('renders edge padding section', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionFitToDrawer')).toBeInTheDocument();
  });

  it('renders base section', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionBase')).toBeInTheDocument();
  });

  it('does not render view strip when tiling is null', () => {
    render(<BaseplatePanel />);
    expect(screen.queryByText('baseplate.splitInfo')).not.toBeInTheDocument();
  });

  it('renders view strip when tiling is split', () => {
    mockTiling = splitTiling;
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.splitInfo')).toBeInTheDocument();
    expect(screen.getByText('baseplate.splitReason')).toBeInTheDocument();
    // Mini-map buttons exist for each piece
    const pieceButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.startsWith('baseplate.pieceLabel'));
    expect(pieceButtons.length).toBe(2);
  });

  it('renders magnet toggle as switch', () => {
    render(<BaseplatePanel />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders print bed size stepper', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.printBedSize')).toBeInTheDocument();
  });

  describe('mini-map interaction', () => {
    it('renders mini-map cells as buttons with aria-label', () => {
      mockTiling = splitTiling;
      render(<BaseplatePanel />);
      const buttons = screen.getAllByRole('button', { pressed: false });
      const pieceButtons = buttons.filter((b) =>
        b.getAttribute('aria-label')?.startsWith('baseplate.pieceLabel')
      );
      expect(pieceButtons.length).toBe(2);
      expect(pieceButtons[0].tagName).toBe('BUTTON');
    });

    it('calls setHoveredPieceLabel on pointer enter/leave', () => {
      mockTiling = splitTiling;
      render(<BaseplatePanel />);
      const pieceButtons = screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-label')?.startsWith('baseplate.pieceLabel'));
      const a1Button = pieceButtons[0];
      fireEvent.pointerEnter(a1Button);
      expect(mockSetHoveredPieceLabel).toHaveBeenCalledWith('A1');
      fireEvent.pointerLeave(a1Button);
      expect(mockSetHoveredPieceLabel).toHaveBeenCalledWith(null);
    });

    it('calls setSelectedPieceLabel on click (toggle)', () => {
      mockTiling = splitTiling;
      render(<BaseplatePanel />);
      const pieceButtons = screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-label')?.startsWith('baseplate.pieceLabel'));
      const a1Button = pieceButtons[0];
      fireEvent.click(a1Button);
      expect(mockSetSelectedPieceLabel).toHaveBeenCalledWith('A1');
    });

    it('deselects on click when already selected', () => {
      mockTiling = splitTiling;
      mockSelectedPieceLabel = 'A1';
      render(<BaseplatePanel />);
      const a1Button = screen.getByText('A1');
      fireEvent.click(a1Button);
      expect(mockSetSelectedPieceLabel).toHaveBeenCalledWith(null);
    });
  });
});
