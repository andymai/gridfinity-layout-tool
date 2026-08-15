import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrintLayout } from './PrintLayout';
import { resetAllStores, createTestLayout, createTestBin } from '@/test/testUtils';
import { binId, layerId, categoryId, gridUnits, heightUnits } from '@/core/types';
import type { PrintViewSettings } from '@/core/store/settings';

// Mock child components
vi.mock('../PrintBin', () => ({
  PrintBin: ({
    bin,
  }: {
    bin: { id: string; label: string };
    category: unknown;
    drawer: unknown;
    cellSize: number;
    gap: number;
    settings: PrintViewSettings;
  }) => <div data-testid={`print-bin-${bin.id}`}>{bin.label || 'Unlabeled'}</div>,
}));

// Mock utility functions
vi.mock('@/features/print-export/utils/printLayout', () => ({
  getVisibleBinsForPrint: (bins: unknown[], _layerIds: string[]) => bins,
  getVisibleLayers: (layers: unknown[], layerIds: string[]) =>
    (layers as { id: string; name: string }[]).filter((l) => layerIds.includes(l.id)),
  getUsedCategories: (bins: unknown[], categories: unknown[]) => categories,
  formatDrawerDimensions: (drawer: { width: number; depth: number }, gridUnitMm: number) =>
    `${drawer.width}u × ${drawer.depth}u (${drawer.width * gridUnitMm}mm × ${drawer.depth * gridUnitMm}mm)`,
  formatPrintDate: () => '2024-01-15',
  sortBinsForPrint: (bins: unknown[]) => bins,
}));

vi.mock('@/shared/hooks', () => ({
  useGridTemplate: () => ({
    gridTemplateColumns: 'repeat(10, 1fr)',
    gridTemplateRows: 'repeat(8, 1fr)',
    integerWidth: 10,
    integerDepth: 8,
    hasFractionalWidth: false,
    hasFractionalDepth: false,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    fractionalCellWidth: 0,
    fractionalCellHeight: 0,
    gridRows: 8,
    gridCols: 10,
    getCssColForCell: (x: number) => x + 1,
    getCssRowForCell: (y: number) => 8 - y,
  }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('PrintLayout', () => {
  const defaultSettings: PrintViewSettings = {
    showHeader: true,
    showLayoutName: true,
    showDate: true,
    showDrawerInfo: true,
    showLegend: true,
    showBinList: true,
    showGridCoordinates: true,
    showCategoryColor: true,
    showLabel: true,
    showSize: true,
    showHeight: true,
    showNotes: true,
    showCustomProperties: true,
    orientation: 'portrait',
    fitToPage: true,
    binListSortOrder: [{ field: 'position', enabled: true }],
  };

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing with empty layout', () => {
    const layout = createTestLayout();
    render(
      <PrintLayout
        layout={layout}
        selectedLayerIds={[layerId('layer1')]}
        settings={defaultSettings}
      />
    );

    expect(screen.getByText(/print.noBinsToPrintInSelectedLayerS/)).toBeInTheDocument();
  });

  it('shows empty state when no bins in selected layers', () => {
    const layout = createTestLayout({ bins: [] });

    render(
      <PrintLayout
        layout={layout}
        selectedLayerIds={[layerId('layer1')]}
        settings={defaultSettings}
      />
    );

    expect(screen.getByText(/print.noBinsToPrintInSelectedLayerS/)).toBeInTheDocument();
  });

  it('renders layout name when showLayoutName is true', () => {
    const layout = createTestLayout({
      name: 'My Test Layout',
      bins: [createTestBin({ id: binId('bin-1'), layerId: layerId('layer1') })],
    });

    render(
      <PrintLayout
        layout={layout}
        selectedLayerIds={[layerId('layer1')]}
        settings={defaultSettings}
      />
    );

    expect(screen.getByText('My Test Layout')).toBeInTheDocument();
  });

  it('does not render header when showHeader is false', () => {
    const layout = createTestLayout({
      name: 'My Test Layout',
      bins: [createTestBin({ id: binId('bin-1'), layerId: layerId('layer1') })],
    });

    render(
      <PrintLayout
        layout={layout}
        selectedLayerIds={[layerId('layer1')]}
        settings={{ ...defaultSettings, showHeader: false }}
      />
    );

    expect(screen.queryByText('My Test Layout')).not.toBeInTheDocument();
  });

  it('renders bins in grid', () => {
    const layout = createTestLayout({
      bins: [
        createTestBin({ id: binId('bin-1'), label: 'Bin One', layerId: layerId('layer1') }),
        createTestBin({ id: binId('bin-2'), label: 'Bin Two', layerId: layerId('layer1') }),
      ],
    });

    render(
      <PrintLayout
        layout={layout}
        selectedLayerIds={[layerId('layer1')]}
        settings={defaultSettings}
      />
    );

    expect(screen.getByTestId('print-bin-bin-1')).toBeInTheDocument();
    expect(screen.getByTestId('print-bin-bin-2')).toBeInTheDocument();
  });

  it('shows drawer dimensions when showDrawerInfo is true', () => {
    const layout = createTestLayout({
      drawer: { width: gridUnits(12), depth: gridUnits(10), height: heightUnits(15) },
      bins: [createTestBin({ id: binId('bin-1'), layerId: layerId('layer1') })],
    });

    render(
      <PrintLayout
        layout={layout}
        selectedLayerIds={[layerId('layer1')]}
        settings={defaultSettings}
      />
    );

    expect(screen.getByText(/print.drawer/)).toBeInTheDocument();
  });

  it('shows date when showDate is true', () => {
    const layout = createTestLayout({
      bins: [createTestBin({ id: binId('bin-1'), layerId: layerId('layer1') })],
    });

    render(
      <PrintLayout
        layout={layout}
        selectedLayerIds={[layerId('layer1')]}
        settings={defaultSettings}
      />
    );

    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
  });

  it('shows category legend when showLegend is true', () => {
    const layout = createTestLayout({
      categories: [
        { id: categoryId('cat1'), name: 'Tools', color: '#ff0000' },
        { id: categoryId('cat2'), name: 'Parts', color: '#00ff00' },
      ],
      bins: [
        createTestBin({
          id: binId('bin-1'),
          layerId: layerId('layer1'),
          category: categoryId('cat1'),
        }),
        createTestBin({
          id: binId('bin-2'),
          layerId: layerId('layer1'),
          category: categoryId('cat2'),
        }),
      ],
    });

    render(
      <PrintLayout
        layout={layout}
        selectedLayerIds={[layerId('layer1')]}
        settings={defaultSettings}
      />
    );

    expect(screen.getByText(/common.categories/)).toBeInTheDocument();
    expect(screen.getAllByText('Tools').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Parts').length).toBeGreaterThan(0);
  });

  it('shows bin list when showBinList is true', () => {
    const layout = createTestLayout({
      bins: [createTestBin({ id: binId('bin-1'), label: 'Test Bin', layerId: layerId('layer1') })],
    });

    render(
      <PrintLayout
        layout={layout}
        selectedLayerIds={[layerId('layer1')]}
        settings={defaultSettings}
      />
    );

    expect(screen.getByText(/print.binDetails/)).toBeInTheDocument();
  });

  it('renders grid coordinates when showGridCoordinates is true', () => {
    const layout = createTestLayout({
      bins: [createTestBin({ id: binId('bin-1'), layerId: layerId('layer1') })],
    });

    const { container } = render(
      <PrintLayout
        layout={layout}
        selectedLayerIds={[layerId('layer1')]}
        settings={defaultSettings}
      />
    );

    const colLabels = container.querySelector('.print-col-labels');
    expect(colLabels).toBeInTheDocument();
  });

  it('uses landscape width when orientation is landscape', () => {
    const layout = createTestLayout({
      bins: [createTestBin({ id: binId('bin-1'), layerId: layerId('layer1') })],
    });

    render(
      <PrintLayout
        layout={layout}
        selectedLayerIds={[layerId('layer1')]}
        settings={{ ...defaultSettings, orientation: 'landscape' }}
      />
    );

    // Component should render without errors
    expect(screen.getByTestId('print-bin-bin-1')).toBeInTheDocument();
  });

  it('uses custom availableWidth when provided', () => {
    const layout = createTestLayout({
      bins: [createTestBin({ id: binId('bin-1'), layerId: layerId('layer1') })],
    });

    render(
      <PrintLayout
        layout={layout}
        selectedLayerIds={[layerId('layer1')]}
        settings={defaultSettings}
        availableWidth={800}
      />
    );

    expect(screen.getByTestId('print-bin-bin-1')).toBeInTheDocument();
  });

  it('constrains cell size by page height when fitToPage is enabled', () => {
    // A very deep drawer (40 rows) in portrait mode should produce smaller cells
    // than a shallow drawer, since the grid must fit the page height
    const deepLayout = createTestLayout({
      drawer: { width: gridUnits(5), depth: gridUnits(40), height: heightUnits(12) },
      bins: [createTestBin({ id: binId('bin-1'), layerId: layerId('layer1') })],
    });

    const { container } = render(
      <PrintLayout
        layout={deepLayout}
        selectedLayerIds={[layerId('layer1')]}
        settings={{ ...defaultSettings, fitToPage: true, orientation: 'portrait' }}
      />
    );

    const cell = container.querySelector('.print-grid-cell');
    expect(cell).toBeInTheDocument();
    // With 40 rows in portrait (960px page - overhead), cells should be ~21px
    // Width-only would give ~130px for 5 cols in 670px, so height is the constraint
    const cellHeight = parseInt((cell as HTMLElement).style.height);
    expect(cellHeight).toBeLessThanOrEqual(25);
    expect(cellHeight).toBeGreaterThanOrEqual(20); // MIN_CELL_SIZE
  });

  it('does not constrain by height when fitToPage is disabled', () => {
    const deepLayout = createTestLayout({
      drawer: { width: gridUnits(5), depth: gridUnits(40), height: heightUnits(12) },
      bins: [createTestBin({ id: binId('bin-1'), layerId: layerId('layer1') })],
    });

    const { container } = render(
      <PrintLayout
        layout={deepLayout}
        selectedLayerIds={[layerId('layer1')]}
        settings={{ ...defaultSettings, fitToPage: false, orientation: 'portrait' }}
      />
    );

    const cell = container.querySelector('.print-grid-cell');
    expect(cell).toBeInTheDocument();
    // Without fitToPage, width-only constraint: (670 - 22) / 5 ≈ 120px (capped at MAX)
    const cellHeight = parseInt((cell as HTMLElement).style.height);
    expect(cellHeight).toBeGreaterThan(25); // Much larger than height-constrained
  });

  it('applies proportional height constraint in modal preview when fitToPage is enabled', () => {
    const deepLayout = createTestLayout({
      drawer: { width: gridUnits(5), depth: gridUnits(40), height: heightUnits(12) },
      bins: [createTestBin({ id: binId('bin-1'), layerId: layerId('layer1') })],
    });

    const { container } = render(
      <PrintLayout
        layout={deepLayout}
        selectedLayerIds={[layerId('layer1')]}
        settings={{ ...defaultSettings, fitToPage: true, orientation: 'portrait' }}
        availableWidth={670}
      />
    );

    const cell = container.querySelector('.print-grid-cell');
    expect(cell).toBeInTheDocument();
    // With availableWidth matching default page width, height constraint scales 1:1
    // so the preview should match print output — cells constrained by height
    const cellHeight = parseInt((cell as HTMLElement).style.height);
    expect(cellHeight).toBeLessThanOrEqual(25);
    expect(cellHeight).toBeGreaterThanOrEqual(20); // MIN_CELL_SIZE
  });

  it('renders safely when no layers are selected with fitToPage enabled', () => {
    const layout = createTestLayout({
      drawer: { width: gridUnits(5), depth: gridUnits(5), height: heightUnits(12) },
      bins: [createTestBin({ id: binId('bin-1'), layerId: layerId('layer1') })],
    });

    // Should not throw (no divide-by-zero)
    expect(() =>
      render(
        <PrintLayout
          layout={layout}
          selectedLayerIds={[]}
          settings={{ ...defaultSettings, fitToPage: true, orientation: 'portrait' }}
        />
      )
    ).not.toThrow();

    // Empty state rendered, no bins shown
    expect(screen.queryByTestId('print-bin-bin-1')).not.toBeInTheDocument();
  });
});
