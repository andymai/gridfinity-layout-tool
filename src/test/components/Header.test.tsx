import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../../components/Header';
import { useLayoutStore, useHistoryStore, useUIStore, useLibraryStore } from '../../store';
import { resetAllStores } from '../testUtils';

// Mock the LayoutManagerModal to avoid deep component tree
vi.mock('../../components/modals/LayoutManagerModal', () => ({
  LayoutManagerModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    isOpen ? <div data-testid="layout-manager-modal" onClick={onClose}>Modal</div> : null
  ),
}));

// Controllable mock for useFeatureFlag and useCollabMode
let mockFeatureFlagValue = false;
let mockIsCollaborative = false;
vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useResponsive: () => ({ isTablet: false, isMobile: false }),
    useFeatureFlag: () => mockFeatureFlagValue,
    useCollabMode: () => ({ isCollaborative: mockIsCollaborative, canEdit: true, shareId: null }),
  };
});

// Controllable mock for ShareButton
let mockShareButtonEnabled = false;
vi.mock('../../components/ShareButton', () => ({
  ShareButton: () =>
    mockShareButtonEnabled ? <button data-testid="share-button">Share</button> : null,
}));

// Mock PresenceAvatars to avoid Liveblocks context requirements
vi.mock('../../components/collab', () => ({
  PresenceAvatars: ({ className }: { className?: string }) => (
    <div data-testid="presence-avatars" className={className}>Presence</div>
  ),
}));

describe('Header', () => {
  const mockOnHelpClick = vi.fn();

  const defaultProps = {
    onHelpClick: mockOnHelpClick,
    saveStatus: 'idle' as const,
  };

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    mockShareButtonEnabled = false;
    mockFeatureFlagValue = false;
    mockIsCollaborative = false;
  });

  describe('rendering', () => {
    it('renders app title', () => {
      render(<Header {...defaultProps} />);

      expect(screen.getByText('Gridfinity Layout Tool')).toBeInTheDocument();
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

    it('renders Reddit link', () => {
      render(<Header {...defaultProps} />);

      expect(screen.getByLabelText('Discuss on Reddit')).toBeInTheDocument();
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

    it('shows Saved status when saving', () => {
      render(<Header {...defaultProps} saveStatus="saving" />);

      expect(screen.getByText('Saved')).toBeInTheDocument();
    });
  });

  describe('half-bin mode indicator', () => {
    it('does not show half-bin badge when mode is off', () => {
      render(<Header {...defaultProps} />);

      expect(screen.queryByText('Half-Bin Mode')).not.toBeInTheDocument();
    });

    it('shows half-bin badge when mode is on', () => {
      useUIStore.getState().toggleHalfBinMode();
      render(<Header {...defaultProps} />);

      expect(screen.getByText('Half-Bin Mode')).toBeInTheDocument();
    });
  });

  describe('collaboration mode', () => {
    it('feature flag controls ShareButton divider visibility', () => {
      // When feature is disabled, ShareButton returns null and no extra dividers
      mockFeatureFlagValue = false;
      mockShareButtonEnabled = false;
      const { container, rerender } = render(<Header {...defaultProps} />);

      // Count dividers (w-px h-6 elements)
      const dividersWhenDisabled = container.querySelectorAll('.w-px.h-6').length;

      // When feature is enabled, extra dividers appear around ShareButton
      mockFeatureFlagValue = true;
      mockShareButtonEnabled = true;
      rerender(<Header {...defaultProps} />);

      const dividersWhenEnabled = container.querySelectorAll('.w-px.h-6').length;

      // Should have more dividers when collaboration is enabled
      expect(dividersWhenEnabled).toBeGreaterThan(dividersWhenDisabled);
    });
  });

  describe('share button visibility', () => {
    it('does not render ShareButton when collaborative_editing feature is disabled', () => {
      mockShareButtonEnabled = false;
      render(<Header {...defaultProps} />);

      expect(screen.queryByTestId('share-button')).not.toBeInTheDocument();
    });

    it('renders ShareButton when collaborative_editing feature is enabled', () => {
      mockShareButtonEnabled = true;
      render(<Header {...defaultProps} />);

      expect(screen.getByTestId('share-button')).toBeInTheDocument();
    });
  });

  describe('layout manager', () => {
    it('opens layout manager on button click', () => {
      render(<Header {...defaultProps} />);

      expect(screen.queryByTestId('layout-manager-modal')).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Open layout manager'));

      expect(screen.getByTestId('layout-manager-modal')).toBeInTheDocument();
    });

    it('closes layout manager when modal is closed', () => {
      useLibraryStore.getState().setShowLayoutManager(true);
      render(<Header {...defaultProps} />);

      expect(screen.getByTestId('layout-manager-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('layout-manager-modal'));

      expect(screen.queryByTestId('layout-manager-modal')).not.toBeInTheDocument();
    });
  });

  describe('help button', () => {
    it('calls onHelpClick when help button clicked', () => {
      render(<Header {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Show help and keyboard shortcuts'));

      expect(mockOnHelpClick).toHaveBeenCalledOnce();
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

