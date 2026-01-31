import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { RowLabels, ColumnLabels } from './GridAxisLabels';
import type { GridAxisLabelsState } from '@/features/grid-editor/hooks/useGridAxisLabels';

// Mock view store
vi.mock('@/core/store/view', () => {
  const mockStoreState = {
    setHighlightedRowLabel: vi.fn(),
    setHighlightedColLabel: vi.fn(),
    zoom: 1,
    showOtherLayers: true,
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    contextMenu: null,
    highlightedCategoryId: null,
    highlightedRowLabel: null,
    highlightedColLabel: null,
    printModalOpen: false,
  };

  return {
    useViewStore: Object.assign(
      vi.fn((selector) => {
        return selector ? selector(mockStoreState) : mockStoreState;
      }),
      {
        getState: () => mockStoreState,
        setState: vi.fn(),
        subscribe: vi.fn(),
      }
    ),
  };
});

describe('RowLabels', () => {
  const mockOnRowClick = vi.fn();
  const mockLabels: GridAxisLabelsState = {
    rowLabels: [1, 2, 3, 4, 5, 6, 7, 8],
    columnLabels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    labelWidth: 32,
    labelFontSize: 12,
    columnLabelHeight: 24,
    integerWidth: 10,
    integerDepth: 8,
    hasFractionalWidth: false,
    hasFractionalDepth: false,
    fractionalEdgeX: 'end' as const,
    fractionalEdgeY: 'end' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <RowLabels
        labels={mockLabels}
        fullRowSize={32}
        fractionalRowSize={16}
        gap={2}
        onRowClick={mockOnRowClick}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders correct number of row labels', () => {
    const { container } = render(
      <RowLabels
        labels={mockLabels}
        fullRowSize={32}
        fractionalRowSize={16}
        gap={2}
        onRowClick={mockOnRowClick}
      />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(8);
  });

  it('calls onRowClick when row label is clicked', () => {
    const { container } = render(
      <RowLabels
        labels={mockLabels}
        fullRowSize={32}
        fractionalRowSize={16}
        gap={2}
        onRowClick={mockOnRowClick}
      />
    );
    const firstButton = container.querySelector('button');
    fireEvent.click(firstButton!);
    expect(mockOnRowClick).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it('renders fractional row labels', () => {
    const fractionalLabels: GridAxisLabelsState = {
      ...mockLabels,
      rowLabels: [0.5, 1, 2, 3, 4, 5, 6, 7, 8],
      hasFractionalDepth: true,
      fractionalEdgeY: 'start' as const,
    };
    const { container } = render(
      <RowLabels
        labels={fractionalLabels}
        fullRowSize={32}
        fractionalRowSize={16}
        gap={2}
        onRowClick={mockOnRowClick}
      />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(9);
  });

  it('renders with fractionalEdgeY at end', () => {
    const fractionalLabels: GridAxisLabelsState = {
      ...mockLabels,
      rowLabels: [1, 2, 3, 4, 5, 6, 7, 8, 8.5],
      hasFractionalDepth: true,
      fractionalEdgeY: 'end' as const,
    };
    const { container } = render(
      <RowLabels
        labels={fractionalLabels}
        fullRowSize={32}
        fractionalRowSize={16}
        gap={2}
        onRowClick={mockOnRowClick}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe('ColumnLabels', () => {
  const mockOnColumnClick = vi.fn();
  const mockLabels: GridAxisLabelsState = {
    rowLabels: [1, 2, 3, 4, 5, 6, 7, 8],
    columnLabels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    labelWidth: 32,
    labelFontSize: 12,
    columnLabelHeight: 24,
    integerWidth: 10,
    integerDepth: 8,
    hasFractionalWidth: false,
    hasFractionalDepth: false,
    fractionalEdgeX: 'end' as const,
    fractionalEdgeY: 'end' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <ColumnLabels
        labels={mockLabels}
        fullColSize={32}
        fractionalColSize={16}
        gap={2}
        gridTop={320}
        onColumnClick={mockOnColumnClick}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders correct number of column labels', () => {
    const { container } = render(
      <ColumnLabels
        labels={mockLabels}
        fullColSize={32}
        fractionalColSize={16}
        gap={2}
        gridTop={320}
        onColumnClick={mockOnColumnClick}
      />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(10);
  });

  it('calls onColumnClick when column label is clicked', () => {
    const { container } = render(
      <ColumnLabels
        labels={mockLabels}
        fullColSize={32}
        fractionalColSize={16}
        gap={2}
        gridTop={320}
        onColumnClick={mockOnColumnClick}
      />
    );
    const firstButton = container.querySelector('button');
    fireEvent.click(firstButton!);
    expect(mockOnColumnClick).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it('renders fractional column labels', () => {
    const fractionalLabels: GridAxisLabelsState = {
      ...mockLabels,
      columnLabels: [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      hasFractionalWidth: true,
      fractionalEdgeX: 'start' as const,
    };
    const { container } = render(
      <ColumnLabels
        labels={fractionalLabels}
        fullColSize={32}
        fractionalColSize={16}
        gap={2}
        gridTop={320}
        onColumnClick={mockOnColumnClick}
      />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(11);
  });

  it('renders with fractionalEdgeX at end', () => {
    const fractionalLabels: GridAxisLabelsState = {
      ...mockLabels,
      columnLabels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10.5],
      hasFractionalWidth: true,
      fractionalEdgeX: 'end' as const,
    };
    const { container } = render(
      <ColumnLabels
        labels={fractionalLabels}
        fullColSize={32}
        fractionalColSize={16}
        gap={2}
        gridTop={320}
        onColumnClick={mockOnColumnClick}
      />
    );
    expect(container).toBeTruthy();
  });
});
