import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { WorkshopPanel } from './WorkshopPanel';

describe('WorkshopPanel', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().newDesign('assembly');
  });

  it('renders nothing for a bin design', () => {
    useDesignerStore.getState().newDesign('bin');
    const { container } = render(<WorkshopPanel />);
    expect(container.querySelector('[data-testid="workshop-panel"]')).toBeNull();
  });

  it('arms a palette part type on click and disarms on second click', () => {
    render(<WorkshopPanel />);
    const post = screen.getByRole('button', { name: 'Post' });
    fireEvent.click(post);
    expect(useDesignerStore.getState().ui.workshopPendingPartType).toBe('post');
    fireEvent.click(post);
    expect(useDesignerStore.getState().ui.workshopPendingPartType).toBeNull();
  });

  it('lists placed parts and selects one from the tree', () => {
    const blockId = useDesignerStore.getState().addAssemblyPart('block', null);
    const postId = useDesignerStore.getState().addAssemblyPart('post', blockId);
    useDesignerStore.getState().setSelectedAssemblyPartId(null);
    render(<WorkshopPanel />);
    // Tree rows carry a dims suffix ("Post ⌀8×40"); the palette stays bare.
    const postButtons = screen.getAllByRole('button', { name: /^Post/ });
    expect(postButtons).toHaveLength(2);
    const treeRow = postButtons.find((b) => /⌀/.test(b.textContent ?? ''));
    if (!treeRow) throw new Error('unreachable');
    fireEvent.click(treeRow);
    expect(useDesignerStore.getState().ui.selectedAssemblyPartId).toBe(postId);
  });

  it('badges a part with printability warnings', () => {
    const id = useDesignerStore.getState().addAssemblyPart('post', null, { x: 84, y: 42 });
    if (!id) throw new Error('unreachable');
    useDesignerStore.getState().moveAssemblyPart(id, { seatZ: 15 });
    render(<WorkshopPanel />);
    expect(screen.getByText('Floats above its seat')).toBeInTheDocument();
  });

  it('shows the inspector for the selected part', () => {
    useDesignerStore.getState().addAssemblyPart('fin', null);
    render(<WorkshopPanel />);
    expect(screen.getByText('Lean angle')).toBeInTheDocument();
  });
});
