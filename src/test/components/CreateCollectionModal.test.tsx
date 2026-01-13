import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { CreateCollectionModal } from '../../components/modals/CreateCollectionModal';
import { useLayoutStore } from '../../store/layout';
import { useCollectionStore } from '../../store/collection';
import { useToastStore } from '../../store/toast';
import { useUIStore } from '../../store/ui';
import { createDefaultLayout } from '../../constants';
import type { Layout } from '../../types';

// Mock storage functions
vi.mock('../../utils/storage', () => ({
  copyToClipboard: vi.fn(() => Promise.resolve(true)),
}));

// Mock URL utilities
vi.mock('../../utils/url', () => ({
  setCollectionURL: vi.fn(),
  generateCollectionURL: vi.fn((id: string) => `https://example.com/c/${id}`),
}));

const mockLayout: Layout = {
  ...createDefaultLayout(),
  name: 'My Test Layout',
};

describe('CreateCollectionModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset layout store
    useLayoutStore.setState({
      layout: mockLayout,
      activeLayoutId: 'test-layout-id',
    });

    // Reset collection store with mock createNewCollection
    useCollectionStore.setState({
      activeCollection: null,
      activeCollectionLayouts: [],
      memberships: [],
      loadingState: 'idle',
    });

    // Reset toast store
    useToastStore.setState({
      toasts: [],
    });

    // Reset UI store
    useUIStore.setState({
      liveMessage: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('visibility', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(
        <CreateCollectionModal isOpen={false} onClose={mockOnClose} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders when isOpen is true', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Create Collection')).toBeInTheDocument();
    });
  });

  describe('form elements', () => {
    it('shows collection name input', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByLabelText(/Collection Name/i)).toBeInTheDocument();
    });

    it('pre-populates name with layout name + " Collection"', async () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const input = screen.getByLabelText(/Collection Name/i) as HTMLInputElement;
        expect(input.value).toBe('My Test Layout Collection');
      });
    });

    it('shows checkbox to include current layout', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      expect(screen.getByText(/Add current layout/i)).toBeInTheDocument();
    });

    it('checkbox is checked by default', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('shows Cancel button', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('shows Create & Copy Link button', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: /Create & Copy Link/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="dialog" and aria-modal', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'create-collection-title');

      const title = screen.getByText('Create Collection');
      expect(title).toHaveAttribute('id', 'create-collection-title');
    });

    it('close button has accessible label', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('focuses input on mount', async () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const input = screen.getByLabelText(/Collection Name/i);
        expect(document.activeElement).toBe(input);
      });
    });
  });

  describe('keyboard navigation', () => {
    it('closes on Escape key', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('shows error when submitting whitespace-only name', async () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      // Set to whitespace only (passes the .trim() empty check)
      const input = screen.getByLabelText(/Collection Name/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: '   ' } });
      });

      // Submit via form submission instead of button click
      const form = input.closest('form');
      await act(async () => {
        fireEvent.submit(form!);
      });

      expect(screen.getByRole('alert')).toHaveTextContent(/Please enter a collection name/i);
    });

    it('shows error when name is too long', async () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection Name/i);
      const longName = 'a'.repeat(65);
      await act(async () => {
        fireEvent.change(input, { target: { value: longName } });
      });

      const submitButton = screen.getByRole('button', { name: /Create & Copy Link/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(screen.getByRole('alert')).toHaveTextContent(/64 characters or less/i);
    });

    it('submit button is disabled when name is empty', async () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection Name/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: '   ' } });
      });

      const submitButton = screen.getByRole('button', { name: /Create & Copy Link/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('form submission', () => {
    it('calls createNewCollection with name and layout when checkbox checked', async () => {
      const mockCreateNewCollection = vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'new-collection-id', name: 'Test Collection', layoutCount: 1 },
      });
      useCollectionStore.setState({
        createNewCollection: mockCreateNewCollection,
      });

      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection Name/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test Collection' } });
      });

      const submitButton = screen.getByRole('button', { name: /Create & Copy Link/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockCreateNewCollection).toHaveBeenCalledWith('Test Collection', mockLayout);
      });
    });

    it('calls createNewCollection without layout when checkbox unchecked', async () => {
      const mockCreateNewCollection = vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'new-collection-id', name: 'Test Collection', layoutCount: 0 },
      });
      useCollectionStore.setState({
        createNewCollection: mockCreateNewCollection,
      });

      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      // Uncheck the checkbox
      const checkbox = screen.getByRole('checkbox');
      await act(async () => {
        fireEvent.click(checkbox);
      });

      const input = screen.getByLabelText(/Collection Name/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test Collection' } });
      });

      const submitButton = screen.getByRole('button', { name: /Create & Copy Link/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockCreateNewCollection).toHaveBeenCalledWith('Test Collection', undefined);
      });
    });

    it('shows success toast on successful creation', async () => {
      const mockCreateNewCollection = vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'new-collection-id', name: 'Test Collection', layoutCount: 1 },
      });
      useCollectionStore.setState({
        createNewCollection: mockCreateNewCollection,
      });

      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection Name/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test Collection' } });
      });

      const submitButton = screen.getByRole('button', { name: /Create & Copy Link/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        const toasts = useToastStore.getState().toasts;
        expect(toasts.length).toBeGreaterThan(0);
        expect(toasts[0].type).toBe('success');
      });
    });

    it('closes modal on successful creation', async () => {
      const mockCreateNewCollection = vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'new-collection-id', name: 'Test Collection', layoutCount: 1 },
      });
      useCollectionStore.setState({
        createNewCollection: mockCreateNewCollection,
      });

      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection Name/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test Collection' } });
      });

      const submitButton = screen.getByRole('button', { name: /Create & Copy Link/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('shows error message on failed creation', async () => {
      const mockCreateNewCollection = vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Server error' },
      });
      useCollectionStore.setState({
        createNewCollection: mockCreateNewCollection,
      });

      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection Name/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test Collection' } });
      });

      const submitButton = screen.getByRole('button', { name: /Create & Copy Link/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('shows loading state while creating', async () => {
      const mockCreateNewCollection = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          success: true,
          data: { id: 'new-collection-id', name: 'Test Collection', layoutCount: 1 },
        }), 100))
      );
      useCollectionStore.setState({
        createNewCollection: mockCreateNewCollection,
      });

      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText(/Collection Name/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test Collection' } });
      });

      const submitButton = screen.getByRole('button', { name: /Create & Copy Link/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Should show creating state
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });
  });

  describe('cancel behavior', () => {
    it('closes modal when Cancel is clicked', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal when clicking backdrop', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      const backdrop = screen.getByRole('presentation');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal when clicking close button', () => {
      render(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByLabelText('Close'));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('state reset', () => {
    it('resets form when modal closes and reopens', async () => {
      const { rerender } = render(
        <CreateCollectionModal isOpen={true} onClose={mockOnClose} />
      );

      // Change input
      const input = screen.getByLabelText(/Collection Name/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Changed Name' } });
      });

      // Close modal
      rerender(<CreateCollectionModal isOpen={false} onClose={mockOnClose} />);

      // Reopen modal
      rerender(<CreateCollectionModal isOpen={true} onClose={mockOnClose} />);

      // Check that input is reset to default
      await waitFor(() => {
        const newInput = screen.getByLabelText(/Collection Name/i) as HTMLInputElement;
        expect(newInput.value).toBe('My Test Layout Collection');
      });
    });
  });
});
