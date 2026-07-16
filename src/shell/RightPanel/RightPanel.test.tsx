import type * as DesignSystem from '@/design-system';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightPanel } from '@/shell/RightPanel';
import { useLayoutStore, useViewStore, useSettingsStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import type { UseBinInspectorReturn } from '@/features/bin-inspector';
import type { UsePrintListReturn } from '@/features/print-export/hooks/usePrintList';

// Mock inspector components
vi.mock('@/features/bin-inspector', () => ({
  useBinInspector: vi.fn(),
  SingleBinInspector: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="single-bin-inspector">
      <button onClick={onClose}>Close Single</button>
    </div>
  ),
  MultiBinInspector: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="multi-bin-inspector">
      <button onClick={onClose}>Close Multi</button>
    </div>
  ),
  EmptyState: () => <div data-testid="empty-state">No selection</div>,
}));

// Mock SplitPreview
vi.mock('@/shell/Print/SplitPreview', () => ({
  SplitPreview: ({
    width,
    depth,
    pieces,
  }: {
    width: number;
    depth: number;
    pieces: { width: number; depth: number; count: number }[];
  }) => (
    <div data-testid="split-preview">
      Split: {width}×{depth} into {pieces.length} pieces
    </div>
  ),
}));

// Mock Print components from print-export feature
vi.mock('@/features/print-export/components', () => ({
  PrintListSummary: ({ totalBins, totalPieces }: { totalBins: number; totalPieces: number }) => (
    <div data-testid="print-list-summary">
      Summary: {totalBins} bins, {totalPieces} pieces
    </div>
  ),
  PrintListEmpty: () => <div data-testid="print-list-empty">No bins to print</div>,
}));

// Mock Collapsible — mirrors the primitive's toggle contract (aria-expanded
// trigger named by title, optional badge/actions, content hidden collapsed)
vi.mock('@/design-system', async () => {
  const actual = await vi.importActual<typeof DesignSystem>('@/design-system');
  const { useState } = await import('react');

  function MockCollapsible({
    title,
    children,
    badge,
    actions,
    expanded,
    onExpandedChange,
    defaultExpanded = true,
  }: {
    title: string;
    children: React.ReactNode;
    badge?: React.ReactNode;
    actions?: React.ReactNode;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    defaultExpanded?: boolean;
  }) {
    const [internal, setInternal] = useState(defaultExpanded);
    const isExpanded = expanded ?? internal;
    const toggle = () => {
      onExpandedChange?.(!isExpanded);
      setInternal(!isExpanded);
    };
    return (
      <div data-testid="collapsible-section">
        <button type="button" aria-expanded={isExpanded} onClick={toggle}>
          <span data-testid="collapsible-title">{title}</span>
          {badge}
        </button>
        {actions}
        {isExpanded && children}
      </div>
    );
  }

  return { ...actual, Collapsible: MockCollapsible };
});

// Mock ConfirmDialog
vi.mock('@/shared/components/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <div data-testid="confirm-title">{title}</div>
        <div data-testid="confirm-message">{message}</div>
        <button onClick={onConfirm}>Confirm Delete</button>
        <button onClick={onCancel}>Cancel Delete</button>
      </div>
    ) : null,
}));

// Mock storage utilities
const mockExportPrintListTSV = vi.fn(() => 'Size\tHeight\tQty\n2×2\t3\t1');
vi.mock('@/core/storage', () => ({
  exportPrintListTSV: () => mockExportPrintListTSV(),
}));

// Mock analytics
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  trackLayoutSnapshot: vi.fn(),
}));

// Mock clipboard
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
});

// Mock usePrintList hook
const mockSelectBinsByRow = vi.fn();
let mockPrintListReturn: UsePrintListReturn;

vi.mock('@/features/print-export/hooks/usePrintList', () => ({
  usePrintList: () => mockPrintListReturn,
}));

// Get useBinInspector mock
import { useBinInspector } from '@/features/bin-inspector';
const mockUseBinInspector = useBinInspector as ReturnType<typeof vi.fn>;

describe('RightPanel', () => {
  const mockLayout = {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [
      { id: 'coral', name: 'Coral', color: '#FF6B6B' },
      { id: 'blue', name: 'Blue', color: '#4ECDC4' },
    ],
    layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
    bins: [
      {
        id: 'bin1',
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'coral',
        label: 'Screws',
        notes: 'M3',
      },
    ],
  };

  const createMockInspector = (
    overrides: Partial<UseBinInspectorReturn> = {}
  ): UseBinInspectorReturn => ({
    selectedBins: [],
    isMultiSelect: false,
    bin: null,
    category: null,
    layer: null,
    constraints: {
      minHeight: 2,
      maxHeight: 12,
      maxClearance: 9,
      maxGridUnits: 6,
      needsSplit: false,
      heightRange: '2u – 12u',
    },
    updateField: vi.fn(),
    updateMultiCategory: vi.fn(),
    updateMultiHeight: vi.fn(),
    updateMultiClearance: vi.fn(),
    moveToLayer: vi.fn(),
    updateMultiLayer: vi.fn(),
    requestDelete: vi.fn(),
    confirmDelete: vi.fn(),
    cancelDelete: vi.fn(),
    moveToStaging: vi.fn(),
    clearSelection: vi.fn(),
    rotateBin: vi.fn(),
    deleteConfirmState: null,
    layout: mockLayout,
    categories: mockLayout.categories,
    ...overrides,
  });

  const createMockPrintList = (
    overrides: Partial<UsePrintListReturn> = {}
  ): UsePrintListReturn => ({
    rows: [],
    groupedRows: null,
    totalBins: 0,
    totalPieces: 0,
    totalFilament: 0,
    totalCost: 0,
    totalPrintTimeHours: 0,
    spoolEstimate: 0,
    spoolPercentage: 0,
    hasAnySplits: false,
    filters: {
      hiddenCategoryIds: new Set(),
      sortKey: 'default',
      sortOrder: 'desc',
      groupByCategory: false,
    },
    setSort: vi.fn(),
    toggleSortOrder: vi.fn(),
    toggleCategoryVisibility: vi.fn(),
    toggleGroupByCategory: vi.fn(),
    resetFilters: vi.fn(),
    config: {
      filamentCostPerKg: 25,
      metersPerKg: 330,
    },
    setFilamentCostPerKg: vi.fn(),
    selectBinsByRow: mockSelectBinsByRow,
    categories: mockLayout.categories,
    ...overrides,
  });

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    useLayoutStore.setState({ layout: mockLayout });
    useViewStore.setState({ rightPanelCollapsed: false });

    mockUseBinInspector.mockReturnValue(createMockInspector());
    mockPrintListReturn = createMockPrintList();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('collapsed state', () => {
    it('renders collapsed panel with expand button', () => {
      useViewStore.setState({ rightPanelCollapsed: true });
      render(<RightPanel />);

      const expandButton = screen.getByRole('button', { name: 'Expand right panel' });
      expect(expandButton).toBeInTheDocument();
    });

    it('expands panel when expand button clicked', () => {
      useViewStore.setState({ rightPanelCollapsed: true });
      render(<RightPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand right panel' }));

      expect(useViewStore.getState().rightPanelCollapsed).toBe(false);
    });

    it('has narrow width when collapsed', () => {
      useViewStore.setState({ rightPanelCollapsed: true });
      const { container } = render(<RightPanel />);

      const aside = container.querySelector('aside');
      expect(aside).toHaveStyle({ width: '48px' });
    });
  });

  describe('expanded state', () => {
    it('renders expanded panel with collapse button', () => {
      render(<RightPanel />);

      const collapseButton = screen.getByRole('button', { name: 'Collapse right panel' });
      expect(collapseButton).toBeInTheDocument();
    });

    it('collapses panel when collapse button clicked', () => {
      render(<RightPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Collapse right panel' }));

      expect(useViewStore.getState().rightPanelCollapsed).toBe(true);
    });

    it('has full width when expanded', () => {
      const { container } = render(<RightPanel />);

      const aside = container.querySelector('aside');
      expect(aside).toHaveStyle({ width: '288px' });
    });

    it('displays Inspector header', () => {
      render(<RightPanel />);

      expect(screen.getByText('Inspector')).toBeInTheDocument();
    });
  });

  describe('inspector section', () => {
    it('shows EmptyState when no selection', () => {
      mockUseBinInspector.mockReturnValue(
        createMockInspector({
          bin: null,
          isMultiSelect: false,
        })
      );

      render(<RightPanel />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getAllByTestId('collapsible-title')[0]).toHaveTextContent('Selection');
    });

    it('shows SingleBinInspector when one bin selected', () => {
      const bin = mockLayout.bins[0];
      mockUseBinInspector.mockReturnValue(
        createMockInspector({
          bin,
          selectedBins: [bin],
          isMultiSelect: false,
        })
      );

      render(<RightPanel />);

      expect(screen.getByTestId('single-bin-inspector')).toBeInTheDocument();
      expect(screen.getAllByTestId('collapsible-title')[0]).toHaveTextContent('Bin Properties');
    });

    it('shows MultiBinInspector when multiple bins selected', () => {
      const bins = [mockLayout.bins[0], { ...mockLayout.bins[0], id: 'bin2' }];
      mockUseBinInspector.mockReturnValue(
        createMockInspector({
          selectedBins: bins,
          isMultiSelect: true,
        })
      );

      render(<RightPanel />);

      expect(screen.getByTestId('multi-bin-inspector')).toBeInTheDocument();
      expect(screen.getAllByTestId('collapsible-title')[0]).toHaveTextContent('Multi-selection');
    });

    it('calls clearSelection when single inspector close clicked', () => {
      const bin = mockLayout.bins[0];
      const mockClearSelection = vi.fn();
      mockUseBinInspector.mockReturnValue(
        createMockInspector({
          bin,
          selectedBins: [bin],
          isMultiSelect: false,
          clearSelection: mockClearSelection,
        })
      );

      render(<RightPanel />);

      fireEvent.click(screen.getByText('Close Single'));

      expect(mockClearSelection).toHaveBeenCalled();
    });

    it('calls clearSelection when multi inspector close clicked', () => {
      const bins = [mockLayout.bins[0], { ...mockLayout.bins[0], id: 'bin2' }];
      const mockClearSelection = vi.fn();
      mockUseBinInspector.mockReturnValue(
        createMockInspector({
          selectedBins: bins,
          isMultiSelect: true,
          clearSelection: mockClearSelection,
        })
      );

      render(<RightPanel />);

      fireEvent.click(screen.getByText('Close Multi'));

      expect(mockClearSelection).toHaveBeenCalled();
    });
  });

  describe('print list section - empty', () => {
    it('shows PrintListEmpty when no rows', () => {
      render(<RightPanel />);

      expect(screen.getByTestId('print-list-empty')).toBeInTheDocument();
    });

    it('hides bin count badge when empty', () => {
      render(<RightPanel />);

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('hides copy button when empty', () => {
      render(<RightPanel />);

      expect(screen.queryByLabelText('Copy bin list as TSV')).not.toBeInTheDocument();
    });
  });

  describe('print list section - with data', () => {
    const printRow = {
      size: '2×2',
      height: 3,
      binCount: 2,
      binIds: ['bin1', 'bin2'],
      labels: ['Screws'],
      notes: 'M3',
      needsSplit: false,
      pieces: [],
      totalPieces: 2,
      filament: 1.5,
      categoryIds: ['coral'],
    };

    beforeEach(() => {
      mockPrintListReturn = createMockPrintList({
        rows: [printRow],
        totalBins: 2,
        totalPieces: 2,
        totalFilament: 1.5,
      });
    });

    it('displays bin count badge', () => {
      render(<RightPanel />);

      const badge = screen.getByText('2', { selector: '.badge' });
      expect(badge).toBeInTheDocument();
    });

    it('displays print list table', () => {
      render(<RightPanel />);

      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('H')).toBeInTheDocument();
      expect(screen.getByText('Qty')).toBeInTheDocument();
    });

    it('displays row data', () => {
      render(<RightPanel />);

      expect(screen.getByText('2×2')).toBeInTheDocument();
      expect(screen.getByText('3u')).toBeInTheDocument();
    });

    it('displays label if present', () => {
      render(<RightPanel />);

      expect(screen.getByText('Screws')).toBeInTheDocument();
    });

    it('displays notes icon if notes present', () => {
      render(<RightPanel />);

      // Notes icon has title attribute
      expect(screen.getByTitle('M3')).toBeInTheDocument();
    });

    it('shows PrintListSummary', () => {
      render(<RightPanel />);

      expect(screen.getByTestId('print-list-summary')).toBeInTheDocument();
    });

    it('renders the nozzle size input when rows exist', () => {
      render(<RightPanel />);

      expect(screen.getByLabelText('Nozzle size')).toBeInTheDocument();
    });

    it('updates the shared nozzle setting when the input changes', () => {
      render(<RightPanel />);

      const input = screen.getByLabelText('Nozzle size');
      // DeferredNumberInput commits on blur; change to a value distinct from the
      // 0.4mm default so the commit isn't skipped as a no-op.
      fireEvent.change(input, { target: { value: '0.6' } });
      fireEvent.blur(input);

      expect(useSettingsStore.getState().settings.printSettings.nozzleSizeMm).toBe(0.6);
    });

    it('selects bins when row clicked', () => {
      render(<RightPanel />);

      fireEvent.click(screen.getByText('2×2'));

      expect(mockSelectBinsByRow).toHaveBeenCalledWith(printRow);
    });
  });

  describe('print list - copy functionality', () => {
    beforeEach(() => {
      mockPrintListReturn = createMockPrintList({
        rows: [
          {
            size: '2×2',
            height: 3,
            binCount: 1,
            binIds: ['bin1'],
            labels: [],
            notes: '',
            needsSplit: false,
            pieces: [],
            totalPieces: 1,
            filament: 0.8,
            categoryIds: ['coral'],
          },
        ],
        totalBins: 1,
      });
    });

    it('shows copy button when rows exist', () => {
      render(<RightPanel />);

      expect(screen.getByLabelText('Copy bin list as TSV')).toBeInTheDocument();
    });

    it('copies TSV to clipboard when copy clicked', async () => {
      render(<RightPanel />);

      fireEvent.click(screen.getByLabelText('Copy bin list as TSV'));

      expect(mockExportPrintListTSV).toHaveBeenCalled();
      expect(mockWriteText).toHaveBeenCalledWith('Size\tHeight\tQty\n2×2\t3\t1');
    });

    it('shows checkmark feedback after copy', async () => {
      vi.useFakeTimers();
      render(<RightPanel />);

      fireEvent.click(screen.getByLabelText('Copy bin list as TSV'));

      // The checkmark SVG has text-[var(--color-success)] class
      const copyButton = screen.getByLabelText('Copy bin list as TSV');
      const svg = copyButton.querySelector('svg');
      expect(svg).toHaveClass('text-success');

      vi.useRealTimers();
    });
  });

  describe('print list - collapsible', () => {
    beforeEach(() => {
      mockPrintListReturn = createMockPrintList({
        rows: [
          {
            size: '2×2',
            height: 3,
            binCount: 1,
            binIds: ['bin1'],
            labels: [],
            notes: '',
            needsSplit: false,
            pieces: [],
            totalPieces: 1,
            filament: 0.8,
            categoryIds: ['coral'],
          },
        ],
        totalBins: 1,
      });
    });

    it('has aria-expanded attribute on toggle button', () => {
      render(<RightPanel />);

      const toggleButton = screen.getByRole('button', { name: /^bin list/i });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('collapses print list when toggle clicked', () => {
      render(<RightPanel />);

      const toggleButton = screen.getByRole('button', { name: /^bin list/i });
      fireEvent.click(toggleButton);

      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('expands print list when toggle clicked again', () => {
      render(<RightPanel />);

      const toggleButton = screen.getByRole('button', { name: /^bin list/i });
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('print list - splits', () => {
    const splitRow = {
      size: '8×8',
      height: 3,
      binCount: 1,
      binIds: ['bin1'],
      labels: [],
      notes: '',
      needsSplit: true,
      pieces: [{ width: 4, depth: 4, count: 4 }],
      totalPieces: 4,
      filament: 3.2,
      categoryIds: ['coral'],
    };

    beforeEach(() => {
      mockPrintListReturn = createMockPrintList({
        rows: [splitRow],
        totalBins: 1,
        totalPieces: 4,
        hasAnySplits: true,
      });
    });

    it('shows Pcs column when splits exist', () => {
      render(<RightPanel />);

      expect(screen.getByTitle('Pieces after split')).toBeInTheDocument();
    });

    it('shows pieces count for split row', () => {
      render(<RightPanel />);

      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('shows warning icon for split row', () => {
      render(<RightPanel />);

      expect(screen.getByLabelText('Click to see split preview')).toBeInTheDocument();
    });

    it('expands split preview when row clicked', () => {
      render(<RightPanel />);

      fireEvent.click(screen.getByText('8×8'));

      expect(screen.getByTestId('split-preview')).toBeInTheDocument();
      // Text is split across multiple text nodes: "Split into" + "4" + "Pieces"
      expect(
        screen.getByText((content, element) => {
          return element?.textContent === 'Split into4Pieces';
        })
      ).toBeInTheDocument();
    });

    it('collapses split preview when clicked again', () => {
      render(<RightPanel />);

      fireEvent.click(screen.getByText('8×8'));
      expect(screen.getByTestId('split-preview')).toBeInTheDocument();

      fireEvent.click(screen.getByText('8×8'));
      expect(screen.queryByTestId('split-preview')).not.toBeInTheDocument();
    });
  });

  describe('print list - category indicators', () => {
    it('displays category color dot', () => {
      mockPrintListReturn = createMockPrintList({
        rows: [
          {
            size: '2×2',
            height: 3,
            binCount: 1,
            binIds: ['bin1'],
            labels: [],
            notes: '',
            needsSplit: false,
            pieces: [],
            totalPieces: 1,
            filament: 0.8,
            categoryIds: ['coral'],
          },
        ],
        totalBins: 1,
      });

      render(<RightPanel />);

      const categoryDot = screen.getByRole('img', { name: 'Coral' });
      expect(categoryDot).toHaveStyle({ backgroundColor: '#FF6B6B' });
    });

    it('shows +N indicator when more than 3 categories', () => {
      mockPrintListReturn = createMockPrintList({
        rows: [
          {
            size: '2×2',
            height: 3,
            binCount: 4,
            binIds: ['bin1', 'bin2', 'bin3', 'bin4'],
            labels: [],
            notes: '',
            needsSplit: false,
            pieces: [],
            totalPieces: 4,
            filament: 3.2,
            categoryIds: ['coral', 'blue', 'cat3', 'cat4', 'cat5'],
          },
        ],
        totalBins: 4,
      });

      render(<RightPanel />);

      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  describe('delete confirmation', () => {
    it('shows confirm dialog when deleteConfirmState is set', () => {
      mockUseBinInspector.mockReturnValue(
        createMockInspector({
          deleteConfirmState: {
            title: 'Delete Bin',
            message: 'Delete this 2×2 bin?',
          },
        })
      );

      render(<RightPanel />);

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-title')).toHaveTextContent('Delete Bin');
      expect(screen.getByTestId('confirm-message')).toHaveTextContent('Delete this 2×2 bin?');
    });

    it('calls confirmDelete when confirmed', () => {
      const mockConfirmDelete = vi.fn();
      mockUseBinInspector.mockReturnValue(
        createMockInspector({
          deleteConfirmState: {
            title: 'Delete Bin',
            message: 'Delete this 2×2 bin?',
          },
          confirmDelete: mockConfirmDelete,
        })
      );

      render(<RightPanel />);

      fireEvent.click(screen.getByText('Confirm Delete'));

      expect(mockConfirmDelete).toHaveBeenCalled();
    });

    it('calls cancelDelete when cancelled', () => {
      const mockCancelDelete = vi.fn();
      mockUseBinInspector.mockReturnValue(
        createMockInspector({
          deleteConfirmState: {
            title: 'Delete Bin',
            message: 'Delete this 2×2 bin?',
          },
          cancelDelete: mockCancelDelete,
        })
      );

      render(<RightPanel />);

      fireEvent.click(screen.getByText('Cancel Delete'));

      expect(mockCancelDelete).toHaveBeenCalled();
    });

    it('hides confirm dialog when deleteConfirmState is null', () => {
      mockUseBinInspector.mockReturnValue(
        createMockInspector({
          deleteConfirmState: null,
        })
      );

      render(<RightPanel />);

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });
  });

  describe('scroll shadow', () => {
    it('does not show shadow initially', () => {
      const { container } = render(<RightPanel />);

      // Shadow class is on the header wrapper (parent of the tab bar)
      const headerWrapper = container.querySelector('[class*="flex flex-col"][class*="border-b"]');
      expect(headerWrapper).not.toHaveClass('shadow-elevated');
    });

    it('shows shadow when scrolled', () => {
      const { container } = render(<RightPanel />);

      const scrollContainer = container.querySelector('[class*="overflow-y-auto"]');
      if (scrollContainer) {
        Object.defineProperty(scrollContainer, 'scrollTop', { value: 50, writable: true });
        fireEvent.scroll(scrollContainer);
      }

      // Shadow class is on the header wrapper (parent of the tab bar)
      const headerWrapper = container.querySelector('[class*="flex flex-col"][class*="border-b"]');
      expect(headerWrapper?.className).toContain('shadow');
    });
  });

  describe('accessibility', () => {
    it('has data-inspector attribute', () => {
      const { container } = render(<RightPanel />);

      expect(container.querySelector('[data-inspector]')).toBeInTheDocument();
    });

    it('has data-print-list attribute', () => {
      const { container } = render(<RightPanel />);

      expect(container.querySelector('[data-print-list]')).toBeInTheDocument();
    });

    it('collapse button has proper aria-label', () => {
      render(<RightPanel />);

      expect(screen.getByRole('button', { name: 'Collapse right panel' })).toBeInTheDocument();
    });

    it('expand button has proper aria-label when collapsed', () => {
      useViewStore.setState({ rightPanelCollapsed: true });
      render(<RightPanel />);

      expect(screen.getByRole('button', { name: 'Expand right panel' })).toBeInTheDocument();
    });

    it('copy button has proper aria-label', () => {
      mockPrintListReturn = createMockPrintList({
        rows: [
          {
            size: '2×2',
            height: 3,
            binCount: 1,
            binIds: ['bin1'],
            labels: [],
            notes: '',
            needsSplit: false,
            pieces: [],
            totalPieces: 1,
            filament: 0.8,
            categoryIds: ['coral'],
          },
        ],
        totalBins: 1,
      });

      render(<RightPanel />);

      expect(screen.getByRole('button', { name: 'Copy bin list as TSV' })).toBeInTheDocument();
    });
  });
});
