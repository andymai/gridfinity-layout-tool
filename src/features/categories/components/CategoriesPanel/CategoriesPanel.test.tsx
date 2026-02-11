import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoriesPanel } from '@/features/categories/components/CategoriesPanel';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { resetAllStores } from '@/test/testUtils';

// Mock ConfirmDialog to simplify testing
vi.mock('@/shared/components/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    onConfirm,
    onCancel,
    title,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
  }) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

// Mock CollapsibleSection to show content directly
vi.mock('@/shared/components/CollapsibleSection', () => ({
  CollapsibleSection: ({
    children,
    title,
    actions,
  }: {
    children: React.ReactNode;
    title: string;
    actions?: React.ReactNode;
  }) => (
    <div>
      <div className="flex">
        <span>{title}</span>
        {actions}
      </div>
      {children}
    </div>
  ),
}));

describe('CategoriesPanel', () => {
  beforeEach(() => {
    resetAllStores();

    // Set up initial layout state
    useLayoutStore.setState({
      layout: {
        version: '1.0',
        name: 'Test',
        drawer: { width: 10, depth: 8, height: 12 },
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [
          { id: 'coral', name: 'Coral', color: '#FF6B6B' },
          { id: 'sky', name: 'Sky', color: '#38bdf8' },
        ],
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        bins: [],
      },
    });

    useSelectionStore.setState({
      activeCategoryId: 'coral',
      selectedBinIds: [],
    });
  });

  describe('rendering', () => {
    it('displays section title', () => {
      render(<CategoriesPanel />);

      expect(screen.getByText('Categories')).toBeInTheDocument();
    });

    it('displays all categories', () => {
      render(<CategoriesPanel />);

      expect(screen.getByText('Coral')).toBeInTheDocument();
      expect(screen.getByText('Sky')).toBeInTheDocument();
    });

    it('shows add category button', () => {
      render(<CategoriesPanel />);

      expect(screen.getByLabelText('Add category')).toBeInTheDocument();
    });

    it('shows active indicator on selected category', () => {
      const { container } = render(<CategoriesPanel />);

      // Active category should have checkmark SVG
      const coralRow = container.querySelector('[class*="bg-[var(--bg-active)]"]');
      expect(coralRow).toBeInTheDocument();
    });
  });

  describe('category selection', () => {
    it('sets active category on click', () => {
      render(<CategoriesPanel />);

      fireEvent.click(screen.getByText('Sky'));

      expect(useSelectionStore.getState().activeCategoryId).toBe('sky');
    });

    it('updates selected bins when bins are selected', () => {
      // Add a bin and select it
      const { addBin } = useLayoutStore.getState();
      addBin({
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'coral',
        label: '',
        notes: '',
      });
      const binId = useLayoutStore.getState().layout.bins[0].id;
      useSelectionStore.setState({ selectedBinIds: [binId] });

      render(<CategoriesPanel />);
      fireEvent.click(screen.getByText('Sky'));

      // Bin category should be updated
      expect(useLayoutStore.getState().layout.bins[0].category).toBe('sky');
    });
  });

  describe('add category', () => {
    it('adds a new category when button clicked', () => {
      render(<CategoriesPanel />);

      fireEvent.click(screen.getByLabelText('Add category'));

      const categories = useLayoutStore.getState().layout.categories;
      expect(categories).toHaveLength(3);
      expect(categories[2].name).toBe('New Category');
    });

    it('enters edit mode for new category', () => {
      render(<CategoriesPanel />);

      fireEvent.click(screen.getByLabelText('Add category'));

      // Should show input field for editing
      expect(screen.getByDisplayValue('New Category')).toBeInTheDocument();
    });
  });

  describe('edit category', () => {
    it('enters edit mode on double click', () => {
      render(<CategoriesPanel />);

      // Double-click the category name button (not the edit icon)
      const categoryButton = screen.getByRole('button', {
        name: /Coral \(selected for new bins\)/i,
      });
      fireEvent.doubleClick(categoryButton);

      // Should show input field
      expect(screen.getByDisplayValue('Coral')).toBeInTheDocument();
    });

    it('enters edit mode on edit icon click', () => {
      render(<CategoriesPanel />);

      // Click the edit icon button
      const editButton = screen.getByRole('button', { name: /Edit Coral/i });
      fireEvent.click(editButton);

      // Should show input field
      expect(screen.getByDisplayValue('Coral')).toBeInTheDocument();
    });

    it('updates category name', () => {
      render(<CategoriesPanel />);

      // Enter edit mode via edit icon
      const editButton = screen.getByRole('button', { name: /Edit Coral/i });
      fireEvent.click(editButton);

      // Change name
      const input = screen.getByDisplayValue('Coral');
      fireEvent.change(input, { target: { value: 'New Name' } });

      expect(useLayoutStore.getState().layout.categories[0].name).toBe('New Name');
    });

    it('exits edit mode on Enter key', () => {
      render(<CategoriesPanel />);

      // Enter edit mode via edit icon
      const editButton = screen.getByRole('button', { name: /Edit Coral/i });
      fireEvent.click(editButton);

      // Press Enter
      const input = screen.getByDisplayValue('Coral');
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should exit edit mode (no input visible)
      expect(screen.queryByDisplayValue('Coral')).not.toBeInTheDocument();
    });

    it('exits edit mode on Escape key', async () => {
      vi.useFakeTimers();
      try {
        render(<CategoriesPanel />);

        // Enter edit mode via edit icon
        const editButton = screen.getByRole('button', { name: /Edit Coral/i });
        fireEvent.click(editButton);

        // Wait for the click-outside listener to be attached (50ms delay)
        await vi.advanceTimersByTimeAsync(100);

        // Press Escape on the document (the listener is attached to document)
        fireEvent.keyDown(document, { key: 'Escape' });

        // Should exit edit mode (input should no longer be visible)
        expect(screen.queryByDisplayValue('Coral')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('delete category', () => {
    it('shows confirmation dialog when deleting category', () => {
      // Add third category so we can delete
      useLayoutStore.getState().addCategory({ name: 'Third', color: '#00FF00' });

      render(<CategoriesPanel />);

      // Enter edit mode for the third category via edit icon
      const editButton = screen.getByRole('button', { name: /Edit Third/i });
      fireEvent.click(editButton);

      // Click delete
      fireEvent.click(screen.getByText('Delete'));

      // Confirm dialog should appear
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    it('deletes category on confirm', () => {
      // Add third category
      useLayoutStore.getState().addCategory({ name: 'Third', color: '#00FF00' });

      render(<CategoriesPanel />);

      // Enter edit mode and delete via edit icon
      const editButton = screen.getByRole('button', { name: /Edit Third/i });
      fireEvent.click(editButton);
      fireEvent.click(screen.getByText('Delete'));

      // Confirm deletion
      fireEvent.click(screen.getByText('Confirm'));

      expect(useLayoutStore.getState().layout.categories).toHaveLength(2);
    });

    it('prevents deleting category with bins', () => {
      // Add bin using coral category
      useLayoutStore.getState().addBin({
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'coral',
        label: '',
        notes: '',
      });

      render(<CategoriesPanel />);

      // Enter edit mode for coral via edit icon
      const editButton = screen.getByRole('button', { name: /Edit Coral/i });
      fireEvent.click(editButton);

      // Delete button should not be visible when category has bins
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });

    it('prevents deleting last category', () => {
      // Set to only have one category
      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          categories: [{ id: 'coral', name: 'Coral', color: '#FF6B6B' }],
        },
      });

      render(<CategoriesPanel />);

      // Enter edit mode via edit icon
      const editButton = screen.getByRole('button', { name: /Edit Coral/i });
      fireEvent.click(editButton);

      // Delete button should not be visible when it's the last category
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });
  });

  describe('bin count badges', () => {
    it('shows bin count for categories with bins', () => {
      // Add bins
      useLayoutStore.getState().addBin({
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'coral',
        label: '',
        notes: '',
      });
      useLayoutStore.getState().addBin({
        layerId: 'layer1',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'coral',
        label: '',
        notes: '',
      });

      render(<CategoriesPanel />);

      // Should show count of 2 for coral
      expect(screen.getByTitle('2 bin(s) use this category')).toBeInTheDocument();
    });

    it('does not render badges for categories without bins', () => {
      render(<CategoriesPanel />);

      // Both categories have no bins, no badges should be rendered
      expect(screen.queryByTitle('No bins use this category')).not.toBeInTheDocument();
      // Also verify no bin count badges exist at all (they only render when binCount > 0)
      expect(screen.queryByTitle(/bin\(s\) use this category/)).not.toBeInTheDocument();
    });
  });
});
