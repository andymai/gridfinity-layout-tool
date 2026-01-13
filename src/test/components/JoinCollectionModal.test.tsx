import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { JoinCollectionModal } from '../../components/modals/JoinCollectionModal';

// Mock useCollectionRouting hook
const mockNavigateToCollection = vi.fn();
vi.mock('../../hooks/useCollectionRouting', () => ({
  useCollectionRouting: () => ({
    navigateToCollection: mockNavigateToCollection,
    exitCollection: vi.fn(),
    isLoading: false,
    isSyncing: false,
  }),
}));

describe('JoinCollectionModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigateToCollection.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('visibility', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(
        <JoinCollectionModal isOpen={false} onClose={mockOnClose} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders when isOpen is true', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Title is an h2 element
      expect(screen.getByRole('heading', { name: 'Join Collection' })).toBeInTheDocument();
    });
  });

  describe('form elements', () => {
    it('shows URL/ID input', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByLabelText(/Collection URL or ID/i)).toBeInTheDocument();
    });

    it('shows placeholder text', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      expect(input).toHaveAttribute('placeholder', expect.stringContaining('abc123def456'));
    });

    it('shows Cancel button', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('shows Join Collection button', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: /Join Collection/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="dialog" and aria-modal', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'join-collection-title');

      // Title is a heading element
      const title = screen.getByRole('heading', { name: 'Join Collection' });
      expect(title).toHaveAttribute('id', 'join-collection-title');
    });

    it('close button has accessible label', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('focuses input on mount', async () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const input = screen.getByLabelText(/Collection URL or ID/i);
        expect(document.activeElement).toBe(input);
      });
    });
  });

  describe('keyboard navigation', () => {
    it('closes on Escape key', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('input parsing', () => {
    it('accepts plain 12-char ID', async () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'abc123def456' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(mockNavigateToCollection).toHaveBeenCalledWith('abc123def456');
    });

    it('extracts ID from full URL', async () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'https://example.com/c/abc123def456' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(mockNavigateToCollection).toHaveBeenCalledWith('abc123def456');
    });

    it('extracts ID from URL with /view suffix', async () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'https://example.com/c/abc123def456/view' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(mockNavigateToCollection).toHaveBeenCalledWith('abc123def456');
    });

    it('extracts ID from path only', async () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: '/c/abc123def456' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(mockNavigateToCollection).toHaveBeenCalledWith('abc123def456');
    });

    it('handles URL with query params', async () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'https://example.com/c/abc123def456?foo=bar' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(mockNavigateToCollection).toHaveBeenCalledWith('abc123def456');
    });
  });

  describe('validation', () => {
    it('shows error for invalid ID format (too short)', async () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'abc123' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Too short IDs fail local validation
      expect(screen.getByRole('alert')).toHaveTextContent(/valid collection URL or ID/i);
    });

    it('shows error for ID that is too long', async () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'abc123def456789' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Too long IDs fail local validation
      expect(screen.getByRole('alert')).toHaveTextContent(/valid collection URL or ID/i);
    });

    it('shows error for ID with non-alphanumeric characters', async () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'abc123-def!' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Invalid characters fail local validation
      expect(screen.getByRole('alert')).toHaveTextContent(/valid collection URL or ID/i);
    });

    it('submit button is disabled when input is empty', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('form submission', () => {
    it('calls navigateToCollection on successful submission', async () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'abc123def456' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(mockNavigateToCollection).toHaveBeenCalledWith('abc123def456');
    });

    it('closes modal on successful join', async () => {
      mockNavigateToCollection.mockResolvedValue(true);

      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'abc123def456' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('shows error message on failed join', async () => {
      mockNavigateToCollection.mockResolvedValue(false);

      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'abc123def456' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/not found/i);
      });
    });

    it('does not close modal on failed join', async () => {
      mockNavigateToCollection.mockResolvedValue(false);

      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'abc123def456' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('shows loading state while joining', async () => {
      mockNavigateToCollection.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
      );

      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'abc123def456' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(screen.getByText('Joining...')).toBeInTheDocument();
    });
  });

  describe('cancel behavior', () => {
    it('closes modal when Cancel is clicked', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal when clicking backdrop', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      const backdrop = screen.getByRole('presentation');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal when clicking close button', () => {
      render(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByLabelText('Close'));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('state reset', () => {
    it('resets form when modal closes and reopens', async () => {
      const { rerender } = render(
        <JoinCollectionModal isOpen={true} onClose={mockOnClose} />
      );

      // Type in input
      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'abc123def456' } });
      });

      // Close modal
      rerender(<JoinCollectionModal isOpen={false} onClose={mockOnClose} />);

      // Reopen modal
      rerender(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      // Check that input is cleared
      await waitFor(() => {
        const newInput = screen.getByLabelText(/Collection URL or ID/i) as HTMLInputElement;
        expect(newInput.value).toBe('');
      });
    });

    it('clears error when modal closes and reopens', async () => {
      mockNavigateToCollection.mockResolvedValue(false);

      const { rerender } = render(
        <JoinCollectionModal isOpen={true} onClose={mockOnClose} />
      );

      // Submit invalid input to get error
      const input = screen.getByLabelText(/Collection URL or ID/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'abc123def456' } });
      });

      const submitButton = screen.getByRole('button', { name: /Join Collection/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Close modal
      rerender(<JoinCollectionModal isOpen={false} onClose={mockOnClose} />);

      // Reopen modal
      rerender(<JoinCollectionModal isOpen={true} onClose={mockOnClose} />);

      // Error should be cleared
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
