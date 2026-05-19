import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HalfGridModeBlockedModal } from '@/shell/Modals/HalfGridModeBlockedModal';
import type { HalfGridConstraintViolation } from '@/shared/utils/halfGridConstraints';

function createViolation(
  count: number = 3,
  binIds: string[] = ['bin-1', 'bin-2', 'bin-3']
): HalfGridConstraintViolation {
  return {
    type: 'fractional_bins',
    count,
    binIds,
    drawerHasFractional: false,
  };
}

describe('HalfGridModeBlockedModal', () => {
  const mockOnClose = vi.fn();
  const mockOnRemediate = vi.fn();

  const defaultProps = {
    isOpen: true,
    violation: createViolation(),
    onClose: mockOnClose,
    onRemediate: mockOnRemediate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnRemediate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  describe('rendering when closed', () => {
    it('returns null when not open', () => {
      const { container } = render(<HalfGridModeBlockedModal {...defaultProps} isOpen={false} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('rendering when open', () => {
    it('renders dialog with correct role', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('renders title', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      expect(screen.getByText('Cannot Disable Half-Grid Mode')).toBeInTheDocument();
    });

    it('shows bin count (plural)', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      // The message is now in i18n: "Some bins use fractional dimensions..."
      expect(screen.getByText(/Some bins use fractional dimensions/)).toBeInTheDocument();
    });

    it('shows bin count (singular)', () => {
      render(
        <HalfGridModeBlockedModal {...defaultProps} violation={createViolation(1, ['bin-1'])} />
      );

      // The message is now in i18n
      expect(screen.getByText(/Some bins use fractional dimensions/)).toBeInTheDocument();
    });

    it('renders explanatory message', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      // The full message from i18n
      expect(screen.getByText(/Some bins use fractional dimensions/)).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders Move to Staging button', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      expect(screen.getByText('Got it')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has aria-labelledby pointing to title', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'half-bin-blocked-title');

      const title = screen.getByText('Cannot Disable Half-Grid Mode');
      expect(title).toHaveAttribute('id', 'half-bin-blocked-title');
    });

    it('has aria-describedby pointing to message', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'half-bin-blocked-message');

      const message = document.getElementById('half-bin-blocked-message');
      expect(message).toBeInTheDocument();
    });

    it('cancel button has accessible label', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      expect(screen.getByLabelText('Cancel and keep half-grid mode enabled')).toBeInTheDocument();
    });

    it('remediate button has accessible label with bin count', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      expect(
        screen.getByLabelText('Move 3 fractional bins to stash and disable half-grid mode')
      ).toBeInTheDocument();
    });

    it('remediate button label uses singular when 1 bin', () => {
      render(
        <HalfGridModeBlockedModal {...defaultProps} violation={createViolation(1, ['bin-1'])} />
      );

      expect(
        screen.getByLabelText('Move 1 fractional bins to stash and disable half-grid mode')
      ).toBeInTheDocument();
    });
  });

  describe('cancel action', () => {
    it('calls onClose when Cancel clicked', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('calls onClose when backdrop clicked', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      // Click on backdrop (outermost role="presentation")
      const backdrop = screen.getAllByRole('presentation')[0];
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('does not close when clicking inside dialog', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByRole('dialog'));

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('remediate action', () => {
    it('calls onRemediate when Move to Staging clicked', async () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Got it'));

      await waitFor(() => {
        expect(mockOnRemediate).toHaveBeenCalledOnce();
      });
    });

    it('shows loading state while remediating', async () => {
      // Make remediation hang
      mockOnRemediate.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      render(<HalfGridModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Got it'));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });

    it('disables buttons while remediating', async () => {
      mockOnRemediate.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      render(<HalfGridModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Got it'));

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeDisabled();
        expect(screen.getByText('Loading...').closest('button')).toBeDisabled();
      });
    });

    it('does not call onClose when clicking backdrop while remediating', async () => {
      mockOnRemediate.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      render(<HalfGridModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Got it'));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('presentation')[0]);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('shows error message when remediation fails', async () => {
      mockOnRemediate.mockRejectedValue(new Error('Failed to move bins'));

      render(<HalfGridModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Got it'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Failed to move bins')).toBeInTheDocument();
      });
    });

    it('shows generic error for non-Error objects', async () => {
      mockOnRemediate.mockRejectedValue('Something went wrong');

      render(<HalfGridModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Got it'));

      await waitFor(() => {
        expect(screen.getByText('An error occurred while moving bins')).toBeInTheDocument();
      });
    });

    it('re-enables buttons after error', async () => {
      mockOnRemediate.mockRejectedValue(new Error('Failed'));

      render(<HalfGridModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Got it'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText('Cancel')).not.toBeDisabled();
      expect(screen.getByText('Got it')).toBeInTheDocument();
    });
  });

  describe('keyboard handling', () => {
    it('closes on Escape key', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('does not close on Escape while remediating', async () => {
      mockOnRemediate.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      render(<HalfGridModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Got it'));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('focus management', () => {
    it('prevents body scroll when open', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when closed', () => {
      const { unmount } = render(<HalfGridModeBlockedModal {...defaultProps} />);

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('focus trapping', () => {
    it('traps Tab at last element', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      const buttons = dialog.querySelectorAll('button');
      const lastButton = buttons[buttons.length - 1];

      lastButton.focus();
      expect(document.activeElement).toBe(lastButton);

      fireEvent.keyDown(document, { key: 'Tab' });

      // Focus should wrap to first button
      expect(document.activeElement).toBe(buttons[0]);
    });

    it('traps Shift+Tab at first element', () => {
      render(<HalfGridModeBlockedModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      const buttons = dialog.querySelectorAll('button');
      const firstButton = buttons[0];
      const lastButton = buttons[buttons.length - 1];

      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);

      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

      // Focus should wrap to last button
      expect(document.activeElement).toBe(lastButton);
    });
  });
});
