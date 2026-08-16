import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Header } from '@/shell/Header';
import { useLayoutStore } from '@/core/store';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { useViewStore } from '@/core/store/view';
import { resetAllStores, createTestBin, createTestLayout } from '@/test/testUtils';
import { binId, designId } from '@/core/types';
import type * as SharedHooks from '@/shared/hooks';

// Mock the LayoutManagerModal to avoid deep component tree
// Note: Module is lazy-loaded in Header, so mock must be set up before import
vi.mock('@/features/layout-library/components/LayoutManagerModal', () => ({
  LayoutManagerModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div
        data-testid="layout-manager-modal"
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onClose();
        }}
      >
        Modal
      </div>
    ) : null,
}));

// Mock the LayoutQuickSwitch (depends on the library store / SVG thumbnails).
// Its "Manage" path is what opens the layout manager modal in the header.
vi.mock('@/features/layout-library/components/LayoutQuickSwitch', () => ({
  LayoutQuickSwitch: ({ onManage }: { onManage: () => void }) => (
    <button aria-label="Open layout manager" onClick={onManage}>
      Layouts
    </button>
  ),
}));

// Mock the PrintModal to avoid deep component tree
vi.mock('@/features/print-export/components/PrintModal', () => ({
  PrintModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div
        data-testid="print-modal"
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onClose();
        }}
      >
        Print Modal
      </div>
    ) : null,
}));

// Mock the LayoutExportDialog — the real one pulls the 3D kernel
vi.mock('@/shell/layoutExport/LayoutExportDialog', () => ({
  LayoutExportDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div
        data-testid="layout-export-dialog"
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onClose();
        }}
      >
        Layout Export Dialog
      </div>
    ) : null,
}));

let mockIsCollaborative = false;

vi.mock('@/shared/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedHooks>();
  return {
    ...actual,
    useResponsive: () => ({ isTablet: false, isMobile: false }),
  };
});

vi.mock('@/shared/hooks/useCollabMode', () => ({
  useCollabMode: () => ({ isCollaborative: mockIsCollaborative, canEdit: true, shareId: null }),
}));

vi.mock('@/features/cloud-share/components/ShareButton', () => ({
  ShareButton: () => <button data-testid="share-button">Share</button>,
}));

// Mock PresenceAvatars to avoid Liveblocks context requirements
vi.mock('@/shell/Collab', () => ({
  PresenceAvatars: ({ className }: { className?: string }) => (
    <div data-testid="presence-avatars" className={className}>
      Presence
    </div>
  ),
}));

describe('Header', () => {
  const defaultProps = {
    saveStatus: 'idle' as const,
  };

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    mockIsCollaborative = false;
  });

  describe('rendering', () => {
    it('renders tool switcher', () => {
      render(<Header {...defaultProps} />);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('renders layout name', () => {
      useLayoutStore.getState().setName('Test Layout');
      render(<Header {...defaultProps} />);

      expect(screen.getByText('Test Layout')).toBeInTheDocument();
    });

    it('renders undo button', () => {
      render(<Header {...defaultProps} />);

      expect(screen.getByLabelText(/Undo/)).toBeInTheDocument();
    });

    it('renders redo button', () => {
      render(<Header {...defaultProps} />);

      expect(screen.getByLabelText(/Redo/)).toBeInTheDocument();
    });

    it('renders help button', () => {
      render(<Header {...defaultProps} />);

      expect(screen.getByLabelText('Show help and keyboard shortcuts')).toBeInTheDocument();
    });

    it('renders layouts button', () => {
      render(<Header {...defaultProps} />);

      expect(screen.getByLabelText('Open layout manager')).toBeInTheDocument();
    });
  });

  describe('layout name editing', () => {
    it('enters edit mode on name click', () => {
      useLayoutStore.getState().setName('Test Layout');
      render(<Header {...defaultProps} />);

      fireEvent.click(screen.getByText('Test Layout'));

      expect(screen.getByDisplayValue('Test Layout')).toBeInTheDocument();
    });

    it('updates name on blur', () => {
      useLayoutStore.getState().setName('Old Name');
      render(<Header {...defaultProps} />);

      fireEvent.click(screen.getByText('Old Name'));
      const input = screen.getByDisplayValue('Old Name');
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.blur(input);

      expect(useLayoutStore.getState().layout.name).toBe('New Name');
    });

    it('updates name on Enter', () => {
      useLayoutStore.getState().setName('Old Name');
      render(<Header {...defaultProps} />);

      fireEvent.click(screen.getByText('Old Name'));
      const input = screen.getByDisplayValue('Old Name');
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(useLayoutStore.getState().layout.name).toBe('New Name');
    });

    it('cancels edit on Escape', () => {
      useLayoutStore.getState().setName('Old Name');
      render(<Header {...defaultProps} />);

      fireEvent.click(screen.getByText('Old Name'));
      const input = screen.getByDisplayValue('Old Name');
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should revert to old name and exit edit mode
      expect(screen.queryByDisplayValue('New Name')).not.toBeInTheDocument();
      expect(screen.getByText('Old Name')).toBeInTheDocument();
    });

    it('uses default name when empty', () => {
      useLayoutStore.getState().setName('Test');
      render(<Header {...defaultProps} />);

      fireEvent.click(screen.getByText('Test'));
      const input = screen.getByDisplayValue('Test');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      expect(useLayoutStore.getState().layout.name).toBe('Untitled layout');
    });

    it('trims whitespace from name', () => {
      useLayoutStore.getState().setName('Test');
      render(<Header {...defaultProps} />);

      fireEvent.click(screen.getByText('Test'));
      const input = screen.getByDisplayValue('Test');
      fireEvent.change(input, { target: { value: '  Trimmed  ' } });
      fireEvent.blur(input);

      expect(useLayoutStore.getState().layout.name).toBe('Trimmed');
    });
  });

  describe('layout export button', () => {
    const renderWithLinkedBins = (count: number) => {
      useLayoutStore.setState({
        layout: createTestLayout({
          bins: Array.from({ length: count }, (_, i) =>
            createTestBin({
              id: binId(`linked-${i}`),
              linkedDesignId: designId(`design-${i}`),
            })
          ),
        }),
      });
      render(<Header {...defaultProps} />);
    };

    it('renders with a visible label rather than icon-only', () => {
      renderWithLinkedBins(1);

      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('is enabled when at least one bin is linked to a design', () => {
      renderWithLinkedBins(1);

      expect(screen.getByLabelText('Export layout (3D)')).toBeEnabled();
    });

    // Gating the control put its only explanation in a tooltip, which touch
    // devices never render, leaving the export dialog effectively unreachable.
    // LayoutExportDialog carries the empty-state copy, so the button must stay
    // clickable for a user to ever reach it.
    it('stays enabled when no bins are linked', () => {
      useLayoutStore.setState({
        layout: createTestLayout({ bins: [createTestBin({ id: binId('unlinked') })] }),
      });
      render(<Header {...defaultProps} />);

      expect(screen.getByLabelText('Export layout (3D)')).toBeEnabled();
    });

    it('opens the export dialog via the view store', () => {
      renderWithLinkedBins(1);

      expect(useViewStore.getState().layoutExportOpen).toBe(false);
      fireEvent.click(screen.getByLabelText('Export layout (3D)'));

      expect(useViewStore.getState().layoutExportOpen).toBe(true);
    });

    it('opens the dialog with no linked bins, so it can explain the gap', () => {
      useLayoutStore.setState({
        layout: createTestLayout({ bins: [createTestBin({ id: binId('unlinked') })] }),
      });
      render(<Header {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Export layout (3D)'));

      expect(useViewStore.getState().layoutExportOpen).toBe(true);
    });
  });

  describe('undo/redo buttons', () => {
    it('undo button is disabled when canUndo is false', () => {
      render(<Header {...defaultProps} />);

      const undoButton = screen.getByLabelText(/Undo/);
      expect(undoButton).toBeDisabled();
    });

    it('redo button is disabled when canRedo is false', () => {
      render(<Header {...defaultProps} />);

      const redoButton = screen.getByLabelText(/Redo/);
      expect(redoButton).toBeDisabled();
    });

    it('undo button calls undo when enabled', () => {
      // Set up initial state and simulate an undoable action
      // Pattern: push current state BEFORE action, then do action
      useLayoutStore.getState().setName('Original');
      useHistoryStore.getState().push(useLayoutStore.getState().layout);
      useLayoutStore.getState().setName('Changed');

      expect(useLayoutStore.getState().layout.name).toBe('Changed');
      expect(useHistoryStore.getState().canUndo).toBe(true);

      render(<Header {...defaultProps} />);

      const undoButton = screen.getByLabelText(/Undo/);
      expect(undoButton).not.toBeDisabled();
      fireEvent.click(undoButton);

      // Verify undo restored the previous state
      expect(useLayoutStore.getState().layout.name).toBe('Original');
    });
  });

  describe('save status', () => {
    it('does not show save status when idle', () => {
      render(<Header {...defaultProps} saveStatus="idle" />);

      expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    });

    it('shows Saved status when saved', () => {
      render(<Header {...defaultProps} saveStatus="saved" />);

      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('shows Saving status when saving', () => {
      render(<Header {...defaultProps} saveStatus="saving" />);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('share button', () => {
    it('renders the ShareButton in the header icon cluster', () => {
      render(<Header {...defaultProps} />);

      expect(screen.getByTestId('share-button')).toBeInTheDocument();
    });
  });

  describe('layout manager', () => {
    it('opens layout manager on button click', async () => {
      render(<Header {...defaultProps} />);

      expect(screen.queryByTestId('layout-manager-modal')).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Open layout manager'));

      // Wait for lazy-loaded modal to render
      await waitFor(() => {
        expect(screen.getByTestId('layout-manager-modal')).toBeInTheDocument();
      });
    });

    it('closes layout manager when modal is closed', async () => {
      useViewStore.getState().setShowLayoutManager(true);
      render(<Header {...defaultProps} />);

      // Wait for lazy-loaded modal to render
      await waitFor(() => {
        expect(screen.getByTestId('layout-manager-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('layout-manager-modal'));

      await waitFor(() => {
        expect(screen.queryByTestId('layout-manager-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('help button', () => {
    it('dispatches open-help-modal event when help button clicked', () => {
      const handler = vi.fn();
      window.addEventListener('open-help-modal', handler);

      render(<Header {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Show help and keyboard shortcuts'));

      expect(handler).toHaveBeenCalledOnce();
      window.removeEventListener('open-help-modal', handler);
    });
  });

  describe('accessibility', () => {
    it('has accessible name for undo button', () => {
      render(<Header {...defaultProps} />);

      const undoButton = screen.getByLabelText(/Undo/);
      expect(undoButton).toHaveAttribute('aria-label');
    });

    it('has accessible name for redo button', () => {
      render(<Header {...defaultProps} />);

      const redoButton = screen.getByLabelText(/Redo/);
      expect(redoButton).toHaveAttribute('aria-label');
    });

    it('has live region for save status', () => {
      render(<Header {...defaultProps} saveStatus="saved" />);

      const saveStatus = screen.getByText('Saved').closest('div');
      expect(saveStatus).toHaveAttribute('aria-live', 'polite');
    });
  });
});
