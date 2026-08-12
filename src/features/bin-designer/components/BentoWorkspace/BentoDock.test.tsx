import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoDock, type BentoDockProps } from './BentoDock';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { getDrawnCompartmentIds } from '@/features/bin-designer/utils/bentoDraw';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function setupStoreWithDrawn(): { id: number } {
  useDesignerStore.getState().setCompartmentGrid(4, 3);
  const id = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
  if (id === null) throw new Error('unreachable');
  return { id };
}

function makeProps(overrides: Partial<BentoDockProps> = {}): BentoDockProps {
  const config = useDesignerStore.getState().params.compartments;
  return {
    config,
    drawnIds: getDrawnCompartmentIds(config),
    interiorW: 80,
    interiorD: 60,
    selectedId: null,
    onSelect: vi.fn(),
    labelFocusToken: 0,
    onCommitLabel: vi.fn(),
    onDuplicate: vi.fn(),
    onStash: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

describe('BentoDock', () => {
  beforeEach(() => {
    localStorage.clear();
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('shows the empty hint when nothing is drawn', () => {
    useDesignerStore.getState().setCompartmentGrid(4, 3);
    render(<BentoDock {...makeProps()} />);

    expect(screen.getByText('binDesigner.bento.dockEmptyHint')).toBeInTheDocument();
  });

  it('lists drawn compartments and selects on click', () => {
    const { id } = setupStoreWithDrawn();
    const onSelect = vi.fn();
    render(<BentoDock {...makeProps({ onSelect })} />);

    fireEvent.click(screen.getByTestId(`bento-dock-row-${id}`));

    expect(onSelect).toHaveBeenCalledWith(id);
  });

  it('clicking the selected row toggles the selection off', () => {
    const { id } = setupStoreWithDrawn();
    const onSelect = vi.fn();
    render(<BentoDock {...makeProps({ selectedId: id, onSelect })} />);

    fireEvent.click(screen.getByTestId(`bento-dock-row-${id}`));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('shows the inspector with label input for the selection and commits edits', () => {
    const { id } = setupStoreWithDrawn();
    const onCommitLabel = vi.fn();
    render(<BentoDock {...makeProps({ selectedId: id, onCommitLabel })} />);

    const input = screen.getByRole('textbox', { name: 'binDesigner.bento.labelField' });
    fireEvent.change(input, { target: { value: 'bolts' } });
    fireEvent.blur(input);

    expect(onCommitLabel).toHaveBeenCalledWith(id, 'bolts');
  });

  it('routes duplicate/stash/delete for the selection', () => {
    const { id } = setupStoreWithDrawn();
    const onDuplicate = vi.fn();
    const onStash = vi.fn();
    const onDelete = vi.fn();
    render(<BentoDock {...makeProps({ selectedId: id, onDuplicate, onStash, onDelete })} />);

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.bento.duplicate' }));
    fireEvent.click(screen.getByText('binDesigner.bento.stashAction'));
    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.bento.delete' }));

    expect(onDuplicate).toHaveBeenCalledWith(id);
    expect(onStash).toHaveBeenCalledWith(id);
    expect(onDelete).toHaveBeenCalledWith(id);
  });

  it('lists wall steppers only between two drawn compartments', () => {
    const { id } = setupStoreWithDrawn();
    const neighborId = useDesignerStore
      .getState()
      .drawBentoCompartment({ col: 2, row: 0, w: 1, h: 2 });
    expect(neighborId).not.toBeNull();
    render(<BentoDock {...makeProps({ selectedId: neighborId })} />);

    expect(screen.getByText('binDesigner.bento.wallsTitle')).toBeInTheDocument();
    // Exactly one wall row — the drawn-to-drawn wall to the 2×2 block; the
    // walls against background pockets don't get rows.
    expect(screen.getAllByText(/binDesigner\.bento\.wallWith/)).toHaveLength(1);
    expect(screen.queryByText('binDesigner.bento.wallsEmptyHint')).not.toBeInTheDocument();
    expect(id).toBeGreaterThanOrEqual(0);
  });

  it('shows the walls hint when the selection only borders background pockets', () => {
    const { id } = setupStoreWithDrawn();
    render(<BentoDock {...makeProps({ selectedId: id })} />);

    expect(screen.getByText('binDesigner.bento.wallsEmptyHint')).toBeInTheDocument();
    expect(screen.queryByLabelText('binDesigner.bento.wallShift')).not.toBeInTheDocument();
  });

  it('collapses to a rail and persists the choice', () => {
    setupStoreWithDrawn();
    render(<BentoDock {...makeProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.bento.dockCollapse' }));

    expect(
      screen.getByRole('button', { name: 'binDesigner.bento.dockExpand' })
    ).toBeInTheDocument();
    expect(localStorage.getItem('gridfinity-bento-dock-collapsed')).toBe('1');
  });
});
