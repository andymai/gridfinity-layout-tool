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

  it('renders dimensions strip with grid summary', () => {
    render(<BaseplatePanel />);
    // Dimensions strip shows "WxD — WmmxDmm" inline (no collapsible header)
    expect(screen.getByText('4\u00d76 \u2014 168\u00d7252mm')).toBeInTheDocument();
  });

  it('renders print settings section', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionPrintSettings')).toBeInTheDocument();
  });

  it('renders edge padding section', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionFitToDrawer')).toBeInTheDocument();
  });

  it('renders magnet section', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionMagnets')).toBeInTheDocument();
  });

  it('hides reset button when params are default', () => {
    render(<BaseplatePanel />);
    expect(screen.queryByLabelText('baseplate.resetParams')).not.toBeInTheDocument();
  });

  it('shows reset button when params differ from defaults', () => {
    mockLayoutState.layout.baseplateParams = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingLeft: 5,
    };
    render(<BaseplatePanel />);
    expect(screen.getByLabelText('baseplate.resetParams')).toBeInTheDocument();
  });

  it('does not render split section when tiling is null', () => {
    render(<BaseplatePanel />);
    expect(screen.queryByText('baseplate.sectionSplit')).not.toBeInTheDocument();
  });

  it('renders split section when tiling is split', () => {
    mockTiling = splitTiling;
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionSplit')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
  });

  it('renders segmented control for split view mode', () => {
    mockTiling = splitTiling;
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.viewAssembled')).toBeInTheDocument();
    expect(screen.getByText('baseplate.viewExploded')).toBeInTheDocument();
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
      const a1Button = screen.getByText('A1');
      fireEvent.pointerEnter(a1Button);
      expect(mockSetHoveredPieceLabel).toHaveBeenCalledWith('A1');
      fireEvent.pointerLeave(a1Button);
      expect(mockSetHoveredPieceLabel).toHaveBeenCalledWith(null);
    });

    it('calls setSelectedPieceLabel on click (toggle)', () => {
      mockTiling = splitTiling;
      render(<BaseplatePanel />);
      const a1Button = screen.getByText('A1');
      fireEvent.click(a1Button);
      expect(mockSetSelectedPieceLabel).toHaveBeenCalledWith('A1');
    });

    it('deselects on click when already selected', () => {
      mockTiling = splitTiling;
      mockSelectedPieceLabel = 'A1';
      render(<BaseplatePanel />);
      // Multiple "A1" elements exist (button + detail strip), pick the button
      const a1Elements = screen.getAllByText('A1');
      const a1Button = a1Elements.find((el) => el.tagName === 'BUTTON') as HTMLElement;
      fireEvent.click(a1Button);
      expect(mockSetSelectedPieceLabel).toHaveBeenCalledWith(null);
    });

    it('renders piece detail strip when a piece is hovered', () => {
      mockTiling = splitTiling;
      mockHoveredPieceLabel = 'A1';
      render(<BaseplatePanel />);
      // Detail strip shows the label and dimensions
      expect(screen.getByText('baseplate.pieceDimensions')).toBeInTheDocument();
    });

    it('does not render piece detail strip when no piece is active', () => {
      mockTiling = splitTiling;
      render(<BaseplatePanel />);
      expect(screen.queryByText('baseplate.pieceDimensions')).not.toBeInTheDocument();
    });
  });
});
