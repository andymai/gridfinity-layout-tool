import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileHelpModal } from './MobileHelpModal';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, string>) => {
    if (key === 'mobile.help') return 'Mobile Help';
    if (key === 'common.close') return 'Close';
    if (key === 'help.searchPlaceholder') return 'Search shortcuts and features...';
    if (key === 'help.noResultsFor' && vars) return `No matches for "${vars.query}"`;
    if (key === 'help.searchResultsAriaLabel') return 'Search results';
    return key;
  },
}));

describe('MobileHelpModal', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing when open', () => {
    const onClose = vi.fn();
    render(<MobileHelpModal isOpen={true} onClose={onClose} />);
  });

  it('renders nothing when closed', () => {
    const onClose = vi.fn();
    const { container } = render(<MobileHelpModal isOpen={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays title when open', () => {
    const onClose = vi.fn();
    render(<MobileHelpModal isOpen={true} onClose={onClose} />);
    expect(screen.getByText('Mobile Help')).toBeInTheDocument();
  });

  it('shows the search input', () => {
    const onClose = vi.fn();
    render(<MobileHelpModal isOpen={true} onClose={onClose} />);
    expect(screen.getByPlaceholderText('Search shortcuts and features...')).toBeInTheDocument();
  });

  it('hides the gesture sections and shows results when typing', () => {
    const onClose = vi.fn();
    render(<MobileHelpModal isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText('Search shortcuts and features...');
    fireEvent.change(input, { target: { value: 'bed size' } });

    // The "Drawing & Selection" section is hidden when searching.
    expect(screen.queryByText('mobile.help.drawingSelection')).toBeNull();
    // ...and the results list is rendered (matched by its aria-label).
    expect(screen.getByLabelText('Search results')).toBeInTheDocument();
  });

  it('shows the no-results message when no matches', () => {
    const onClose = vi.fn();
    render(<MobileHelpModal isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText('Search shortcuts and features...');
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });

    expect(screen.getByText('No matches for "xyznonexistent"')).toBeInTheDocument();
  });

  it('clears the search query when the modal is closed (no stale filter on reopen)', () => {
    const onClose = vi.fn();
    const { rerender } = render(<MobileHelpModal isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText('Search shortcuts and features...');
    fireEvent.change(input, { target: { value: 'bed size' } });
    expect(input.value).toBe('bed size');

    // Trigger the X close button — the handler should clear search first.
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();

    rerender(<MobileHelpModal isOpen={true} onClose={onClose} />);
    const reopenedInput = screen.getByPlaceholderText('Search shortcuts and features...');
    expect(reopenedInput.value).toBe('');
  });
});
