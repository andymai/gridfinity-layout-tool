import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('renders the value and forwards changes', () => {
    const onValueChange = vi.fn();
    render(
      <SearchInput
        value="wid"
        onValueChange={onValueChange}
        clearLabel="Clear"
        aria-label="Search"
      />
    );
    const input = screen.getByRole('textbox', { name: 'Search' });
    expect(input).toHaveValue('wid');
    fireEvent.change(input, { target: { value: 'width' } });
    expect(onValueChange).toHaveBeenCalledWith('width');
  });

  it('shows a clear button only when there is text, and clears on click', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <SearchInput value="" onValueChange={onValueChange} clearLabel="Clear" aria-label="Search" />
    );
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

    rerender(
      <SearchInput value="x" onValueChange={onValueChange} clearLabel="Clear" aria-label="Search" />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('clears on Escape and claims the key only while non-empty', () => {
    const onValueChange = vi.fn();
    render(
      <SearchInput value="x" onValueChange={onValueChange} clearLabel="Clear" aria-label="Search" />
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('shows the shortcut hint only while empty', () => {
    const { rerender } = render(
      <SearchInput
        value=""
        onValueChange={vi.fn()}
        clearLabel="Clear"
        shortcutHint="⌘K"
        aria-label="Search"
      />
    );
    expect(screen.getByText('⌘K')).toBeInTheDocument();

    rerender(
      <SearchInput
        value="x"
        onValueChange={vi.fn()}
        clearLabel="Clear"
        shortcutHint="⌘K"
        aria-label="Search"
      />
    );
    expect(screen.queryByText('⌘K')).not.toBeInTheDocument();
  });
});
