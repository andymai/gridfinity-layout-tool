import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HalfBinModeBlockedModal } from '../../components/modals/HalfBinModeBlockedModal';
import type { HalfBinConstraintViolation } from '../../utils/halfBinConstraints';

function createViolation(count: number = 3, binIds: string[] = ['bin-1', 'bin-2', 'bin-3']): HalfBinConstraintViolation {
  return {
    type: 'fractional_bins',
    count,
    binIds,
    drawerHasFractional: false,
  };
}

describe('HalfBinModeBlockedModal', () => {
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
      const { container } = render(
        <HalfBinModeBlockedModal {...defaultProps} isOpen={false} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('rendering when open', () => {
    it('renders dialog with correct role', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('renders title', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      expect(screen.getByText('Cannot Disable Half-Bin Mode')).toBeInTheDocument();
    });

    it('shows bin count (plural)', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      expect(screen.getByText('3 bins')).toBeInTheDocument();
    });

    it('shows bin count (singular)', () => {
      render(
        <HalfBinModeBlockedModal
          {...defaultProps}
          violation={createViolation(1, ['bin-1'])}
        />
      );

      expect(screen.getByText('1 bin')).toBeInTheDocument();
    });

    it('renders explanatory message', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      expect(screen.getByText(/fractional dimensions/)).toBeInTheDocument();
      expect(screen.getByText(/staging area/)).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders Move to Staging button', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      expect(screen.getByText('Move to Staging')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has aria-labelledby pointing to title', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'half-bin-blocked-title');

      const title = screen.getByText('Cannot Disable Half-Bin Mode');
      expect(title).toHaveAttribute('id', 'half-bin-blocked-title');
    });

    it('has aria-describedby pointing to message', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'half-bin-blocked-message');

      const message = document.getElementById('half-bin-blocked-message');
      expect(message).toBeInTheDocument();
    });

    it('cancel button has accessible label', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      expect(
        screen.getByLabelText('Cancel and keep half-bin mode enabled')
      ).toBeInTheDocument();
    });

    it('remediate button has accessible label with bin count', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      expect(
        screen.getByLabelText('Move 3 bins to staging and disable half-bin mode')
      ).toBeInTheDocument();
    });

    it('remediate button label uses singular when 1 bin', () => {
      render(
        <HalfBinModeBlockedModal
          {...defaultProps}
          violation={createViolation(1, ['bin-1'])}
        />
      );

      expect(
        screen.getByLabelText('Move 1 bin to staging and disable half-bin mode')
      ).toBeInTheDocument();
    });
  });

  describe('cancel action', () => {
    it('calls onClose when Cancel clicked', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('calls onClose when backdrop clicked', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      // Click on backdrop (role="presentation")
      const backdrop = screen.getByRole('presentation');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('does not close when clicking inside dialog', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByRole('dialog'));

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('remediate action', () => {
    it('calls onRemediate when Move to Staging clicked', async () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Move to Staging'));

      await waitFor(() => {
        expect(mockOnRemediate).toHaveBeenCalledOnce();
      });
    });

    it('shows loading state while remediating', async () => {
      // Make remediation hang
      mockOnRemediate.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<HalfBinModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Move to Staging'));

      await waitFor(() => {
        expect(screen.getByText('Moving...')).toBeInTheDocument();
      });
    });

    it('disables buttons while remediating', async () => {
      mockOnRemediate.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<HalfBinModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Move to Staging'));

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeDisabled();
        expect(screen.getByText('Moving...').closest('button')).toBeDisabled();
      });
    });

    it('does not call onClose when clicking backdrop while remediating', async () => {
      mockOnRemediate.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<HalfBinModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Move to Staging'));

      await waitFor(() => {
        expect(screen.getByText('Moving...')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('presentation'));

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('shows error message when remediation fails', async () => {
      mockOnRemediate.mockRejectedValue(new Error('Failed to move bins'));

      render(<HalfBinModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Move to Staging'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Failed to move bins')).toBeInTheDocument();
      });
    });

    it('shows generic error for non-Error objects', async () => {
      mockOnRemediate.mockRejectedValue('Something went wrong');

      render(<HalfBinModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Move to Staging'));

      await waitFor(() => {
        expect(screen.getByText('An error occurred while moving bins')).toBeInTheDocument();
      });
    });

    it('re-enables buttons after error', async () => {
      mockOnRemediate.mockRejectedValue(new Error('Failed'));

      render(<HalfBinModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Move to Staging'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText('Cancel')).not.toBeDisabled();
      expect(screen.getByText('Move to Staging')).toBeInTheDocument();
    });
  });

  describe('keyboard handling', () => {
    it('closes on Escape key', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('does not close on Escape while remediating', async () => {
      mockOnRemediate.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<HalfBinModeBlockedModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Move to Staging'));

      await waitFor(() => {
        expect(screen.getByText('Moving...')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('focus management', () => {
    it('prevents body scroll when open', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when closed', () => {
      const { unmount } = render(<HalfBinModeBlockedModal {...defaultProps} />);

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('focus trapping', () => {
    it('traps Tab at last element', () => {
      render(<HalfBinModeBlockedModal {...defaultProps} />);

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
      render(<HalfBinModeBlockedModal {...defaultProps} />);

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
