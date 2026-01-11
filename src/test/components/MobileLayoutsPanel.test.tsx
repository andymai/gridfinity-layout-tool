import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MobileLayoutsPanel } from '../../components/mobile/MobileLayoutsPanel';
import { useLibraryStore } from '../../store/library';
import { useLayoutStore } from '../../store/layout';
import { useUIStore } from '../../store/ui';
import { createDefaultLayout } from '../../constants';
import * as storage from '../../utils/storage';
import type { LayoutLibrary, LayoutEntry } from '../../types';

// Mock the storage module
vi.mock('../../utils/storage', () => ({
  saveLayoutById: vi.fn(),
  loadLayoutById: vi.fn(),
  deleteLayoutById: vi.fn(),
  saveLibrary: vi.fn(),
  computeLayoutPreview: vi.fn(() => ({
    drawerWidth: 10,
    drawerDepth: 8,
    drawerHeight: 12,
    binCount: 0,
    layerCount: 1,
  })),
  getLayoutStorageKey: vi.fn((id: string) => `gridfinity-layout-${id}`),
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

function createTestEntry(id: string, name: string, modifiedAt?: number): LayoutEntry {
  return {
    id,
    name,
    createdAt: Date.now() - 10000,
    modifiedAt: modifiedAt || Date.now(),
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 5,
      layerCount: 2,
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

describe('MobileLayoutsPanel', () => {
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
      activeMobilePanel: 'layouts',
      liveMessage: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders layout count', () => {
      render(<MobileLayoutsPanel />);
      expect(screen.getByText('2 layouts')).toBeInTheDocument();
    });

    it('renders all layouts', () => {
      render(<MobileLayoutsPanel />);
      expect(screen.getByText('Test Layout')).toBeInTheDocument();
      expect(screen.getByText('Second Layout')).toBeInTheDocument();
    });

    it('shows active badge on current layout', () => {
      render(<MobileLayoutsPanel />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('renders preview info for each layout', () => {
      render(<MobileLayoutsPanel />);
      // Should show dimensions
      expect(screen.getAllByText('10×8').length).toBeGreaterThan(0);
      // Should show bin count
      expect(screen.getAllByText('5 bins').length).toBeGreaterThan(0);
    });

    it('renders create new button', () => {
      render(<MobileLayoutsPanel />);
      expect(screen.getByRole('button', { name: /new layout/i })).toBeInTheDocument();
    });
  });

  describe('layout selection', () => {
    it('switches to selected layout', async () => {
      vi.mocked(storage.loadLayoutById).mockReturnValue(createDefaultLayout());

      render(<MobileLayoutsPanel />);

      const secondLayout = screen.getByText('Second Layout');
      act(() => {
        fireEvent.click(secondLayout);
      });

      await waitFor(() => {
        expect(useLayoutStore.getState().activeLayoutId).toBe(SECOND_LAYOUT_ID);
      });
    });

    it('closes panel after switching', async () => {
      vi.mocked(storage.loadLayoutById).mockReturnValue(createDefaultLayout());

      render(<MobileLayoutsPanel />);

      act(() => {
        fireEvent.click(screen.getByText('Second Layout'));
      });

      await waitFor(() => {
        expect(useUIStore.getState().activeMobilePanel).toBeNull();
      });
    });

    it('does not switch when clicking active layout', () => {
      render(<MobileLayoutsPanel />);

      const closePanelBefore = useUIStore.getState().activeMobilePanel;

      act(() => {
        fireEvent.click(screen.getByText('Test Layout'));
      });

      // Panel should still be open (not closed by switch)
      expect(useUIStore.getState().activeMobilePanel).toBe(closePanelBefore);
    });
  });

  describe('create new layout', () => {
    it('creates new layout when clicking button', async () => {
      const entriesBefore = useLibraryStore.getState().library.entries.length;

      render(<MobileLayoutsPanel />);

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
      });

      await waitFor(() => {
        expect(useLibraryStore.getState().library.entries.length).toBe(entriesBefore + 1);
      });
    });

    it('closes panel after creating', async () => {
      render(<MobileLayoutsPanel />);

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
      });

      await waitFor(() => {
        expect(useUIStore.getState().activeMobilePanel).toBeNull();
      });
    });
  });

  describe('duplicate layout', () => {
    it('shows visible duplicate button for active layout', () => {
      render(<MobileLayoutsPanel />);

      // Active layout should have visible duplicate button with text "Duplicate"
      expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    });

    it('duplicates layout when clicking visible duplicate button', async () => {
      vi.mocked(storage.loadLayoutById).mockReturnValue(createDefaultLayout());
      const entriesBefore = useLibraryStore.getState().library.entries.length;

      render(<MobileLayoutsPanel />);

      // Click the visible duplicate button (has text "Duplicate")
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
      });

      await waitFor(() => {
        expect(useLibraryStore.getState().library.entries.length).toBe(entriesBefore + 1);
      });
    });
  });

  describe('delete layout', () => {
    it('shows confirmation dialog when deleting', async () => {
      render(<MobileLayoutsPanel />);

      // Find and click a delete button (from swipe action area)
      const deleteButtons = screen.getAllByLabelText(/delete/i);
      act(() => {
        fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      });

      await waitFor(() => {
        expect(screen.getByText(/delete layout/i)).toBeInTheDocument();
      });
    });

    it('deletes layout on confirmation', async () => {
      render(<MobileLayoutsPanel />);

      // Open delete dialog
      const deleteButtons = screen.getAllByLabelText(/delete/i);
      act(() => {
        fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      });

      await waitFor(() => {
        expect(screen.getByText(/delete layout/i)).toBeInTheDocument();
      });

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      act(() => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(useLibraryStore.getState().library.entries.length).toBe(1);
      });
    });

    it('cancels deletion on cancel', async () => {
      const entriesBefore = useLibraryStore.getState().library.entries.length;

      render(<MobileLayoutsPanel />);

      // Open delete dialog
      const deleteButtons = screen.getAllByLabelText(/delete/i);
      act(() => {
        fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      });

      await waitFor(() => {
        expect(screen.getByText(/delete layout/i)).toBeInTheDocument();
      });

      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      act(() => {
        fireEvent.click(cancelButton);
      });

      expect(useLibraryStore.getState().library.entries.length).toBe(entriesBefore);
    });
  });

  describe('single layout', () => {
    beforeEach(() => {
      useLibraryStore.setState({
        library: createTestLibrary([createTestEntry(TEST_LAYOUT_ID, 'Only Layout')]),
        isLoaded: true,
        showLayoutManager: false,
      });
    });

    it('renders singular layout count', () => {
      render(<MobileLayoutsPanel />);
      expect(screen.getByText('1 layout')).toBeInTheDocument();
    });

    it('disables delete button for only layout', () => {
      render(<MobileLayoutsPanel />);

      const deleteButtons = screen.getAllByLabelText(/delete/i);
      deleteButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('forked layout info', () => {
    beforeEach(() => {
      const entryWithFork = createTestEntry(TEST_LAYOUT_ID, 'Forked Layout');
      entryWithFork.forkedFrom = { name: 'Original', author: 'Someone' };

      useLibraryStore.setState({
        library: createTestLibrary([entryWithFork]),
        isLoaded: true,
        showLayoutManager: false,
      });
    });

    it('shows forked from info', () => {
      render(<MobileLayoutsPanel />);
      expect(screen.getByText(/forked from original/i)).toBeInTheDocument();
    });
  });

  describe('screen reader announcements', () => {
    it('announces when layout is created', async () => {
      render(<MobileLayoutsPanel />);

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
      });

      await waitFor(() => {
        const liveMessage = useUIStore.getState().liveMessage;
        expect(liveMessage).toContain('created');
      });
    });
  });
});
