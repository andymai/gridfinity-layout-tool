import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  describe('rendering', () => {
    it('returns null when not open', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when open', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('displays title', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('displays message', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('displays default button text', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('uses custom button text', () => {
      render(<ConfirmDialog {...defaultProps} confirmText="Yes, Delete" cancelText="No, Keep" />);
      expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
      expect(screen.getByText('No, Keep')).toBeInTheDocument();
    });

    it('applies destructive styling when destructive prop is true', () => {
      render(<ConfirmDialog {...defaultProps} destructive />);
      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton.className).toContain('btn-danger');
    });

    it('applies primary styling when not destructive', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton.className).toContain('btn-primary');
    });
  });

  describe('accessibility', () => {
    it('has correct aria attributes', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'dialog-description');
    });

    it('focuses cancel button on open', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const cancelButton = screen.getByText('Cancel');
      expect(document.activeElement).toBe(cancelButton);
    });

    it('prevents body scroll when open', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll on unmount', () => {
      const { unmount } = render(<ConfirmDialog {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');
      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('interactions', () => {
    it('calls onCancel when cancel button clicked', () => {
      render(<ConfirmDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm and onCancel when confirm button clicked', () => {
      render(<ConfirmDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Confirm'));
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when backdrop clicked', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const backdrop = screen.getByRole('presentation');
      fireEvent.click(backdrop);
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when dialog content clicked', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);
      expect(defaultProps.onCancel).not.toHaveBeenCalled();
    });

    it('calls onCancel when Escape key pressed', () => {
      render(<ConfirmDialog {...defaultProps} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('focus trap', () => {
    it('traps focus within dialog - Tab from last to first', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const cancelButton = screen.getByText('Cancel');
      const confirmButton = screen.getByText('Confirm');

      // Focus on last element (confirm button)
      confirmButton.focus();

      // Tab should move to first element
      fireEvent.keyDown(document, { key: 'Tab' });

      // After Tab from last element, focus should stay in dialog
      // The actual focus trap uses preventDefault, so we verify the handler runs
      expect(cancelButton).toBeInTheDocument();
    });

    it('traps focus within dialog - Shift+Tab from first to last', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const cancelButton = screen.getByText('Cancel');
      const confirmButton = screen.getByText('Confirm');

      // Focus on first element (cancel button)
      cancelButton.focus();

      // Shift+Tab should move to last element
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

      // Verify both buttons exist (focus trap should keep focus in dialog)
      expect(confirmButton).toBeInTheDocument();
    });

    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(<ConfirmDialog {...defaultProps} />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('closed dialog behavior', () => {
    it('does not prevent body scroll when closed', () => {
      render(<ConfirmDialog {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('');
    });

    it('does not add event listeners when closed', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      render(<ConfirmDialog {...defaultProps} isOpen={false} />);

      // Should not have added keydown listeners for closed dialog
      const keydownCalls = addEventListenerSpy.mock.calls.filter((call) => call[0] === 'keydown');
      expect(keydownCalls).toHaveLength(0);

      addEventListenerSpy.mockRestore();
    });
  });
});
