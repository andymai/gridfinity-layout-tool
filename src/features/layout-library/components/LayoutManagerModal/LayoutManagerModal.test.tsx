import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { LayoutManagerModal } from '@/features/layout-library/components/LayoutManagerModal';
import { useLibraryStore } from '@/core/store/library';
import { useLayoutStore } from '@/core/store/layout';
import { useInteractionStore } from '@/core/store/interaction';
import { createDefaultLayout } from '@/core/constants';
import * as storage from '@/core/storage';
import type { LayoutLibrary, LayoutEntry } from '@/core/types';

// Mock the storage module
vi.mock('@/core/storage', () => {
  const mockPreview = {
    drawerWidth: 10,
    drawerDepth: 8,
    drawerHeight: 12,
    binCount: 0,
    layerCount: 1,
    binMap: [],
  };

  return {
    // Storage functions
    saveLayoutSync: vi.fn(),
    saveLayoutAsync: vi.fn().mockResolvedValue(undefined),
    loadLayoutSync: vi.fn(),
    loadLayoutAsync: vi.fn(),
    deleteLayoutSync: vi.fn(),
    deleteLayoutAsync: vi.fn().mockResolvedValue(undefined),
    saveLibrary: vi.fn(),
    computeLayoutPreview: vi.fn(() => mockPreview),
    getLayoutStorageKey: vi.fn((id: string) => `gridfinity-layout-${id}`),
    downloadLayoutAsFile: vi.fn(),

    // Atomic functions used by useLayoutSwitcher
    saveLayoutWithMetadata: vi
      .fn()
      .mockImplementation(
        (layoutId: string, _layout: unknown, library: { entries: Array<{ id: string }> }) => {
          const entry = library.entries.find((e: { id: string }) => e.id === layoutId);
          if (!entry) {
            return Promise.resolve({ ok: false, error: { code: 'STORAGE_NOT_FOUND' } });
          }
          return Promise.resolve({
            ok: true,
            value: {
              layoutId,
              entry: { ...entry, modifiedAt: Date.now(), preview: mockPreview },
              library,
            },
          });
        }
      ),
    createLayoutEntry: vi.fn().mockImplementation(
      (
        layout: {
          name: string;
          layers: Array<{ id: string }>;
          categories: Array<{ id: string }>;
        },
        library: { entries: unknown[] }
      ) => {
        const layoutId = 'new-layout-id';
        const entry = {
          id: layoutId,
          name: layout.name,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          preview: mockPreview,
        };
        return Promise.resolve({
          ok: true,
          value: {
            layoutId,
            entry,
            library: { ...library, entries: [...library.entries, entry] },
            layout,
          },
        });
      }
    ),
    deleteLayoutWithEntry: vi
      .fn()
      .mockImplementation(
        (layoutId: string, library: { entries: Array<{ id: string }>; activeLayoutId: string }) => {
          const remainingEntries = library.entries.filter((e: { id: string }) => e.id !== layoutId);
          const newActiveId =
            library.activeLayoutId === layoutId ? remainingEntries[0]?.id : undefined;
          return Promise.resolve({
            ok: true,
            value: {
              library: { ...library, entries: remainingEntries },
              newActiveId,
            },
          });
        }
      ),
    duplicateLayoutEntry: vi
      .fn()
      .mockImplementation(
        (sourceId: string, library: { entries: Array<{ id: string; name: string }> }) => {
          const sourceEntry = library.entries.find((e: { id: string }) => e.id === sourceId);
          if (!sourceEntry) {
            return Promise.resolve({ ok: false, error: { code: 'STORAGE_NOT_FOUND' } });
          }
          const layoutId = 'duplicated-layout-id';
          const newEntry = {
            id: layoutId,
            name: `${sourceEntry.name} (copy)`,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            preview: mockPreview,
          };
          return Promise.resolve({
            ok: true,
            value: {
              layoutId,
              entry: newEntry,
              library: { ...library, entries: [...library.entries, newEntry] },
              layout: {
                name: newEntry.name,
                layers: [{ id: 'layer-1' }],
                categories: [{ id: 'cat-1' }],
              },
            },
          });
        }
      ),
    switchActiveLayout: vi
      .fn()
      .mockImplementation(
        (
          _fromId: string,
          _fromLayout: unknown,
          toId: string,
          library: { entries: Array<{ id: string }> }
        ) => {
          const targetEntry = library.entries.find((e: { id: string }) => e.id === toId);
          if (!targetEntry) {
            return Promise.resolve({ ok: false, error: { code: 'STORAGE_NOT_FOUND' } });
          }
          return Promise.resolve({
            ok: true,
            value: {
              library: { ...library, activeLayoutId: toId },
              targetLayout: {
                name: 'Target Layout',
                layers: [{ id: 'layer-1' }],
                categories: [{ id: 'cat-1' }],
                bins: [],
              },
              targetEntry,
            },
          });
        }
      ),
    renameLayoutEntry: vi
      .fn()
      .mockImplementation(
        (
          layoutId: string,
          newName: string,
          library: { entries: Array<{ id: string; name: string }> }
        ) => {
          const updatedEntries = library.entries.map((e: { id: string; name: string }) =>
            e.id === layoutId ? { ...e, name: newName, modifiedAt: Date.now() } : e
          );
          return { ok: true, value: { ...library, entries: updatedEntries } };
        }
      ),
    updateCloudShare: vi.fn(() => ({ ok: true, value: {} })),
    computePreview: vi.fn(() => mockPreview),
    getSharedLayoutFromURL: vi.fn(() => null),
    getCloudShareIdFromURL: vi.fn(() => null),
  };
});

// Mock validation
vi.mock('@/utils/validation', async () => {
  const actual = await vi.importActual('../../utils/validation');
  return {
    ...actual,
    validateLayoutIntegrity: vi.fn(() => ({ valid: true })),
  };
});

// Mock ML tracking
vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: {
    trackSnapshot: vi.fn(),
    trackQuality: vi.fn(),
    trackPlacement: vi.fn(),
    trackLabel: vi.fn(),
    trackBulk: vi.fn(),
    trackPurpose: vi.fn(),
    trackSession: vi.fn(),
    incrementEdit: vi.fn(),
    markActivity: vi.fn(),
  },
}));

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

    useInteractionStore.setState({
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

      // Scope query to the layouts listbox to avoid matching select options
      const listbox = screen.getByRole('listbox', { name: /available layouts/i });
      const options = within(listbox).getAllByRole('option');

      // In grid view: 1 "New Layout" card + 2 layouts = 3 options
      // In list view: 2 layouts = 2 options
      expect(options.length).toBeGreaterThanOrEqual(2);

      // Active layout should have aria-selected="true"
      const activeOption = options.find((opt) => opt.getAttribute('aria-selected') === 'true');
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

      // Get layout options (may include grid items)
      const options = screen.getAllByRole('option');
      const listbox = screen.getByRole('listbox');

      // Find a layout option that's focusable
      const firstLayoutOption = options.find(
        (opt) => opt.getAttribute('data-layout-card') !== null
      );
      expect(firstLayoutOption).toBeTruthy();

      act(() => {
        firstLayoutOption!.focus();
      });

      // Fire keydown on the listbox (where the keyboard handler is attached)
      act(() => {
        fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      });

      // Should navigate to a different element (implementation detail of which one depends on view mode)
      await waitFor(() => {
        expect(document.activeElement).not.toBe(firstLayoutOption);
      });
    });

    it('Enter key activates focused layout', async () => {
      vi.mocked(storage.loadLayoutAsync).mockResolvedValue(createDefaultLayout());

      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Find a non-active layout option
      const options = screen.getAllByRole('option');
      const nonActiveOption = options.find(
        (opt) =>
          opt.getAttribute('aria-selected') !== 'true' &&
          opt.getAttribute('data-layout-card') !== null
      );
      expect(nonActiveOption).toBeTruthy();

      nonActiveOption!.focus();
      fireEvent.keyDown(nonActiveOption!, { key: 'Enter' });

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
        const liveMessage = useInteractionStore.getState().liveMessage;
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
        expect(screen.getByText(/Delete Layout/i)).toBeInTheDocument();
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

  describe('view navigation', () => {
    it('shows layouts view by default', () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Layouts')).toBeInTheDocument();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('switches to import view when Import button clicked', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      const importButton = screen.getByRole('button', { name: /Import/i });
      act(() => {
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Import')).toBeInTheDocument();
      });
    });

    it('switches back to layouts via back button', async () => {
      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Switch to import view
      const importButton = screen.getByRole('button', { name: /Import/i });
      act(() => {
        fireEvent.click(importButton);
      });

      // Click back button
      const backButton = screen.getByRole('button', { name: /Back to layouts/i });
      act(() => {
        fireEvent.click(backButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });
  });

  describe('layout actions', () => {
    it('switches layout when clicking a different layout', async () => {
      vi.mocked(storage.loadLayoutAsync).mockResolvedValue(createDefaultLayout());

      render(<LayoutManagerModal isOpen={true} onClose={mockOnClose} />);

      // Find a non-active layout option to click
      const options = screen.getAllByRole('option');
      const nonActiveOption = options.find(
        (opt) =>
          opt.getAttribute('aria-selected') !== 'true' &&
          opt.getAttribute('data-layout-card') !== null
      );
      expect(nonActiveOption).toBeTruthy();

      act(() => {
        fireEvent.click(nonActiveOption!);
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
        expect(screen.getByText(/Delete Layout/i)).toBeInTheDocument();
      });

      act(() => {
        fireEvent.click(screen.getByText(/Delete Layout/i));
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

      // Multiple elements may have role="presentation"; the backdrop is the first (outermost) one
      const backdrop = screen.getAllByRole('presentation')[0];
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
