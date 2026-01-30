import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SharedWithMeItem } from '@/features/layout-library/components/LayoutManagerModal/SharedWithMeItem';
import type { SharedWithMeEntry } from '@/core/types';

// Mock LayoutThumbnail since it's visual-only
vi.mock('@/components/LayoutThumbnail', () => ({
  LayoutThumbnail: ({ preview, size }: { preview: unknown; size: number }) => (
    <div data-testid="layout-thumbnail" data-size={size} data-preview={JSON.stringify(preview)} />
  ),
}));

describe('SharedWithMeItem', () => {
  const mockOnOpen = vi.fn();
  const mockOnRemove = vi.fn();
  const mockOnFocus = vi.fn();

  const baseEntry: SharedWithMeEntry = {
    sourceShareId: 'share-123',
    name: 'Test Layout',
    permission: 'view',
    status: 'active',
    authorName: 'John Doe',
    lastAccessedAt: Date.now(),
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 5,
      bins: [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('date formatting', () => {
    it('displays "Today" for same-day timestamps', () => {
      const entry = { ...baseEntry, lastAccessedAt: Date.now() };
      render(
        <SharedWithMeItem
          entry={entry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );
      expect(screen.getByText(/Accessed/)).toBeInTheDocument();
      expect(screen.getByText(/Today/)).toBeInTheDocument();
    });

    it('displays "Yesterday" for 1-day-old timestamps', () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      const entry = { ...baseEntry, lastAccessedAt: yesterday };
      render(
        <SharedWithMeItem
          entry={entry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );
      expect(screen.getByText(/Accessed/)).toBeInTheDocument();
      expect(screen.getByText(/Yesterday/)).toBeInTheDocument();
    });

    it('displays "2 days ago" for 2-day-old timestamps (lower boundary)', () => {
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const entry = { ...baseEntry, lastAccessedAt: twoDaysAgo };
      render(
        <SharedWithMeItem
          entry={entry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );
      expect(screen.getByText(/Accessed/)).toBeInTheDocument();
      expect(screen.getByText(/2 days ago/)).toBeInTheDocument();
    });

    it('displays "3 days ago" for 3-day-old timestamps (middle of range)', () => {
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const entry = { ...baseEntry, lastAccessedAt: threeDaysAgo };
      render(
        <SharedWithMeItem
          entry={entry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );
      expect(screen.getByText(/Accessed/)).toBeInTheDocument();
      expect(screen.getByText(/3 days ago/)).toBeInTheDocument();
    });

    it('displays formatted date for timestamps older than 7 days', () => {
      const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const entry = { ...baseEntry, lastAccessedAt: tenDaysAgo };
      render(
        <SharedWithMeItem
          entry={entry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );
      // Should show "Accessed" and a formatted date
      expect(screen.getByText(/Accessed/)).toBeInTheDocument();
      expect(screen.getByText(/\d+\/\d+\/\d+/)).toBeInTheDocument();
    });

    it('handles exactly 6 days ago (edge case)', () => {
      const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000;
      const entry = { ...baseEntry, lastAccessedAt: sixDaysAgo };
      render(
        <SharedWithMeItem
          entry={entry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );
      expect(screen.getByText(/Accessed/)).toBeInTheDocument();
      expect(screen.getByText(/6 days ago/)).toBeInTheDocument();
    });

    it('handles exactly 7 days ago (switches to date format)', () => {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const entry = { ...baseEntry, lastAccessedAt: sevenDaysAgo };
      render(
        <SharedWithMeItem
          entry={entry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );
      // Should NOT show "7 days ago", should show formatted date
      expect(screen.queryByText(/7 days ago/)).not.toBeInTheDocument();
      expect(screen.getByText(/Accessed/)).toBeInTheDocument();
      expect(screen.getByText(/\d+\/\d+\/\d+/)).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('calls onOpen when Enter is pressed on active item', async () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={true}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const item = screen.getByRole('option');
      fireEvent.keyDown(item, { key: 'Enter' });

      expect(mockOnOpen).toHaveBeenCalledTimes(1);
    });

    it('calls onOpen when Space is pressed on active item', async () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={true}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const item = screen.getByRole('option');
      fireEvent.keyDown(item, { key: ' ' });

      expect(mockOnOpen).toHaveBeenCalledTimes(1);
    });

    it('prevents default on Enter/Space to avoid scroll', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={true}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const item = screen.getByRole('option');
      // Create a proper KeyboardEvent to check preventDefault
      const preventDefaultSpy = vi.fn();
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: preventDefaultSpy });

      item.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does NOT call onOpen when loading', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={true}
          isLoading={true}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const item = screen.getByRole('option');
      fireEvent.keyDown(item, { key: 'Enter' });

      expect(mockOnOpen).not.toHaveBeenCalled();
    });

    it('does NOT call onOpen when item is deleted', () => {
      const deletedEntry = { ...baseEntry, status: 'deleted' as const };
      render(
        <SharedWithMeItem
          entry={deletedEntry}
          isFocused={true}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const item = screen.getByRole('option');
      fireEvent.keyDown(item, { key: 'Enter' });

      expect(mockOnOpen).not.toHaveBeenCalled();
    });

    it('ignores other key presses', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={true}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const item = screen.getByRole('option');
      fireEvent.keyDown(item, { key: 'Tab' });
      fireEvent.keyDown(item, { key: 'Escape' });
      fireEvent.keyDown(item, { key: 'a' });

      expect(mockOnOpen).not.toHaveBeenCalled();
    });
  });

  describe('click handlers', () => {
    it('calls onOpen when row is clicked', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const item = screen.getByRole('option');
      fireEvent.click(item);

      expect(mockOnOpen).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onOpen when row is clicked while loading', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={true}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const item = screen.getByRole('option');
      fireEvent.click(item);

      expect(mockOnOpen).not.toHaveBeenCalled();
    });

    it('does NOT call onOpen when row is clicked on deleted item', () => {
      const deletedEntry = { ...baseEntry, status: 'deleted' as const };
      render(
        <SharedWithMeItem
          entry={deletedEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const item = screen.getByRole('option');
      fireEvent.click(item);

      expect(mockOnOpen).not.toHaveBeenCalled();
    });

    it('calls onOpen when open button is clicked', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const openButton = screen.getByRole('button', { name: /open layout/i });
      fireEvent.click(openButton);

      expect(mockOnOpen).toHaveBeenCalledTimes(1);
    });

    it('calls onRemove when remove button is clicked', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const removeButton = screen.getByRole('button', { name: /remove from list/i });
      fireEvent.click(removeButton);

      expect(mockOnRemove).toHaveBeenCalledTimes(1);
    });

    it('stops propagation on button clicks to prevent row click', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const removeButton = screen.getByRole('button', { name: /remove from list/i });
      fireEvent.click(removeButton);

      // Should only call onRemove, not onOpen from row click
      expect(mockOnRemove).toHaveBeenCalledTimes(1);
      expect(mockOnOpen).not.toHaveBeenCalled();
    });
  });

  describe('conditional rendering', () => {
    it('displays "Deleted" badge when status is deleted', () => {
      const deletedEntry = { ...baseEntry, status: 'deleted' as const };
      render(
        <SharedWithMeItem
          entry={deletedEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.getByText('Deleted')).toBeInTheDocument();
    });

    it('does NOT display "Deleted" badge when status is active', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.queryByText('Deleted')).not.toBeInTheDocument();
    });

    it('displays "Can edit" badge for edit permission', () => {
      const editEntry = { ...baseEntry, permission: 'edit' as const };
      render(
        <SharedWithMeItem
          entry={editEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.getByText('Can edit')).toBeInTheDocument();
    });

    it('displays "View only" badge for view permission', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.getByText('View only')).toBeInTheDocument();
    });

    it('shows loading spinner when isLoading is true', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={true}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      // Check for the animated spinner SVG
      const openButton = screen.getByRole('button', { name: /open layout/i });
      const spinner = openButton.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('shows open icon when not loading', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const openButton = screen.getByRole('button', { name: /open layout/i });
      const spinner = openButton.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });

    it('disables open button when loading', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={true}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const openButton = screen.getByRole('button', { name: /open layout/i });
      expect(openButton).toBeDisabled();
    });

    it('disables open button when deleted', () => {
      const deletedEntry = { ...baseEntry, status: 'deleted' as const };
      render(
        <SharedWithMeItem
          entry={deletedEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const openButton = screen.getByRole('button', { name: /layout deleted/i });
      expect(openButton).toBeDisabled();
    });

    it('renders thumbnail when preview is provided', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.getByTestId('layout-thumbnail')).toBeInTheDocument();
    });

    it('renders placeholder when no preview', () => {
      const entryWithoutPreview = { ...baseEntry, preview: undefined };
      render(
        <SharedWithMeItem
          entry={entryWithoutPreview}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.queryByTestId('layout-thumbnail')).not.toBeInTheDocument();
    });

    it('displays author name when provided', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.getByText(/Shared by/)).toBeInTheDocument();
    });

    it('does NOT display author when not provided', () => {
      const entryWithoutAuthor = { ...baseEntry, authorName: undefined };
      render(
        <SharedWithMeItem
          entry={entryWithoutAuthor}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.queryByText(/Shared by/)).not.toBeInTheDocument();
    });

    it('displays drawer dimensions when preview is provided', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.getByText('10×8×5')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has correct role="option"', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    it('has tabIndex=0 when focused', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={true}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.getByRole('option')).toHaveAttribute('tabIndex', '0');
    });

    it('has tabIndex=-1 when not focused', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.getByRole('option')).toHaveAttribute('tabIndex', '-1');
    });

    it('calls onFocus callback when item receives focus', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const item = screen.getByRole('option');
      fireEvent.focus(item);

      expect(mockOnFocus).toHaveBeenCalledTimes(1);
    });

    it('buttons have appropriate aria-labels', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.getByRole('button', { name: /open layout/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /remove from list/i })).toBeInTheDocument();
    });

    it('uses item ref callback when provided', () => {
      const mockItemRef = vi.fn();
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
          itemRef={mockItemRef}
        />
      );

      expect(mockItemRef).toHaveBeenCalled();
    });
  });

  describe('visual states', () => {
    it('applies deleted styling (strikethrough, opacity)', () => {
      const deletedEntry = { ...baseEntry, status: 'deleted' as const };
      render(
        <SharedWithMeItem
          entry={deletedEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      const nameElement = screen.getByText('Test Layout');
      expect(nameElement).toHaveClass('line-through');
    });

    it('displays layout name', () => {
      render(
        <SharedWithMeItem
          entry={baseEntry}
          isFocused={false}
          isLoading={false}
          onOpen={mockOnOpen}
          onRemove={mockOnRemove}
          onFocus={mockOnFocus}
        />
      );

      expect(screen.getByText('Test Layout')).toBeInTheDocument();
    });
  });
});
