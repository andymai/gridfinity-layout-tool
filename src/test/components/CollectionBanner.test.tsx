import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { CollectionBanner } from '../../components/CollectionBanner';
import { useCollectionStore } from '../../store/collection';
import { useLayoutStore } from '../../store/layout';
import { useToastStore } from '../../store/toast';
import { useUIStore } from '../../store/ui';
import type { Collection, CollectionLayout } from '../../api/collection';

// Mock useCollectionRouting hook
const mockExitCollection = vi.fn();
const mockNavigateToCollection = vi.fn();
vi.mock('../../hooks/useCollectionRouting', () => ({
  useCollectionRouting: () => ({
    exitCollection: mockExitCollection,
    navigateToCollection: mockNavigateToCollection,
    isLoading: false,
    isSyncing: false,
  }),
}));

// Mock useCollectionSync hook
const mockResolveConflict = vi.fn();
let mockSyncStatus = 'idle';
let mockConflict: { layoutId: string; layoutName: string; serverModifiedAt: number } | null = null;
let mockActiveEditors = new Map<string, number>();

vi.mock('../../hooks/useCollectionSync', () => ({
  useCollectionSync: () => ({
    status: mockSyncStatus,
    conflict: mockConflict,
    activeEditors: mockActiveEditors,
    resolveConflict: mockResolveConflict,
    lastSyncAt: null,
    onLayoutChange: vi.fn(),
    pushChanges: vi.fn(),
    poll: vi.fn(),
    isOnline: true,
  }),
}));

// Mock usePartySync hook
vi.mock('../../hooks/usePartySync', () => ({
  usePartySync: () => ({
    isConnected: false,
    activeEditors: {},
    totalConnections: 0,
    sendPresence: vi.fn(),
  }),
}));

// Mock storage functions
vi.mock('../../utils/storage', () => ({
  copyToClipboard: vi.fn(() => Promise.resolve(true)),
}));

// Mock URL utilities
vi.mock('../../utils/url', () => ({
  generateCollectionURL: vi.fn((id: string) => `https://example.com/c/${id}`),
}));

const mockCollection: Collection = {
  id: 'abc123def456',
  name: 'Test Collection',
  layoutCount: 3,
  createdAt: Date.now(),
  modifiedAt: Date.now(),
};

const mockLayouts: CollectionLayout[] = [
  { id: 'layout1', name: 'Layout 1', createdAt: Date.now(), modifiedAt: Date.now() },
  { id: 'layout2', name: 'Layout 2', createdAt: Date.now(), modifiedAt: Date.now() },
  { id: 'layout3', name: 'Layout 3', createdAt: Date.now(), modifiedAt: Date.now() },
];

describe('CollectionBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset sync mock values
    mockSyncStatus = 'idle';
    mockConflict = null;
    mockActiveEditors = new Map<string, number>();

    // Reset collection store
    useCollectionStore.setState({
      activeCollection: null,
      activeCollectionLayouts: [],
      loadingState: 'idle',
    });

    // Reset layout store
    useLayoutStore.setState({
      activeLayoutId: 'layout1',
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
    it('does not render when activeCollection is null', () => {
      useCollectionStore.setState({ activeCollection: null });

      const { container } = render(<CollectionBanner />);

      expect(container.firstChild).toBeNull();
    });

    it('renders when activeCollection is set', () => {
      useCollectionStore.setState({
        activeCollection: mockCollection,
        activeCollectionLayouts: mockLayouts,
      });

      render(<CollectionBanner />);

      expect(screen.getByText(/Collection:/)).toBeInTheDocument();
      expect(screen.getByText('Test Collection')).toBeInTheDocument();
    });
  });

  describe('content', () => {
    beforeEach(() => {
      useCollectionStore.setState({
        activeCollection: mockCollection,
        activeCollectionLayouts: mockLayouts,
      });
    });

    it('displays the collection name', () => {
      render(<CollectionBanner />);

      expect(screen.getByText('Test Collection')).toBeInTheDocument();
    });

    it('displays the layout count', () => {
      render(<CollectionBanner />);

      expect(screen.getByText('(3 layouts)')).toBeInTheDocument();
    });

    it('displays singular "layout" when count is 1', () => {
      useCollectionStore.setState({
        activeCollection: { ...mockCollection, layoutCount: 1 },
        activeCollectionLayouts: [mockLayouts[0]],
      });

      render(<CollectionBanner />);

      expect(screen.getByText('(1 layout)')).toBeInTheDocument();
    });

    it('has Invite button', () => {
      render(<CollectionBanner />);

      // Button has aria-label="Invite others to collection"
      expect(screen.getByRole('button', { name: /Invite others to collection/i })).toBeInTheDocument();
    });

    it('has Leave button', () => {
      render(<CollectionBanner />);

      expect(screen.getByRole('button', { name: /Leave collection/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      useCollectionStore.setState({
        activeCollection: mockCollection,
        activeCollectionLayouts: mockLayouts,
      });
    });

    it('has role="banner"', () => {
      render(<CollectionBanner />);

      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('has aria-live="polite" for announcements', () => {
      render(<CollectionBanner />);

      const banner = screen.getByRole('banner');
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });

    it('invite button has accessible label', () => {
      render(<CollectionBanner />);

      expect(screen.getByLabelText(/Invite others to collection/i)).toBeInTheDocument();
    });

    it('leave button has accessible label', () => {
      render(<CollectionBanner />);

      expect(screen.getByLabelText('Leave collection')).toBeInTheDocument();
    });
  });

  describe('invite action', () => {
    beforeEach(() => {
      useCollectionStore.setState({
        activeCollection: mockCollection,
        activeCollectionLayouts: mockLayouts,
      });
    });

    it('opens share dialog when Invite clicked', async () => {
      render(<CollectionBanner />);

      const inviteButton = screen.getByRole('button', { name: /Invite others to collection/i });
      await act(async () => {
        fireEvent.click(inviteButton);
      });

      // Should show the share dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Invite Others')).toBeInTheDocument();
    });

    it('shows collection URL in dialog', async () => {
      render(<CollectionBanner />);

      const inviteButton = screen.getByRole('button', { name: /Invite others to collection/i });
      await act(async () => {
        fireEvent.click(inviteButton);
      });

      // The mocked URL should be displayed
      expect(screen.getByDisplayValue(/example\.com/)).toBeInTheDocument();
    });

    it('copies link when Copy button clicked in dialog', async () => {
      const { copyToClipboard } = await import('../../utils/storage');

      render(<CollectionBanner />);

      const inviteButton = screen.getByRole('button', { name: /Invite others to collection/i });
      await act(async () => {
        fireEvent.click(inviteButton);
      });

      // Click the Copy button in the dialog
      const copyButton = screen.getByRole('button', { name: /Copy/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(copyToClipboard).toHaveBeenCalled();
    });

    it('shows success toast after copying from dialog', async () => {
      render(<CollectionBanner />);

      const inviteButton = screen.getByRole('button', { name: /Invite others to collection/i });
      await act(async () => {
        fireEvent.click(inviteButton);
      });

      // Click the Copy button in the dialog
      const copyButton = screen.getByRole('button', { name: /Copy/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0].type).toBe('success');
    });

    it('shows "Copied!" text in dialog after successful copy', async () => {
      render(<CollectionBanner />);

      const inviteButton = screen.getByRole('button', { name: /Invite others to collection/i });
      await act(async () => {
        fireEvent.click(inviteButton);
      });

      // Click the Copy button in the dialog
      const copyButton = screen.getByRole('button', { name: /Copy/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('closes dialog when Done button clicked', async () => {
      render(<CollectionBanner />);

      const inviteButton = screen.getByRole('button', { name: /Invite others to collection/i });
      await act(async () => {
        fireEvent.click(inviteButton);
      });

      // Click the Done button
      fireEvent.click(screen.getByRole('button', { name: /Done/i }));

      await waitFor(() => {
        expect(screen.queryByText('Invite Others')).not.toBeInTheDocument();
      });
    });
  });

  describe('leave action', () => {
    beforeEach(() => {
      useCollectionStore.setState({
        activeCollection: mockCollection,
        activeCollectionLayouts: mockLayouts,
      });
    });

    it('shows confirmation dialog when clicking Leave', () => {
      render(<CollectionBanner />);

      fireEvent.click(screen.getByRole('button', { name: /Leave collection/i }));

      // Confirmation dialog should appear
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Leave collection?')).toBeInTheDocument();
    });

    it('calls exitCollection after confirming leave', async () => {
      render(<CollectionBanner />);

      // Click leave to show dialog
      fireEvent.click(screen.getByRole('button', { name: /Leave collection/i }));

      // Confirm in dialog (the destructive button)
      const dialog = screen.getByRole('dialog');
      const confirmButton = dialog.querySelector('.btn-danger') as HTMLElement;
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(mockExitCollection).toHaveBeenCalled();
    });

    it('shows info toast after confirming leave', async () => {
      render(<CollectionBanner />);

      // Click leave to show dialog
      fireEvent.click(screen.getByRole('button', { name: /Leave collection/i }));

      // Confirm in dialog
      const dialog = screen.getByRole('dialog');
      const confirmButton = dialog.querySelector('.btn-danger') as HTMLElement;
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0].type).toBe('info');
    });

    it('does not leave when clicking Stay', () => {
      render(<CollectionBanner />);

      // Click leave to show dialog
      fireEvent.click(screen.getByRole('button', { name: /Leave collection/i }));

      // Cancel in dialog
      fireEvent.click(screen.getByRole('button', { name: /Stay/i }));

      expect(mockExitCollection).not.toHaveBeenCalled();
    });
  });

  describe('sync status indicators', () => {
    beforeEach(() => {
      useCollectionStore.setState({
        activeCollection: mockCollection,
        activeCollectionLayouts: mockLayouts,
      });
    });

    it('shows syncing indicator when status is syncing', () => {
      mockSyncStatus = 'syncing';
      render(<CollectionBanner />);

      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });

    it('shows saved indicator when status is synced', () => {
      mockSyncStatus = 'synced';
      render(<CollectionBanner />);

      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('shows offline indicator when status is offline', () => {
      mockSyncStatus = 'offline';
      render(<CollectionBanner />);

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('shows error indicator when status is error', () => {
      mockSyncStatus = 'error';
      render(<CollectionBanner />);

      expect(screen.getByText('Sync error')).toBeInTheDocument();
    });

    it('shows no indicator when status is idle', () => {
      mockSyncStatus = 'idle';
      render(<CollectionBanner />);

      expect(screen.queryByText('Syncing...')).not.toBeInTheDocument();
      expect(screen.queryByText('Saved')).not.toBeInTheDocument();
      expect(screen.queryByText('Offline')).not.toBeInTheDocument();
      expect(screen.queryByText('Sync error')).not.toBeInTheDocument();
    });
  });

  describe('presence indicators', () => {
    beforeEach(() => {
      useCollectionStore.setState({
        activeCollection: mockCollection,
        activeCollectionLayouts: mockLayouts,
      });
      useLayoutStore.setState({
        activeLayoutId: 'layout1',
      });
    });

    it('shows presence indicator when others are editing current layout', () => {
      mockActiveEditors = new Map([['layout1', 2]]);
      render(<CollectionBanner />);

      expect(screen.getByText('2 editing')).toBeInTheDocument();
    });

    it('does not show presence indicator when no one else is editing', () => {
      mockActiveEditors = new Map();
      render(<CollectionBanner />);

      expect(screen.queryByText(/editing/)).not.toBeInTheDocument();
    });

    it('does not show presence indicator for different layout', () => {
      mockActiveEditors = new Map([['layout2', 3]]);
      render(<CollectionBanner />);

      expect(screen.queryByText(/editing/)).not.toBeInTheDocument();
    });

    it('shows correct count for single editor', () => {
      mockActiveEditors = new Map([['layout1', 1]]);
      render(<CollectionBanner />);

      expect(screen.getByText('1 editing')).toBeInTheDocument();
    });
  });

  describe('conflict dialog', () => {
    beforeEach(() => {
      useCollectionStore.setState({
        activeCollection: mockCollection,
        activeCollectionLayouts: mockLayouts,
      });
    });

    it('shows conflict dialog when conflict is present', () => {
      mockConflict = {
        layoutId: 'layout1',
        layoutName: 'Test Layout',
        serverModifiedAt: Date.now() - 60000,
      };
      render(<CollectionBanner />);

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText('Conflict Detected')).toBeInTheDocument();
    });

    it('does not show conflict dialog when no conflict', () => {
      mockConflict = null;
      render(<CollectionBanner />);

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('displays the conflicting layout name', () => {
      mockConflict = {
        layoutId: 'layout1',
        layoutName: 'My Layout',
        serverModifiedAt: Date.now() - 60000,
      };
      render(<CollectionBanner />);

      expect(screen.getByText(/"My Layout"/)).toBeInTheDocument();
    });

    it('calls resolveConflict with save-both when that option is selected', async () => {
      mockConflict = {
        layoutId: 'layout1',
        layoutName: 'Test Layout',
        serverModifiedAt: Date.now() - 60000,
      };
      render(<CollectionBanner />);

      // Click Resolve Conflict button (save-both is default)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Resolve Conflict' }));
      });

      expect(mockResolveConflict).toHaveBeenCalledWith('save-both');
    });

    it('calls resolveConflict with keep-mine when that option is selected', async () => {
      mockConflict = {
        layoutId: 'layout1',
        layoutName: 'Test Layout',
        serverModifiedAt: Date.now() - 60000,
      };
      render(<CollectionBanner />);

      // Select keep-mine option
      fireEvent.click(screen.getByLabelText(/Keep my changes/));

      // Click Resolve Conflict button
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Resolve Conflict' }));
      });

      expect(mockResolveConflict).toHaveBeenCalledWith('keep-mine');
    });

    it('shows success toast after resolving conflict', async () => {
      mockConflict = {
        layoutId: 'layout1',
        layoutName: 'Test Layout',
        serverModifiedAt: Date.now() - 60000,
      };
      render(<CollectionBanner />);

      // Click Resolve Conflict button
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Resolve Conflict' }));
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0].type).toBe('success');
    });
  });
});
