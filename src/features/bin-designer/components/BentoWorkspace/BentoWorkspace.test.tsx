import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoWorkspace } from './BentoWorkspace';
import { useDesignerStore } from '@/features/bin-designer/store/designer';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const mocks = vi.hoisted(() => ({
  quickstartSeen: true,
  markQuickstartSeen: vi.fn(),
}));

vi.mock('@/features/bin-designer/hooks/useBentoQuickstart', () => ({
  useBentoQuickstart: () => ({
    quickstartSeen: mocks.quickstartSeen,
    markQuickstartSeen: mocks.markQuickstartSeen,
  }),
}));

vi.mock('../CutoutWorkspace/Rulers', () => ({
  TopRuler: ({ length }: { length: number }) => (
    <div data-testid="top-ruler" data-length={length} />
  ),
  LeftRuler: ({ length }: { length: number }) => (
    <div data-testid="left-ruler" data-length={length} />
  ),
  RulerCorner: () => <div data-testid="ruler-corner" />,
}));

const drawViaStore = (): number => {
  const id = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
  if (id === null) throw new Error('unreachable');
  return id;
};

describe('BentoWorkspace', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.quickstartSeen = true;
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().setBentoWorkspaceOpen(true);
    useDesignerStore.getState().setCompartmentGrid(4, 3);
  });

  it('composes header, canvas, rulers, stash shelf, dock and footer', () => {
    render(<BentoWorkspace />);

    expect(screen.getByTestId('bento-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('top-ruler')).toBeInTheDocument();
    expect(screen.getByTestId('left-ruler')).toBeInTheDocument();
    expect(screen.getByTestId('bento-stash-shelf')).toBeInTheDocument();
    expect(screen.getByTestId('bento-dock')).toBeInTheDocument();
    expect(screen.getByText(/binDesigner\.bento\.backgroundNote/)).toBeInTheDocument();
  });

  it('shows the grid picker instead of a drag hint on a pristine 1×1 grid', () => {
    useDesignerStore.getState().setCompartmentGrid(1, 1);
    render(<BentoWorkspace />);

    expect(screen.getByTestId('bento-grid-setup')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.bento.emptyStateHint')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('4×4'));
    expect(useDesignerStore.getState().params.compartments.cols).toBe(4);
  });

  it('does not steal focus into the label input when a compartment is selected', () => {
    const id = drawViaStore();
    useDesignerStore.getState().setSelectedBentoCompartmentId(id);
    render(<BentoWorkspace />);

    const input = screen.getByRole('textbox', { name: 'binDesigner.bento.labelField' });
    expect(document.activeElement).not.toBe(input);
  });

  it('renders background cells as pockets', () => {
    drawViaStore();
    render(<BentoWorkspace />);

    // 4×3 grid minus the 2×2 drawn block = 8 background pockets.
    expect(screen.getAllByTestId('bento-pocket')).toHaveLength(8);
  });

  it('shows the empty-state hint until something is drawn or stashed', () => {
    const { rerender } = render(<BentoWorkspace />);
    expect(screen.getByText('binDesigner.bento.emptyStateHint')).toBeInTheDocument();

    drawViaStore();
    rerender(<BentoWorkspace />);
    expect(screen.queryByText('binDesigner.bento.emptyStateHint')).not.toBeInTheDocument();
  });

  it('renders drawn compartments from the store', () => {
    const id = drawViaStore();
    render(<BentoWorkspace />);

    expect(screen.getByTestId(`bento-compartment-${id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`bento-dock-row-${id}`)).toBeInTheDocument();
  });

  it('closes from Done', () => {
    render(<BentoWorkspace />);

    fireEvent.click(screen.getByText('common.done'));

    expect(useDesignerStore.getState().ui.bentoWorkspaceOpen).toBe(false);
  });

  it('Escape clears the selection before closing the workspace', () => {
    const id = drawViaStore();
    useDesignerStore.getState().setSelectedBentoCompartmentId(id);
    render(<BentoWorkspace />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useDesignerStore.getState().ui.selectedBentoCompartmentId).toBeNull();
    expect(useDesignerStore.getState().ui.bentoWorkspaceOpen).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useDesignerStore.getState().ui.bentoWorkspaceOpen).toBe(false);
  });

  it('Delete removes the selected compartment', () => {
    const id = drawViaStore();
    useDesignerStore.getState().setSelectedBentoCompartmentId(id);
    render(<BentoWorkspace />);

    fireEvent.keyDown(window, { key: 'Delete' });

    const { compartments } = useDesignerStore.getState().params;
    expect(new Set(compartments.cells).size).toBe(12);
    expect(compartments.drawnUnitCells).toBeUndefined();
  });

  it('arrow keys nudge the selected compartment and keep it selected', () => {
    const id = drawViaStore();
    useDesignerStore.getState().setSelectedBentoCompartmentId(id);
    render(<BentoWorkspace />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    const state = useDesignerStore.getState();
    const selected = state.ui.selectedBentoCompartmentId;
    expect(selected).not.toBeNull();
    if (selected === null) throw new Error('unreachable');
    // The 2×2 block moved off column 0: its cells no longer include index 0.
    expect(state.params.compartments.cells[0]).not.toBe(selected);
  });

  it('deleting a stash entry goes through the store', () => {
    const id = drawViaStore();
    useDesignerStore.getState().stashBentoCompartment(id);
    render(<BentoWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.bento.stashRemove' }));

    expect(useDesignerStore.getState().params.compartments.stash).toBeUndefined();
  });

  it('shows the quickstart card only until dismissed, and lets it eat the first Escape', () => {
    mocks.quickstartSeen = false;
    render(<BentoWorkspace />);

    expect(screen.getByText('binDesigner.bento.quickstart.draw')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useDesignerStore.getState().ui.bentoWorkspaceOpen).toBe(true);
  });

  it('rounds a decimal typed into a grid stepper rather than sizing a cell array by it', () => {
    render(<BentoWorkspace />);

    const cols = screen.getByRole('spinbutton', { name: /columns/i });
    fireEvent.change(cols, { target: { value: '2.5' } });
    fireEvent.blur(cols);

    const { compartments } = useDesignerStore.getState().params;
    expect(compartments.cols).toBe(3);
    expect(compartments.cells).toHaveLength(3 * compartments.rows);
  });

  it('grid steppers preserve drawn compartments and stash the displaced', () => {
    const id = drawViaStore();
    useDesignerStore.getState().drawBentoCompartment({ col: 3, row: 0, w: 1, h: 2 });
    render(<BentoWorkspace />);

    const [colsDecrease] = screen.getAllByRole('button', { name: /decrease/i });
    fireEvent.click(colsDecrease);
    fireEvent.click(colsDecrease);

    const { compartments } = useDesignerStore.getState().params;
    expect(compartments.cols).toBe(2);
    expect(compartments.stash).toHaveLength(1);
    expect(useDesignerStore.getState().params.compartments.cells[0]).toBe(
      useDesignerStore.getState().params.compartments.cells[1]
    );
    expect(id).toBeGreaterThanOrEqual(0);
  });
});
