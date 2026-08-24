import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { findAssemblyPart } from '@/features/bin-designer/utils/assemblyTree';
import { WorkshopSelectionToolbar } from './WorkshopSelectionToolbar';

function seedThree(): [string, string, string] {
  const store = useDesignerStore.getState();
  const a = store.addAssemblyPart('post', null, { x: 10, y: 10 });
  const b = store.addAssemblyPart('post', null, { x: 30, y: 20 });
  const c = store.addAssemblyPart('post', null, { x: 100, y: 40 });
  if (!a || !b || !c) throw new Error('unreachable');
  return [a, b, c];
}

describe('WorkshopSelectionToolbar', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().newDesign('assembly');
  });

  it('renders nothing for an empty or single selection', () => {
    const [a] = seedThree();
    useDesignerStore.getState().setSelectedAssemblyPartId(a);
    const { container } = render(<WorkshopSelectionToolbar />);
    expect(container.querySelector('[data-testid="workshop-selection-toolbar"]')).toBeNull();
  });

  it('shows the selection count and clears it', () => {
    const [a, b] = seedThree();
    useDesignerStore.getState().setSelectedAssemblyPartIds([a, b], a);
    render(<WorkshopSelectionToolbar />);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Clear selection'));
    expect(useDesignerStore.getState().ui.selectedAssemblyPartIds).toEqual([]);
  });

  it('aligns the selection to the anchor', () => {
    const [a, b] = seedThree();
    useDesignerStore.getState().setSelectedAssemblyPartIds([a, b], a);
    render(<WorkshopSelectionToolbar />);
    fireEvent.click(screen.getByTitle('Align Y'));
    const structure = useDesignerStore.getState().structure;
    if (structure?.kind !== 'assembly') throw new Error('unreachable');
    expect(findAssemblyPart(structure.parts, b)?.transform.y).toBe(10);
  });

  it('disables distribute below three parts and spaces three evenly', () => {
    const [a, b, c] = seedThree();
    useDesignerStore.getState().setSelectedAssemblyPartIds([a, b], a);
    const { rerender } = render(<WorkshopSelectionToolbar />);
    expect(screen.getByTitle('Distribute X')).toBeDisabled();
    useDesignerStore.getState().setSelectedAssemblyPartIds([a, b, c], a);
    rerender(<WorkshopSelectionToolbar />);
    fireEvent.click(screen.getByTitle('Distribute X'));
    const structure = useDesignerStore.getState().structure;
    if (structure?.kind !== 'assembly') throw new Error('unreachable');
    expect(findAssemblyPart(structure.parts, b)?.transform.x).toBe(55);
  });

  it('duplicates the selection and re-targets it to the clones', () => {
    const [a, b] = seedThree();
    useDesignerStore.getState().setSelectedAssemblyPartIds([a, b], a);
    render(<WorkshopSelectionToolbar />);
    fireEvent.click(screen.getByTitle('Duplicate'));
    const selection = useDesignerStore.getState().ui.selectedAssemblyPartIds;
    expect(selection).toHaveLength(2);
    expect(selection).not.toContain(a);
  });

  it('deletes the selection', () => {
    const [a, b, c] = seedThree();
    useDesignerStore.getState().setSelectedAssemblyPartIds([a, b], a);
    render(<WorkshopSelectionToolbar />);
    fireEvent.click(screen.getByTitle('Delete'));
    const structure = useDesignerStore.getState().structure;
    if (structure?.kind !== 'assembly') throw new Error('unreachable');
    expect(structure.parts.map((n) => n.id)).toEqual([c]);
  });

  it('copies the selection into the clipboard mirror', () => {
    const [a, b] = seedThree();
    useDesignerStore.getState().setSelectedAssemblyPartIds([a, b], a);
    render(<WorkshopSelectionToolbar />);
    fireEvent.click(screen.getByTitle('Copy'));
    expect(useDesignerStore.getState().ui.workshopClipboardCount).toBe(2);
  });
});
