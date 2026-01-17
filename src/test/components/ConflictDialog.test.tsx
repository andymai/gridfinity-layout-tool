import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConflictDialog } from '../../components/Modals/ConflictDialog';

describe('ConflictDialog', () => {
  const mockOnResolve = vi.fn();
  const mockOnCancel = vi.fn();
  const defaultProps = {
    isOpen: true,
    layoutName: 'Test Layout',
    serverModifiedAt: Date.now() - 60000, // 1 minute ago
    onResolve: mockOnResolve,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('visibility', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(
        <ConflictDialog {...defaultProps} isOpen={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders when isOpen is true', () => {
      render(<ConflictDialog {...defaultProps} />);

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText('Conflict Detected')).toBeInTheDocument();
    });
  });

  describe('content', () => {
    it('displays the layout name', () => {
      render(<ConflictDialog {...defaultProps} />);

      expect(screen.getByText(/"Test Layout"/)).toBeInTheDocument();
    });

    it('displays relative time for recent modifications', () => {
      render(<ConflictDialog {...defaultProps} serverModifiedAt={Date.now() - 30000} />);

      expect(screen.getByText(/just now/)).toBeInTheDocument();
    });

    it('displays minutes ago for older modifications', () => {
      render(<ConflictDialog {...defaultProps} serverModifiedAt={Date.now() - 120000} />);

      expect(screen.getByText(/2 minutes ago/)).toBeInTheDocument();
    });

    it('shows all three resolution options', () => {
      render(<ConflictDialog {...defaultProps} />);

      expect(screen.getByText('Save both versions')).toBeInTheDocument();
      expect(screen.getByText('Keep my changes')).toBeInTheDocument();
      expect(screen.getByText('Use their changes')).toBeInTheDocument();
    });

    it('shows Recommended badge on Save both option', () => {
      render(<ConflictDialog {...defaultProps} />);

      expect(screen.getByText('Recommended')).toBeInTheDocument();
    });

    it('has Resolve Conflict button', () => {
      render(<ConflictDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Resolve Conflict' })).toBeInTheDocument();
    });

    it('has Cancel button', () => {
      render(<ConflictDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="alertdialog" and aria-modal', () => {
      render(<ConflictDialog {...defaultProps} />);

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(<ConflictDialog {...defaultProps} />);

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'conflict-title');
    });

    it('has aria-describedby pointing to description', () => {
      render(<ConflictDialog {...defaultProps} />);

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'conflict-description');
    });

    it('focuses first option on mount', () => {
      render(<ConflictDialog {...defaultProps} />);

      const firstRadio = screen.getAllByRole('radio')[0];
      expect(document.activeElement).toBe(firstRadio);
    });
  });

  describe('keyboard navigation', () => {
    it('closes on Escape key', () => {
      render(<ConflictDialog {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('resolution selection', () => {
    it('has "save-both" selected by default', () => {
      render(<ConflictDialog {...defaultProps} />);

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      const saveBothRadio = radios.find((r) => r.value === 'save-both');
      expect(saveBothRadio?.checked).toBe(true);
    });

    it('allows selecting "keep-mine" option', () => {
      render(<ConflictDialog {...defaultProps} />);

      const keepMineRadio = screen.getByLabelText(/Keep my changes/);
      fireEvent.click(keepMineRadio);

      expect((keepMineRadio as HTMLInputElement).checked).toBe(true);
    });

    it('allows selecting "use-theirs" option', () => {
      render(<ConflictDialog {...defaultProps} />);

      const useTheirsRadio = screen.getByLabelText(/Use their changes/);
      fireEvent.click(useTheirsRadio);

      expect((useTheirsRadio as HTMLInputElement).checked).toBe(true);
    });
  });

  describe('form submission', () => {
    it('calls onResolve with "save-both" by default', () => {
      render(<ConflictDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Resolve Conflict' }));

      expect(mockOnResolve).toHaveBeenCalledWith('save-both');
    });

    it('calls onResolve with "keep-mine" when selected', () => {
      render(<ConflictDialog {...defaultProps} />);

      fireEvent.click(screen.getByLabelText(/Keep my changes/));
      fireEvent.click(screen.getByRole('button', { name: 'Resolve Conflict' }));

      expect(mockOnResolve).toHaveBeenCalledWith('keep-mine');
    });

    it('calls onResolve with "use-theirs" when selected', () => {
      render(<ConflictDialog {...defaultProps} />);

      fireEvent.click(screen.getByLabelText(/Use their changes/));
      fireEvent.click(screen.getByRole('button', { name: 'Resolve Conflict' }));

      expect(mockOnResolve).toHaveBeenCalledWith('use-theirs');
    });

    it('submits form via form submission', () => {
      render(<ConflictDialog {...defaultProps} />);

      const form = screen.getByRole('alertdialog').querySelector('form');
      fireEvent.submit(form!);

      expect(mockOnResolve).toHaveBeenCalledWith('save-both');
    });
  });

  describe('cancel behavior', () => {
    it('calls onCancel when Cancel is clicked', () => {
      render(<ConflictDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('calls onCancel when clicking backdrop', () => {
      render(<ConflictDialog {...defaultProps} />);

      const backdrop = screen.getByRole('presentation');
      fireEvent.click(backdrop);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('does not close when clicking dialog content', () => {
      render(<ConflictDialog {...defaultProps} />);

      const dialog = screen.getByRole('alertdialog');
      fireEvent.click(dialog);

      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  describe('time formatting', () => {
    it('shows "just now" for very recent modifications', () => {
      render(<ConflictDialog {...defaultProps} serverModifiedAt={Date.now() - 5000} />);

      expect(screen.getByText(/just now/)).toBeInTheDocument();
    });

    it('shows singular "minute" for 1 minute ago', () => {
      render(<ConflictDialog {...defaultProps} serverModifiedAt={Date.now() - 65000} />);

      expect(screen.getByText(/1 minute ago/)).toBeInTheDocument();
    });

    it('shows plural "minutes" for multiple minutes', () => {
      render(<ConflictDialog {...defaultProps} serverModifiedAt={Date.now() - 300000} />);

      expect(screen.getByText(/5 minutes ago/)).toBeInTheDocument();
    });

    it('shows formatted date for older modifications', () => {
      // More than 1 hour ago
      render(<ConflictDialog {...defaultProps} serverModifiedAt={Date.now() - 7200000} />);

      // Should show formatted date, not "minutes ago"
      expect(screen.queryByText(/minutes ago/)).not.toBeInTheDocument();
    });
  });

  describe('state reset', () => {
    it('resets selection when dialog closes and reopens', () => {
      const { rerender } = render(<ConflictDialog {...defaultProps} />);

      // Select "keep-mine"
      fireEvent.click(screen.getByLabelText(/Keep my changes/));

      // Close dialog
      rerender(<ConflictDialog {...defaultProps} isOpen={false} />);

      // Reopen dialog
      rerender(<ConflictDialog {...defaultProps} isOpen={true} />);

      // Should reset to "save-both" (default)
      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      const saveBothRadio = radios.find((r) => r.value === 'save-both');
      expect(saveBothRadio?.checked).toBe(true);
    });
  });
});
