import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SortOrderConfig } from '../../components/Print/SortOrderConfig';
import type { BinListSortOrder } from '../../core/store/settings';

describe('SortOrderConfig', () => {
  const defaultSortOrder: BinListSortOrder = [
    { field: 'category', enabled: true },
    { field: 'position', enabled: true },
    { field: 'layer', enabled: false },
    { field: 'size', enabled: false },
    { field: 'height', enabled: false },
    { field: 'label', enabled: false },
  ];

  describe('rendering', () => {
    it('renders all sort fields', () => {
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Position')).toBeInTheDocument();
      expect(screen.getByText('Layer')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('Height')).toBeInTheDocument();
      expect(screen.getByText('Label')).toBeInTheDocument();
    });

    it('renders checkboxes for each field', () => {
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(6);
    });

    it('shows enabled fields as checked', () => {
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // Category and Position are enabled
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).toBeChecked();
      // Others are disabled
      expect(checkboxes[2]).not.toBeChecked();
      expect(checkboxes[3]).not.toBeChecked();
      expect(checkboxes[4]).not.toBeChecked();
      expect(checkboxes[5]).not.toBeChecked();
    });

    it('shows active sort summary when fields are enabled', () => {
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      expect(screen.getByText(/Sorting by:/)).toBeInTheDocument();
      expect(screen.getByText(/Category → Position/)).toBeInTheDocument();
    });

    it('does not show summary when no fields are enabled', () => {
      const allDisabled: BinListSortOrder = defaultSortOrder.map(s => ({ ...s, enabled: false }));
      render(<SortOrderConfig sortOrder={allDisabled} onChange={() => {}} />);

      expect(screen.queryByText(/Sorting by:/)).not.toBeInTheDocument();
    });

    it('shows priority numbers for enabled fields', () => {
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      // Category is first enabled (priority 1), Position is second (priority 2)
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('toggle functionality', () => {
    it('calls onChange when toggling a field', () => {
      const onChange = vi.fn();
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={onChange} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // Toggle Layer (currently disabled)
      fireEvent.click(checkboxes[2]);

      expect(onChange).toHaveBeenCalledTimes(1);
      const newOrder = onChange.mock.calls[0][0];
      expect(newOrder.find((s: { field: string }) => s.field === 'layer').enabled).toBe(true);
    });

    it('disables an enabled field when toggled', () => {
      const onChange = vi.fn();
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={onChange} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // Toggle Category (currently enabled)
      fireEvent.click(checkboxes[0]);

      expect(onChange).toHaveBeenCalledTimes(1);
      const newOrder = onChange.mock.calls[0][0];
      expect(newOrder.find((s: { field: string }) => s.field === 'category').enabled).toBe(false);
    });
  });

  describe('move up/down buttons', () => {
    it('renders move up and down buttons for each field', () => {
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      const upButtons = screen.getAllByTitle('Move up');
      const downButtons = screen.getAllByTitle('Move down');

      expect(upButtons).toHaveLength(6);
      expect(downButtons).toHaveLength(6);
    });

    it('disables move up button for first item', () => {
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      const upButtons = screen.getAllByTitle('Move up');
      expect(upButtons[0]).toBeDisabled();
    });

    it('disables move down button for last item', () => {
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      const downButtons = screen.getAllByTitle('Move down');
      expect(downButtons[5]).toBeDisabled();
    });

    it('moves field up when clicking move up button', () => {
      const onChange = vi.fn();
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={onChange} />);

      // Click move up on Position (index 1)
      const upButtons = screen.getAllByTitle('Move up');
      fireEvent.click(upButtons[1]);

      expect(onChange).toHaveBeenCalledTimes(1);
      const newOrder = onChange.mock.calls[0][0];
      // Position should now be at index 0, Category at index 1
      expect(newOrder[0].field).toBe('position');
      expect(newOrder[1].field).toBe('category');
    });

    it('moves field down when clicking move down button', () => {
      const onChange = vi.fn();
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={onChange} />);

      // Click move down on Category (index 0)
      const downButtons = screen.getAllByTitle('Move down');
      fireEvent.click(downButtons[0]);

      expect(onChange).toHaveBeenCalledTimes(1);
      const newOrder = onChange.mock.calls[0][0];
      // Position should now be at index 0, Category at index 1
      expect(newOrder[0].field).toBe('position');
      expect(newOrder[1].field).toBe('category');
    });

    it('does not call onChange when clicking disabled move up button on first item', () => {
      const onChange = vi.fn();
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={onChange} />);

      const upButtons = screen.getAllByTitle('Move up');
      fireEvent.click(upButtons[0]);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not call onChange when clicking disabled move down button on last item', () => {
      const onChange = vi.fn();
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={onChange} />);

      const downButtons = screen.getAllByTitle('Move down');
      fireEvent.click(downButtons[5]);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('drag and drop', () => {
    it('makes items draggable', () => {
      const { container } = render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      const draggableItems = container.querySelectorAll('[draggable="true"]');
      expect(draggableItems).toHaveLength(6);
    });

    it('handles drag start', () => {
      const { container } = render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      const items = container.querySelectorAll('[draggable="true"]');
      fireEvent.dragStart(items[0]);

      // Item should have opacity class when dragging
      expect(items[0]).toHaveClass('opacity-50');
    });

    it('handles drag over', () => {
      const { container } = render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      const items = container.querySelectorAll('[draggable="true"]');
      fireEvent.dragStart(items[0]);
      fireEvent.dragOver(items[2]);

      // Target item should have drag-over styling
      expect(items[2]).toHaveClass('bg-surface-hover');
    });

    it('handles drag end without valid drop', () => {
      const onChange = vi.fn();
      const { container } = render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={onChange} />);

      const items = container.querySelectorAll('[draggable="true"]');
      fireEvent.dragStart(items[0]);
      fireEvent.dragEnd(items[0]);

      // No reorder should happen when dropping on same position
      expect(onChange).not.toHaveBeenCalled();
    });

    it('reorders items on valid drag and drop', () => {
      const onChange = vi.fn();
      const { container } = render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={onChange} />);

      const items = container.querySelectorAll('[draggable="true"]');

      // Drag Category (index 0) and drop on Layer (index 2)
      fireEvent.dragStart(items[0]);
      fireEvent.dragOver(items[2]);
      fireEvent.dragEnd(items[0]);

      expect(onChange).toHaveBeenCalledTimes(1);
      const newOrder = onChange.mock.calls[0][0];
      // Category should now be at index 2
      expect(newOrder[0].field).toBe('position');
      expect(newOrder[1].field).toBe('layer');
      expect(newOrder[2].field).toBe('category');
    });

    it('handles drag leave', () => {
      const { container } = render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      const items = container.querySelectorAll('[draggable="true"]');
      fireEvent.dragStart(items[0]);
      fireEvent.dragOver(items[2]);
      fireEvent.dragLeave(items[2]);

      // Drag over styling should be removed
      expect(items[2]).not.toHaveClass('ring-1');
    });
  });

  describe('accessibility', () => {
    it('has accessible labels for move buttons', () => {
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      expect(screen.getByLabelText('Move Category up')).toBeInTheDocument();
      expect(screen.getByLabelText('Move Category down')).toBeInTheDocument();
      expect(screen.getByLabelText('Move Position up')).toBeInTheDocument();
      expect(screen.getByLabelText('Move Position down')).toBeInTheDocument();
    });

    it('has drag handle with title', () => {
      render(<SortOrderConfig sortOrder={defaultSortOrder} onChange={() => {}} />);

      const dragHandles = screen.getAllByTitle('Drag to reorder');
      expect(dragHandles).toHaveLength(6);
    });
  });

  describe('sort summary display', () => {
    it('shows fields in correct order in summary', () => {
      const customOrder: BinListSortOrder = [
        { field: 'size', enabled: true },
        { field: 'label', enabled: true },
        { field: 'category', enabled: false },
        { field: 'position', enabled: false },
        { field: 'layer', enabled: false },
        { field: 'height', enabled: false },
      ];
      render(<SortOrderConfig sortOrder={customOrder} onChange={() => {}} />);

      expect(screen.getByText(/Size → Label/)).toBeInTheDocument();
    });

    it('shows single field without arrow', () => {
      const singleEnabled: BinListSortOrder = [
        { field: 'category', enabled: true },
        { field: 'position', enabled: false },
        { field: 'layer', enabled: false },
        { field: 'size', enabled: false },
        { field: 'height', enabled: false },
        { field: 'label', enabled: false },
      ];
      render(<SortOrderConfig sortOrder={singleEnabled} onChange={() => {}} />);

      expect(screen.getByText('Sorting by: Category')).toBeInTheDocument();
    });
  });
});
