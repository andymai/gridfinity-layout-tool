// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagFilterBar } from './TagFilterBar';

describe('TagFilterBar', () => {
  it('renders nothing when there are no tags', () => {
    const { container } = render(
      <TagFilterBar allTags={[]} activeTags={[]} onToggle={vi.fn()} onClear={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('marks active chips with aria-pressed and toggles on click', () => {
    const onToggle = vi.fn();
    render(
      <TagFilterBar
        allTags={['kitchen', 'screws']}
        activeTags={['kitchen']}
        onToggle={onToggle}
        onClear={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'kitchen' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'screws' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'screws' }));
    expect(onToggle).toHaveBeenCalledWith('screws');
  });

  it('shows clear only when a filter is active', () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <TagFilterBar allTags={['a']} activeTags={[]} onToggle={vi.fn()} onClear={onClear} />
    );
    expect(screen.queryByText(/clear/i)).not.toBeInTheDocument();
    rerender(
      <TagFilterBar allTags={['a']} activeTags={['a']} onToggle={vi.fn()} onClear={onClear} />
    );
    fireEvent.click(screen.getByText(/clear/i));
    expect(onClear).toHaveBeenCalled();
  });
});
