import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { CompartmentGridView } from './CompartmentGridView';
import type { CompartmentGridApi } from './useCompartmentGrid';

vi.mock('./CompartmentEditorParts', () => ({
  GridCell: ({ idx, compartmentId }: { idx: number; compartmentId: number }) => (
    <div data-testid={`cell-${idx}`} data-compartment={compartmentId} />
  ),
  GhostPreview: () => <div data-testid="ghost-preview" />,
}));

vi.mock('./DividerHitTargets', () => ({
  DividerHitTargets: () => <div data-testid="divider-hit-targets" />,
}));

const compartments = { cols: 3, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5] };

function makeGrid(overrides: Partial<CompartmentGridApi> = {}): CompartmentGridApi {
  const api = {
    compartments,
    cols: 3,
    rows: 2,
    cells: compartments.cells,
    thickness: 1.2,
    interiorW: 100,
    interiorD: 60,
    compartmentCount: 6,
    compartmentCellCounts: new Map([
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 1],
    ]),
    hasMergedCompartments: false,
    aspectRatio: 1.5,
    gridDots: [
      { x: 1 / 3, y: 0.5 },
      { x: 2 / 3, y: 0.5 },
    ],
    labeling: {
      labelMode: false,
      canLabel: true,
      editingId: null,
      textOf: () => '',
      displayNumberOf: () => 1,
      setLabelMode: vi.fn(),
      selectCompartment: vi.fn(),
    },
    previewColor: '#888888',
    angledDividersEnabled: false,
    eligibleDividers: [],
    dividerHighlightCompartments: new Set<number>(),
    dividerTiltPreview: null,
    selectedDividerKey: null,
    hoveredDividerKey: null,
    setSelectedDividerKey: vi.fn(),
    setHoveredDividerKey: vi.fn(),
    rowLabelForHitTarget: () => 'divider',
    selection: new Set<number>(),
    isDragging: false,
    hoverIdx: null,
    setHoverIdx: vi.fn(),
    selectionAction: 'none' as const,
    hoveredIsSplittable: false,
    instructionText: 'drag or click',
    gridRef: createRef<HTMLDivElement>(),
    handleCellPointerDown: vi.fn(),
    handleCellPointerEnter: vi.fn(),
    handleCellPointerLeave: vi.fn(),
    handlePointerUp: vi.fn(),
    applyGrid: vi.fn(),
    stepGrid: vi.fn(),
    handleThicknessChange: vi.fn(),
    handleReset: vi.fn(),
    ...overrides,
  };
  return api as unknown as CompartmentGridApi;
}

describe('CompartmentGridView', () => {
  it('renders one cell per grid position', () => {
    render(<CompartmentGridView grid={makeGrid()} />);

    for (let idx = 0; idx < 6; idx++) {
      expect(screen.getByTestId(`cell-${idx}`)).toBeInTheDocument();
    }
  });

  it('exposes the grid shape to assistive tech', () => {
    render(<CompartmentGridView grid={makeGrid()} describedById="instructions" />);

    const region = screen.getByRole('application');
    expect(region).toHaveAttribute('aria-label', 'Compartment grid, 3 columns by 2 rows');
    expect(region).toHaveAttribute('aria-describedby', 'instructions');
  });

  it('takes its sizing from the caller but keeps the true aspect ratio', () => {
    render(
      <CompartmentGridView grid={makeGrid()} style={{ maxWidth: '360px' }} className="mr-auto" />
    );

    const region = screen.getByRole('application');
    expect(region).toHaveStyle({ aspectRatio: '1.5', maxWidth: '360px' });
    expect(region.className).toContain('mr-auto');
  });

  it('draws an intersection dot per internal crossing', () => {
    const { container } = render(<CompartmentGridView grid={makeGrid()} />);

    expect(container.querySelectorAll('.rounded-full')).toHaveLength(2);
  });

  it('shows the drag ghost only while dragging a multi-cell selection', () => {
    const { rerender } = render(<CompartmentGridView grid={makeGrid()} />);
    expect(screen.queryByTestId('ghost-preview')).not.toBeInTheDocument();

    rerender(
      <CompartmentGridView
        grid={makeGrid({ isDragging: true, selection: new Set([0, 1]), selectionAction: 'merge' })}
      />
    );
    expect(screen.getByTestId('ghost-preview')).toBeInTheDocument();
  });

  it('hides divider hit targets during a cell drag even when enabled', () => {
    const dividers = [{ compartmentA: 0, compartmentB: 1 }] as never;

    const { rerender } = render(
      <CompartmentGridView
        grid={makeGrid({ angledDividersEnabled: true, eligibleDividers: dividers })}
      />
    );
    expect(screen.getByTestId('divider-hit-targets')).toBeInTheDocument();

    rerender(
      <CompartmentGridView
        grid={makeGrid({
          angledDividersEnabled: true,
          eligibleDividers: dividers,
          isDragging: true,
          selection: new Set([0]),
        })}
      />
    );
    expect(screen.queryByTestId('divider-hit-targets')).not.toBeInTheDocument();
  });

  it('keeps divider handles hidden without dragging when the opt-in is off', () => {
    const dividers = [{ compartmentA: 0, compartmentB: 1 }] as never;

    render(
      <CompartmentGridView
        grid={makeGrid({ angledDividersEnabled: false, eligibleDividers: dividers })}
      />
    );

    expect(screen.queryByTestId('divider-hit-targets')).not.toBeInTheDocument();
  });

  it('ends the drag and clears hover when the pointer leaves the grid', () => {
    const handlePointerUp = vi.fn();
    const setHoverIdx = vi.fn();
    render(<CompartmentGridView grid={makeGrid({ handlePointerUp, setHoverIdx })} />);

    fireEvent.pointerLeave(screen.getByRole('application'));

    expect(handlePointerUp).toHaveBeenCalledTimes(1);
    expect(setHoverIdx).toHaveBeenCalledWith(null);
  });
});
