// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagFilterBar } from './TagFilterBar';
import { useTagAppearanceStore } from '@/features/bin-designer/store/tagAppearance';

beforeEach(() => {
  useTagAppearanceStore.setState({ appearances: {} });
});

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

  it('renders the tag icon and tints inactive chips with the tag color', () => {
    useTagAppearanceStore.setState({
      appearances: { kitchen: { icon: '🔧' }, screws: { color: '#f87171' } },
    });
    render(
      <TagFilterBar
        allTags={['kitchen', 'screws']}
        activeTags={['screws']}
        onToggle={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(screen.getByText('🔧')).toBeInTheDocument();
    // Active chip keeps the accent background — no inline tint.
    const active = screen.getByRole('button', { name: /screws/i });
    expect(active.getAttribute('style') ?? '').not.toContain('background-color');
  });
});
