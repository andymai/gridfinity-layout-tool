import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { WorkshopHoverTip } from './WorkshopHoverTip';

describe('WorkshopHoverTip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().newDesign('assembly');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing without a target', () => {
    const { container } = render(<WorkshopHoverTip target={null} />);
    expect(container.querySelector('[data-testid="workshop-hover-tip"]')).toBeNull();
  });

  it('appears only after the hover delay', () => {
    const id = useDesignerStore.getState().addAssemblyPart('post', null);
    if (!id) throw new Error('unreachable');
    render(<WorkshopHoverTip target={{ partId: id, x: 40, y: 60 }} />);
    expect(screen.queryByTestId('workshop-hover-tip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByTestId('workshop-hover-tip')).toBeInTheDocument();
    expect(screen.getByText('Post')).toBeInTheDocument();
  });

  it('names the parent a stacked part sits on', () => {
    const blockId = useDesignerStore.getState().addAssemblyPart('block', null);
    const postId = useDesignerStore.getState().addAssemblyPart('post', blockId);
    if (!postId) throw new Error('unreachable');
    render(<WorkshopHoverTip target={{ partId: postId, x: 0, y: 0 }} />);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByText('on Block')).toBeInTheDocument();
  });

  it('vanishes for a part that no longer exists', () => {
    const id = useDesignerStore.getState().addAssemblyPart('post', null);
    if (!id) throw new Error('unreachable');
    useDesignerStore.getState().removeAssemblyPart(id);
    render(<WorkshopHoverTip target={{ partId: id, x: 0, y: 0 }} />);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.queryByTestId('workshop-hover-tip')).toBeNull();
  });
});
