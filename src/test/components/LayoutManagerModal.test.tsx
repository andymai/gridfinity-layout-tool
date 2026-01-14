import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LayoutManagerModal } from '../../components/modals/LayoutManagerModal';
import { useLibraryStore } from '../../store/library';
import { useLayoutStore } from '../../store/layout';
import { useUIStore } from '../../store/ui';
import { createDefaultLayout } from '../../constants';
import * as storage from '../../storage';
import type { LayoutLibrary, LayoutEntry } from '../../types';

// Mock the storage module
vi.mock('../../storage', () => ({
  saveLayoutById: vi.fn(),
  saveLayoutByIdAsync: vi.fn().mockResolvedValue(undefined),
  loadLayoutById: vi.fn(),
  loadLayoutByIdAsync: vi.fn(),
  deleteLayoutById: vi.fn(),
  deleteLayoutByIdAsync: vi.fn().mockResolvedValue(undefined),
  saveLibrary: vi.fn(),
  computeLayoutPreview: vi.fn(() => ({
    drawerWidth: 10,
    drawerDepth: 8,
    drawerHeight: 12,
    binCount: 0,
    layerCount: 1,
  })),
  getLayoutStorageKey: vi.fn((id: string) => `gridfinity-layout-${id}`),
  downloadLayoutAsFile: vi.fn(),
}));

// Mock validation
vi.mock('../../utils/validation', async () => {
  const actual = await vi.importActual('../../utils/validation');
  return {
    ...actual,
    validateLayoutIntegrity: vi.fn(() => ({ valid: true })),
  };
});

const TEST_LAYOUT_ID = 'test-layout-id';
const SECOND_LAYOUT_ID = 'second-layout-id';

function createTestEntry(id: string, name: string): LayoutEntry {
  return {
    id,
    name,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 0,
      layerCount: 1,
    },
  };
}

function createTestLibrary(entries: LayoutEntry[]): LayoutLibrary {
  return {
    version: '1.0',
    activeLayoutId: entries[0]?.id || '',
    settings: {},
    entries,
  };
}

describe('LayoutManagerModal Accessibility', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({
      layout: defaultLayout,
      activeLayoutId: TEST_LAYOUT_ID,
    });

    useLibraryStore.setState({
      library: createTestLibrary([
        createTestEntry(TEST_LAYOUT_ID, 'Test Layout'),
        createTestEntry(SECOND_LAYOUT_ID, 'Second Layout'),
      ]),
      isLoaded: true,
      showLayoutManager: false,
    });

    useUIStore.setState({
      liveMessage: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ARIA attributes', () => {
    it('has role="dialog" and aria-modal', () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'layout-manager-title');

      const title = screen.getByText('Layouts');
      expect(title).toHaveAttribute('id', 'layout-manager-title');
    });

    it('layout list has role="listbox" with aria-label', () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Available layouts');
    });

    it('layout items have role="option" with aria-selected', () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      const options = screen.getAllByRole('option');
      expect(options.length).toBe(2);

      // Active layout should have aria-selected="true"
      const activeOption = options.find(opt => opt.getAttribute('aria-selected') === 'true');
      expect(activeOption).toBeInTheDocument();
    });

    it('action buttons are accessible via overflow menu', () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Each layout has an actions menu button (now labeled "More actions for X")
      const actionButtons = screen.getAllByLabelText(/^More actions for/);
      expect(actionButtons.length).toBe(2);

      // Open the menu for the first layout
      act(() => {
        fireEvent.click(actionButtons[0]);
      });

      // Menu items should be visible
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Rename/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Duplicate/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Delete/i })).toBeInTheDocument();
    });

    it('close button has accessible label', () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByLabelText('Close layouts dialog')).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('focuses close button on mount', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(document.activeElement).toHaveAttribute('aria-label', 'Close layouts dialog');
      });
    });

    it('closes on Escape key', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('arrow keys navigate layout list', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Focus first layout item
      const firstOption = screen.getAllByRole('option')[0];
      const listbox = screen.getByRole('listbox');
      act(() => {
        firstOption.focus();
      });

      // Fire keydown on the listbox (where the keyboard handler is attached)
      act(() => {
        fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      });

      await waitFor(() => {
        const secondOption = screen.getAllByRole('option')[1];
        expect(document.activeElement).toBe(secondOption);
      });
    });

    it('Enter key activates focused layout', async () => {
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(createDefaultLayout());

      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Focus second layout
      const secondOption = screen.getAllByRole('option')[1];
      secondOption.focus();

      fireEvent.keyDown(secondOption, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('focus trapping', () => {
    it('traps focus within modal', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Get all focusable elements
      const dialog = screen.getByRole('dialog');
      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled])'
      );

      expect(focusableElements.length).toBeGreaterThan(0);

      // Focus last element
      act(() => {
        focusableElements[focusableElements.length - 1].focus();
      });

      // Tab should wrap to first element
      act(() => {
        fireEvent.keyDown(document, { key: 'Tab' });
      });

      await waitFor(() => {
        expect(document.activeElement).toBe(focusableElements[0]);
      });
    });

    it('shift+tab wraps to last element from first', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled])'
      );

      // Focus first element
      act(() => {
        focusableElements[0].focus();
      });

      // Shift+Tab should wrap to last element
      act(() => {
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      });

      await waitFor(() => {
        expect(document.activeElement).toBe(focusableElements[focusableElements.length - 1]);
      });
    });
  });

  describe('screen reader announcements', () => {
    it('announces when dialog opens', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const liveMessage = useUIStore.getState().liveMessage;
        expect(liveMessage).toContain('Layouts dialog opened');
      });
    });

    it('shows confirmation text when delete clicked', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Open menu for first layout
      const actionButtons = screen.getAllByLabelText(/^More actions for/);
      act(() => {
        fireEvent.click(actionButtons[0]);
      });

      // Click delete in menu
      const deleteButton = screen.getByRole('menuitem', { name: /Delete/i });
      act(() => {
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Click to confirm/i)).toBeInTheDocument();
      });
    });
  });

  describe('rename accessibility', () => {
    it('input has aria-label', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Open menu for first layout
      const actionButtons = screen.getAllByLabelText(/^More actions for/);
      act(() => {
        fireEvent.click(actionButtons[0]);
      });

      const renameButton = screen.getByRole('menuitem', { name: /Rename/i });
      act(() => {
        fireEvent.click(renameButton);
      });

      await waitFor(() => {
        const input = screen.getByRole('textbox', { name: /Layout name/i });
        expect(input).toHaveAttribute('aria-label', 'Layout name');
      });
    });

    it('focuses input when rename starts', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Open menu for first layout
      const actionButtons = screen.getAllByLabelText(/^More actions for/);
      act(() => {
        fireEvent.click(actionButtons[0]);
      });

      const renameButton = screen.getByRole('menuitem', { name: /Rename/i });
      act(() => {
        fireEvent.click(renameButton);
      });

      await waitFor(() => {
        const input = screen.getByRole('textbox', { name: /Layout name/i });
        expect(document.activeElement).toBe(input);
      });
    });
  });

  describe('does not render when closed', () => {
    it('returns null when isOpen is false', () => {
      const { container } = render(<LayoutManagerModal isOpen={false} onClose={mockOnClose} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('tab navigation', () => {
    it('shows layouts tab by default', () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      const layoutsTab = screen.getByRole('tab', { name: /My Layouts/i });
      expect(layoutsTab).toHaveAttribute('aria-selected', 'true');
    });

    it('switches to import tab when clicked', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      const importTab = screen.getByRole('tab', { name: /Import/i });
      act(() => {
        fireEvent.click(importTab);
      });

      await waitFor(() => {
        expect(importTab).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('switches back to layouts tab', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Switch to import tab
      const importTab = screen.getByRole('tab', { name: /Import/i });
      act(() => {
        fireEvent.click(importTab);
      });

      // Switch back to layouts
      const layoutsTab = screen.getByRole('tab', { name: /My Layouts/i });
      act(() => {
        fireEvent.click(layoutsTab);
      });

      await waitFor(() => {
        expect(layoutsTab).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  describe('layout actions', () => {
    it('switches layout when clicking a different layout', async () => {
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(createDefaultLayout());

      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      const options = screen.getAllByRole('option');
      // Click the second layout (not currently active)
      act(() => {
        fireEvent.click(options[1]);
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('creates new layout when clicking New Layout button', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      const newLayoutButton = screen.getByRole('button', { name: /New Layout/i });
      act(() => {
        fireEvent.click(newLayoutButton);
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('duplicates layout from menu', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Open menu for first layout
      const actionButtons = screen.getAllByLabelText(/^More actions for/);
      act(() => {
        fireEvent.click(actionButtons[0]);
      });

      // Click duplicate
      const duplicateButton = screen.getByRole('menuitem', { name: /Duplicate/i });
      act(() => {
        fireEvent.click(duplicateButton);
      });

      // Verify library has 3 entries now
      await waitFor(() => {
        const library = useLibraryStore.getState().library;
        expect(library.entries.length).toBe(3);
      });
    });

    it('renames layout', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Open menu for first layout
      const actionButtons = screen.getAllByLabelText(/^More actions for/);
      act(() => {
        fireEvent.click(actionButtons[0]);
      });

      // Click rename
      const renameButton = screen.getByRole('menuitem', { name: /Rename/i });
      act(() => {
        fireEvent.click(renameButton);
      });

      // Type new name
      const input = await screen.findByRole('textbox', { name: /Layout name/i });
      act(() => {
        fireEvent.change(input, { target: { value: 'New Name' } });
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      await waitFor(() => {
        const library = useLibraryStore.getState().library;
        expect(library.entries[0].name).toBe('New Name');
      });
    });

    it('deletes layout after confirmation', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Open menu for second layout (can't delete the only/active layout)
      const actionButtons = screen.getAllByLabelText(/^More actions for/);
      act(() => {
        fireEvent.click(actionButtons[1]);
      });

      // First click on delete - enters confirmation
      const deleteButton = screen.getByRole('menuitem', { name: /Delete/i });
      act(() => {
        fireEvent.click(deleteButton);
      });

      // Click again to confirm
      await waitFor(() => {
        expect(screen.getByText(/Click to confirm/i)).toBeInTheDocument();
      });

      act(() => {
        fireEvent.click(screen.getByText(/Click to confirm/i));
      });

      await waitFor(() => {
        const library = useLibraryStore.getState().library;
        expect(library.entries.length).toBe(1);
      });
    });
  });

  describe('backdrop interaction', () => {
    it('closes when clicking backdrop', () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      const backdrop = screen.getByRole('presentation');
      act(() => {
        fireEvent.click(backdrop);
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not close when clicking inside modal', () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      act(() => {
        fireEvent.click(dialog);
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
