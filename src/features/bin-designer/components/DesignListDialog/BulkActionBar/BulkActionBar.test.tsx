// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionBar } from './BulkActionBar';

function setup(count: number) {
  const handlers = {
    onSelectAll: vi.fn(),
    onTag: vi.fn(),
    onExport: vi.fn(),
    onDelete: vi.fn(),
    onCancel: vi.fn(),
  };
  render(<BulkActionBar count={count} {...handlers} />);
  return handlers;
}

describe('BulkActionBar', () => {
  it('shows the selected count', () => {
    setup(3);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('disables bulk actions when nothing is selected', () => {
    setup(0);
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^export$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^tag$/i })).toBeDisabled();
  });

  it('fires actions when selected', () => {
    const h = setup(2);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^export$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^tag$/i }));
    expect(h.onDelete).toHaveBeenCalled();
    expect(h.onExport).toHaveBeenCalled();
    expect(h.onTag).toHaveBeenCalled();
  });

  it('select-all and cancel are always available', () => {
    const h = setup(0);
    fireEvent.click(screen.getByText(/select all/i));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(h.onSelectAll).toHaveBeenCalled();
    expect(h.onCancel).toHaveBeenCalled();
  });
});
