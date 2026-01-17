import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActions } from '../../components/Modals/BinListModal/BulkActions';
import type { Category } from '../../types';

describe('BulkActions', () => {
  const mockCategories: Category[] = [
    { id: 'coral', name: 'Coral', color: '#FF6B6B' },
    { id: 'blue', name: 'Blue', color: '#4ECDC4' },
    { id: 'green', name: 'Green', color: '#95D5B2' },
  ];

  const mockOnDelete = vi.fn();
  const mockOnChangeCategory = vi.fn();
  const mockOnClearSelection = vi.fn();
  const mockOnUpdateLabel = vi.fn();
  const mockOnUpdateNotes = vi.fn();

  const defaultProps = {
    selectionCount: 3,
    categories: mockCategories,
    onDelete: mockOnDelete,
    onChangeCategory: mockOnChangeCategory,
    onClearSelection: mockOnClearSelection,
    onUpdateLabel: mockOnUpdateLabel,
    onUpdateNotes: mockOnUpdateNotes,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('returns null when selectionCount is 0', () => {
      const { container } = render(<BulkActions {...defaultProps} selectionCount={0} />);

      expect(container.firstChild).toBeNull();
    });

    it('renders selection count', () => {
      render(<BulkActions {...defaultProps} />);

      expect(screen.getByText('3 selected')).toBeInTheDocument();
    });

    it('renders clear selection button', () => {
      render(<BulkActions {...defaultProps} />);

      expect(screen.getByLabelText('Clear selection')).toBeInTheDocument();
    });

    it('renders category button', () => {
      render(<BulkActions {...defaultProps} />);

      expect(screen.getByText('Category')).toBeInTheDocument();
    });

    it('renders label button when onUpdateLabel is provided', () => {
      render(<BulkActions {...defaultProps} />);

      expect(screen.getByText('Label')).toBeInTheDocument();
    });

    it('does not render label button when onUpdateLabel is not provided', () => {
      render(<BulkActions {...defaultProps} onUpdateLabel={undefined} />);

      expect(screen.queryByText('Label')).not.toBeInTheDocument();
    });

    it('renders notes button when onUpdateNotes is provided', () => {
      render(<BulkActions {...defaultProps} />);

      expect(screen.getByText('Notes')).toBeInTheDocument();
    });

    it('does not render notes button when onUpdateNotes is not provided', () => {
      render(<BulkActions {...defaultProps} onUpdateNotes={undefined} />);

      expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    });

    it('renders delete button', () => {
      render(<BulkActions {...defaultProps} />);

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  describe('clear selection', () => {
    it('calls onClearSelection when clear button clicked', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Clear selection'));

      expect(mockOnClearSelection).toHaveBeenCalledOnce();
    });
  });

  describe('delete action', () => {
    it('calls onDelete when delete button clicked', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Delete'));

      expect(mockOnDelete).toHaveBeenCalledOnce();
    });
  });

  describe('category dropdown', () => {
    it('opens category dropdown when button clicked', () => {
      render(<BulkActions {...defaultProps} />);

      const categoryButton = screen.getByText('Category');
      expect(categoryButton.closest('button')).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(categoryButton);

      expect(categoryButton.closest('button')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('displays all categories in dropdown', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Category'));

      expect(screen.getByRole('option', { name: 'Coral' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Blue' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Green' })).toBeInTheDocument();
    });

    it('calls onChangeCategory when category selected', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Category'));
      fireEvent.click(screen.getByRole('option', { name: 'Blue' }));

      expect(mockOnChangeCategory).toHaveBeenCalledWith('blue');
    });

    it('closes dropdown after category selection', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Category'));
      fireEvent.click(screen.getByRole('option', { name: 'Blue' }));

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('toggles dropdown on repeated clicks', () => {
      render(<BulkActions {...defaultProps} />);

      const categoryButton = screen.getByText('Category');

      // Open
      fireEvent.click(categoryButton);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Close
      fireEvent.click(categoryButton);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('shows category color dots', () => {
      const { container } = render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Category'));

      const colorDots = container.querySelectorAll('[style*="background-color"]');
      expect(colorDots.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('label dropdown', () => {
    it('opens label dropdown when button clicked', () => {
      render(<BulkActions {...defaultProps} />);

      const labelButton = screen.getByText('Label');
      expect(labelButton.closest('button')).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(labelButton);

      expect(labelButton.closest('button')).toHaveAttribute('aria-expanded', 'true');
    });

    it('shows label input with placeholder', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Label'));

      expect(screen.getByPlaceholderText('Enter label...')).toBeInTheDocument();
    });

    it('shows selection count in label description', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Label'));

      expect(screen.getByText('Set label for 3 bins')).toBeInTheDocument();
    });

    it('shows singular text for single selection', () => {
      render(<BulkActions {...defaultProps} selectionCount={1} />);

      fireEvent.click(screen.getByText('Label'));

      expect(screen.getByText('Set label for 1 bin')).toBeInTheDocument();
    });

    it('calls onUpdateLabel when Apply clicked with valid input', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Label'));
      const input = screen.getByPlaceholderText('Enter label...');
      fireEvent.change(input, { target: { value: 'Test Label' } });
      fireEvent.click(screen.getByText('Apply'));

      expect(mockOnUpdateLabel).toHaveBeenCalledWith('Test Label');
    });

    it('does not call onUpdateLabel when Apply clicked with empty input', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Label'));
      fireEvent.click(screen.getByText('Apply'));

      expect(mockOnUpdateLabel).not.toHaveBeenCalled();
    });

    it('does not call onUpdateLabel when Apply clicked with whitespace-only input', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Label'));
      const input = screen.getByPlaceholderText('Enter label...');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(screen.getByText('Apply'));

      expect(mockOnUpdateLabel).not.toHaveBeenCalled();
    });

    it('trims label value before submitting', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Label'));
      const input = screen.getByPlaceholderText('Enter label...');
      fireEvent.change(input, { target: { value: '  Test Label  ' } });
      fireEvent.click(screen.getByText('Apply'));

      expect(mockOnUpdateLabel).toHaveBeenCalledWith('Test Label');
    });

    it('closes dropdown and clears input after submit', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Label'));
      const input = screen.getByPlaceholderText('Enter label...');
      fireEvent.change(input, { target: { value: 'Test Label' } });
      fireEvent.click(screen.getByText('Apply'));

      expect(screen.queryByPlaceholderText('Enter label...')).not.toBeInTheDocument();
    });

    it('submits on Enter key', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Label'));
      const input = screen.getByPlaceholderText('Enter label...');
      fireEvent.change(input, { target: { value: 'Test Label' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnUpdateLabel).toHaveBeenCalledWith('Test Label');
    });

    it('closes dropdown on Escape key', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Label'));
      const input = screen.getByPlaceholderText('Enter label...');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(screen.queryByPlaceholderText('Enter label...')).not.toBeInTheDocument();
    });

    it('Apply button is disabled when input is empty', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Label'));
      const applyButton = screen.getByText('Apply');

      expect(applyButton).toBeDisabled();
    });

    it('Apply button is enabled when input has value', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Label'));
      const input = screen.getByPlaceholderText('Enter label...');
      fireEvent.change(input, { target: { value: 'Test' } });
      const applyButton = screen.getByText('Apply');

      expect(applyButton).not.toBeDisabled();
    });
  });

  describe('notes dropdown', () => {
    it('opens notes dropdown when button clicked', () => {
      render(<BulkActions {...defaultProps} />);

      const notesButton = screen.getByText('Notes');
      expect(notesButton.closest('button')).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(notesButton);

      expect(notesButton.closest('button')).toHaveAttribute('aria-expanded', 'true');
    });

    it('shows notes textarea with placeholder', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Notes'));

      expect(screen.getByPlaceholderText(/Enter notes/)).toBeInTheDocument();
    });

    it('shows selection count in notes description', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Notes'));

      expect(screen.getByText('Set notes for 3 bins')).toBeInTheDocument();
    });

    it('shows singular text for single selection', () => {
      render(<BulkActions {...defaultProps} selectionCount={1} />);

      fireEvent.click(screen.getByText('Notes'));

      expect(screen.getByText('Set notes for 1 bin')).toBeInTheDocument();
    });

    it('calls onUpdateNotes when Apply clicked with valid input', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Notes'));
      const textarea = screen.getByPlaceholderText(/Enter notes/);
      fireEvent.change(textarea, { target: { value: 'Test Notes' } });
      // Get the Apply button within the notes dropdown (it's the second Apply if label is open)
      const applyButtons = screen.getAllByText('Apply');
      fireEvent.click(applyButtons[applyButtons.length - 1]);

      expect(mockOnUpdateNotes).toHaveBeenCalledWith('Test Notes');
    });

    it('does not call onUpdateNotes when Apply clicked with empty input', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Notes'));
      const applyButtons = screen.getAllByText('Apply');
      fireEvent.click(applyButtons[applyButtons.length - 1]);

      expect(mockOnUpdateNotes).not.toHaveBeenCalled();
    });

    it('trims notes value before submitting', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Notes'));
      const textarea = screen.getByPlaceholderText(/Enter notes/);
      fireEvent.change(textarea, { target: { value: '  Test Notes  ' } });
      const applyButtons = screen.getAllByText('Apply');
      fireEvent.click(applyButtons[applyButtons.length - 1]);

      expect(mockOnUpdateNotes).toHaveBeenCalledWith('Test Notes');
    });

    it('submits on Ctrl+Enter key', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Notes'));
      const textarea = screen.getByPlaceholderText(/Enter notes/);
      fireEvent.change(textarea, { target: { value: 'Test Notes' } });
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

      expect(mockOnUpdateNotes).toHaveBeenCalledWith('Test Notes');
    });

    it('submits on Meta+Enter key (Mac)', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Notes'));
      const textarea = screen.getByPlaceholderText(/Enter notes/);
      fireEvent.change(textarea, { target: { value: 'Test Notes' } });
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

      expect(mockOnUpdateNotes).toHaveBeenCalledWith('Test Notes');
    });

    it('closes dropdown on Escape key', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Notes'));
      const textarea = screen.getByPlaceholderText(/Enter notes/);
      fireEvent.keyDown(textarea, { key: 'Escape' });

      expect(screen.queryByPlaceholderText(/Enter notes/)).not.toBeInTheDocument();
    });

    it('Apply button is disabled when textarea is empty', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Notes'));
      const applyButtons = screen.getAllByText('Apply');
      const notesApply = applyButtons[applyButtons.length - 1];

      expect(notesApply).toBeDisabled();
    });
  });

  describe('click outside behavior', () => {
    it('closes dropdown when clicking outside', () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <BulkActions {...defaultProps} />
        </div>
      );

      fireEvent.click(screen.getByText('Category'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Simulate click outside by firing mousedown on the outside element
      fireEvent.mouseDown(screen.getByTestId('outside'));

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('does not close dropdown when clicking inside', () => {
      render(<BulkActions {...defaultProps} />);

      fireEvent.click(screen.getByText('Category'));
      const listbox = screen.getByRole('listbox');

      // Click inside the dropdown
      fireEvent.mouseDown(listbox);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  describe('dropdown mutual exclusivity', () => {
    it('only one dropdown can be open at a time', () => {
      render(<BulkActions {...defaultProps} />);

      // Open category dropdown
      fireEvent.click(screen.getByText('Category'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Open label dropdown - should close category
      fireEvent.click(screen.getByText('Label'));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter label...')).toBeInTheDocument();

      // Open notes dropdown - should close label
      fireEvent.click(screen.getByText('Notes'));
      expect(screen.queryByPlaceholderText('Enter label...')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter notes/)).toBeInTheDocument();
    });
  });

  describe('selection count display', () => {
    it('displays correct count for single selection', () => {
      render(<BulkActions {...defaultProps} selectionCount={1} />);

      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('displays correct count for multiple selection', () => {
      render(<BulkActions {...defaultProps} selectionCount={10} />);

      expect(screen.getByText('10 selected')).toBeInTheDocument();
    });

    it('displays correct count for large selection', () => {
      render(<BulkActions {...defaultProps} selectionCount={100} />);

      expect(screen.getByText('100 selected')).toBeInTheDocument();
    });
  });
});
