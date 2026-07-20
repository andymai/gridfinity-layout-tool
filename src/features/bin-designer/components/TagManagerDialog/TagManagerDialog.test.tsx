// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagManagerDialog } from './TagManagerDialog';
import { useTagAppearanceStore } from '../../store/tagAppearance';

beforeEach(() => {
  localStorage.clear();
  useTagAppearanceStore.setState({ appearances: {} });
});

function setup(tags: readonly string[] = ['kitchen', 'screws']) {
  const onClose = vi.fn();
  render(<TagManagerDialog open tags={tags} onClose={onClose} />);
  return { onClose };
}

describe('TagManagerDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<TagManagerDialog open={false} tags={['kitchen']} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows an empty state when no tags exist', () => {
    setup([]);
    expect(screen.getByText(/no tags yet/i)).toBeInTheDocument();
  });

  it('lists every tag', () => {
    setup();
    expect(screen.getByText('kitchen')).toBeInTheDocument();
    expect(screen.getByText('screws')).toBeInTheDocument();
  });

  it('assigns an icon to a tag', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /customize tag kitchen/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Use icon 🔧 for kitchen' }));
    expect(useTagAppearanceStore.getState().appearances.kitchen).toEqual({ icon: '🔧' });
  });

  it('assigns a color to a tag', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /customize tag kitchen/i }));
    fireEvent.click(screen.getByRole('button', { name: /use color coral for kitchen/i }));
    expect(useTagAppearanceStore.getState().appearances.kitchen).toEqual({ color: '#f87171' });
  });

  it('resets a tag appearance via the clear button', () => {
    useTagAppearanceStore.getState().setTagAppearance('kitchen', { icon: '🔧' });
    setup();
    fireEvent.click(screen.getByRole('button', { name: /reset appearance of kitchen/i }));
    expect(useTagAppearanceStore.getState().appearances.kitchen).toBeUndefined();
  });

  it('"None" clears just the icon and keeps the color', () => {
    useTagAppearanceStore.getState().setTagAppearance('kitchen', { icon: '🔧', color: '#f87171' });
    setup();
    fireEvent.click(screen.getByRole('button', { name: /customize tag kitchen/i }));
    const noneButtons = screen.getAllByRole('button', { name: /^none$/i });
    fireEvent.click(noneButtons[0]);
    expect(useTagAppearanceStore.getState().appearances.kitchen).toEqual({ color: '#f87171' });
  });
});
