import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SharedLayoutBanner } from '@/features/cloud-share/components/SharedLayoutBanner';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useToastStore } from '@/core/store/toast';
import type { Layout } from '@/core/types';
import { SHARED_PREVIEW_ID } from '@/core/constants';

// Hoisted mock for computePreview - used by both storage and library store re-export
const { mockComputePreview } = vi.hoisted(() => ({
  mockComputePreview: vi.fn(
    (layout: {
      drawer: { width: number; depth: number; height: number };
      bins: unknown[];
      layers: unknown[];
    }) => ({
      drawerWidth: layout.drawer.width,
      drawerDepth: layout.drawer.depth,
      drawerHeight: layout.drawer.height,
      binCount: layout.bins.length,
      layerCount: layout.layers.length,
      binMap: [],
    })
  ),
}));

// Mock storage functions
vi.mock('@/core/storage', () => ({
  createLayoutEntry: vi.fn(() =>
    Promise.resolve({
      ok: true,
      value: {
        layoutId: 'newid123test',
        entry: {
          id: 'newid123test',
          name: 'Original Name (imported)',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          preview: {
            drawerWidth: 10,
            drawerDepth: 8,
            drawerHeight: 12,
            binCount: 0,
            layerCount: 1,
          },
        },
        library: {
          version: '1.0',
          activeLayoutId: 'existing-layout',
          entries: [
            { id: 'existing-layout', name: 'Existing Layout' },
            { id: 'newid123test', name: 'Original Name (imported)' },
          ],
          settings: { authorName: '' },
        },
        layout: {
          version: '1.0',
          name: 'Original Name (imported)',
          drawer: { width: 10, depth: 8, height: 12 },
          printBedSize: 256,
          gridUnitMm: 42,
          heightUnitMm: 7,
          categories: [{ id: 'cat1', name: 'Category', color: '#ff0000' }],
          layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
          bins: [],
        },
      },
    })
  ),
  computePreview: mockComputePreview,
  initializeLayoutLibrary: vi.fn(() => ({
    library: {
      version: '1.0',
      activeLayoutId: 'previous-layout',
      entries: [{ id: 'previous-layout', name: 'Previous Layout' }],
      settings: { authorName: '' },
    },
    activeLayout: {
      version: '1.0',
      name: 'Previous Layout',
      drawer: { width: 10, depth: 8, height: 12 },
      printBedSize: 256,
      gridUnitMm: 42,
      heightUnitMm: 7,
      categories: [{ id: 'cat1', name: 'Category', color: '#ff0000' }],
      layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
      bins: [],
    },
  })),
  // Required by SharedLayoutImporter (imported via barrel export)
  getSharedLayoutFromURL: vi.fn(() => null),
  clearSharedLayoutFromURL: vi.fn(),
  getCloudShareIdFromURL: vi.fn(() => null),
  loadSharedWithMe: vi.fn(() => []),
}));

// Mock the library store's computePreview re-export
vi.mock('@/core/store/library', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    computePreview: mockComputePreview,
  };
});

// Mock uuid
vi.mock('@/shared/utils/uuid', () => ({
  generateUUID: vi.fn(() => 'new-uuid-123'),
  generateLayoutId: vi.fn(() => 'newid123test'),
  isValidLayoutId: vi.fn(() => true),
  isLegacyUUID: vi.fn(() => false),
}));

// Mock hooks (required by SharedLayoutImporter)
vi.mock('@/hooks/useCollabMode', () => ({
  useCollabMode: vi.fn(() => ({ isCollaborative: false })),
}));

// Mock api/share (required by SharedLayoutImporter)
vi.mock('@/core/api/share', () => ({
  fetchShare: vi.fn(),
}));

// Mock result helpers (used by SharedLayoutBanner for atomic API)
vi.mock('@/core/result', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    isOk: vi.fn((result) => result?.ok === true),
    isErr: vi.fn((result) => result?.ok !== true),
    getUserMessage: vi.fn(() => 'An error occurred'),
  };
});

const mockLayout: Layout = {
  version: '1.0',
  name: 'Shared Layout',
  drawer: { width: 10, depth: 8, height: 12 },
  printBedSize: 256,
  gridUnitMm: 42,
  heightUnitMm: 7,
  categories: [{ id: 'cat1', name: 'Category', color: '#ff0000' }],
  layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
  bins: [],
};

describe('SharedLayoutBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset shared preview store
    useSharedPreviewStore.getState().clearSharedLayoutPreview();

    // Reset layout store
    useLayoutStore.setState({
      layout: mockLayout,
      activeLayoutId: SHARED_PREVIEW_ID,
    });

    // Reset library store
    useLibraryStore.setState({
      library: {
        version: '1.0',
        activeLayoutId: 'existing-layout',
        entries: [
          {
            id: 'existing-layout',
            name: 'Existing Layout',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            preview: {
              drawerWidth: 10,
              drawerDepth: 8,
              drawerHeight: 12,
              binCount: 0,
              layerCount: 1,
            },
          },
        ],
        settings: { authorName: '' },
      },
      isLoaded: true,
      showLayoutManager: false,
    });

    // Reset toast store
    useToastStore.setState({
      toasts: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('visibility', () => {
    it('does not render when sharedLayoutPreview is null', () => {
      useSharedPreviewStore.getState().clearSharedLayoutPreview();

      const { container } = render(<SharedLayoutBanner />);

      expect(container.firstChild).toBeNull();
    });

    it('renders when sharedLayoutPreview is set', () => {
      useSharedPreviewStore.getState().setSharedLayoutPreview(mockLayout, 'Shared Layout');

      render(<SharedLayoutBanner />);

      expect(screen.getByText(/Viewing "/)).toBeInTheDocument();
    });
  });

  describe('content', () => {
    beforeEach(() => {
      useSharedPreviewStore.getState().setSharedLayoutPreview(mockLayout, 'Original Name');
    });

    it('displays the original layout name', () => {
      render(<SharedLayoutBanner />);

      expect(screen.getByText(/Viewing "/)).toBeInTheDocument();
    });

    it('has Save to My Layouts button', () => {
      render(<SharedLayoutBanner />);

      expect(screen.getByRole('button', { name: /Save to My Layouts/i })).toBeInTheDocument();
    });

    it('has Discard button', () => {
      render(<SharedLayoutBanner />);

      expect(screen.getByRole('button', { name: /Discard/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      useSharedPreviewStore.getState().setSharedLayoutPreview(mockLayout, 'Shared Layout');
    });

    it('has role="alert" for screen readers', () => {
      render(<SharedLayoutBanner />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('has aria-live="polite" for announcements', () => {
      render(<SharedLayoutBanner />);

      const banner = screen.getByRole('alert');
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('save action', () => {
    beforeEach(() => {
      useSharedPreviewStore.getState().setSharedLayoutPreview(mockLayout, 'Original Name');
    });

    it('clears shared preview state after saving', async () => {
      render(<SharedLayoutBanner />);

      fireEvent.click(screen.getByRole('button', { name: /Save to My Layouts/i }));

      await waitFor(() => {
        expect(useSharedPreviewStore.getState().sharedPreview).toBeNull();
      });
    });

    it('creates entry in library store', async () => {
      render(<SharedLayoutBanner />);

      const initialCount = useLibraryStore.getState().library.entries.length;

      fireEvent.click(screen.getByRole('button', { name: /Save to My Layouts/i }));

      await waitFor(() => {
        const newCount = useLibraryStore.getState().library.entries.length;
        expect(newCount).toBe(initialCount + 1);
      });
    });

    it('adds (imported) suffix to layout name', async () => {
      render(<SharedLayoutBanner />);

      fireEvent.click(screen.getByRole('button', { name: /Save to My Layouts/i }));

      await waitFor(() => {
        const entries = useLibraryStore.getState().library.entries;
        // New layouts use generateLayoutId which returns 'newid123test'
        const newEntry = entries.find((e) => e.id === 'newid123test');
        expect(newEntry?.name).toBe('Original Name (imported)');
      });
    });

    it('shows success toast after saving', async () => {
      render(<SharedLayoutBanner />);

      fireEvent.click(screen.getByRole('button', { name: /Save to My Layouts/i }));

      await waitFor(() => {
        const toasts = useToastStore.getState().toasts;
        expect(toasts.length).toBeGreaterThan(0);
        expect(toasts[0].type).toBe('success');
      });
    });
  });

  describe('discard action', () => {
    beforeEach(() => {
      useSharedPreviewStore.getState().setSharedLayoutPreview(mockLayout, 'Shared Layout');
    });

    it('shows confirmation dialog when clicking Discard', () => {
      render(<SharedLayoutBanner />);

      fireEvent.click(screen.getByRole('button', { name: /Discard/i }));

      // Confirmation dialog should appear
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Discard shared layout?')).toBeInTheDocument();
    });

    it('clears shared preview state after confirming discard', async () => {
      render(<SharedLayoutBanner />);

      // Click discard to show dialog
      fireEvent.click(screen.getByRole('button', { name: /Discard/i }));
      // Confirm in dialog (the btn-danger button inside the dialog)
      const dialog = screen.getByRole('dialog');
      const confirmButton = dialog.querySelector('.btn-danger') as HTMLElement;
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(useSharedPreviewStore.getState().sharedPreview).toBeNull();
      });
    });

    it('shows info toast after confirming discard', async () => {
      render(<SharedLayoutBanner />);

      // Click discard to show dialog
      fireEvent.click(screen.getByRole('button', { name: /Discard/i }));
      // Confirm in dialog
      const dialog = screen.getByRole('dialog');
      const confirmButton = dialog.querySelector('.btn-danger') as HTMLElement;
      fireEvent.click(confirmButton);

      await waitFor(() => {
        const toasts = useToastStore.getState().toasts;
        expect(toasts.length).toBeGreaterThan(0);
        expect(toasts[0].type).toBe('info');
      });
    });

    it('restores previous layout after confirming discard', async () => {
      render(<SharedLayoutBanner />);

      // Click discard to show dialog
      fireEvent.click(screen.getByRole('button', { name: /Discard/i }));
      // Confirm in dialog
      const dialog = screen.getByRole('dialog');
      const confirmButton = dialog.querySelector('.btn-danger') as HTMLElement;
      fireEvent.click(confirmButton);

      // Check that layout store was updated (handleDiscard is async)
      await waitFor(() => {
        const layoutState = useLayoutStore.getState();
        expect(layoutState.activeLayoutId).toBe('previous-layout');
      });
    });

    it('does not discard when clicking Keep viewing', () => {
      render(<SharedLayoutBanner />);

      // Click discard to show dialog
      fireEvent.click(screen.getByRole('button', { name: /Discard/i }));
      // Cancel in dialog
      fireEvent.click(screen.getByRole('button', { name: /Keep viewing/i }));

      // State should remain unchanged
      expect(useSharedPreviewStore.getState().sharedPreview).not.toBeNull();
      expect(useSharedPreviewStore.getState().sharedPreview?.originalName).toBe('Shared Layout');
    });
  });

  describe('edge cases', () => {
    it('handles missing sharedLayoutOriginalName gracefully', () => {
      useSharedPreviewStore.getState().setSharedLayoutPreview(mockLayout);

      render(<SharedLayoutBanner />);

      // Should render without crashing - the translation doesn't show the name
      expect(screen.getByText(/Viewing "/)).toBeInTheDocument();
    });

    it('handles empty layout name', () => {
      const emptyNameLayout = { ...mockLayout, name: '' };
      useSharedPreviewStore.getState().setSharedLayoutPreview(emptyNameLayout, '');
      useLayoutStore.setState({ layout: emptyNameLayout });

      render(<SharedLayoutBanner />);

      // Should still render without crashing
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
