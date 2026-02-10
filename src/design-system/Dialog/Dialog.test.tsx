import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog, ConfirmDialog } from './Dialog';

describe('Dialog', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  describe('rendering', () => {
    it('returns null when closed', () => {
      const { container } = render(
        <Dialog.Root open={false} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders dialog when open', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('displays title', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Confirm Delete" />
          <Dialog.Body>Are you sure?</Dialog.Body>
        </Dialog.Root>
      );
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    });

    it('displays body content', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Body content here</Dialog.Body>
        </Dialog.Root>
      );
      expect(screen.getByText('Body content here')).toBeInTheDocument();
    });

    it('renders footer', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
          <Dialog.Footer>
            <button>Cancel</button>
          </Dialog.Footer>
        </Dialog.Root>
      );
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('close interactions', () => {
    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(
        <Dialog.Root open={true} onClose={onClose}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      fireEvent.click(screen.getByLabelText('Close dialog'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose on Escape key', () => {
      const onClose = vi.fn();
      render(
        <Dialog.Root open={true} onClose={onClose}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on Escape when closeOnEscape is false', () => {
      const onClose = vi.fn();
      render(
        <Dialog.Root open={true} onClose={onClose} closeOnEscape={false}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('hides close button when showCloseButton is false', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" showCloseButton={false} />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      expect(screen.queryByLabelText('Close dialog')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has aria-modal', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="My Title" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      const dialog = screen.getByRole('dialog');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      const titleElement = document.getElementById(labelledBy!);
      expect(titleElement?.textContent).toBe('My Title');
    });

    it('locks body scroll when open', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll on unmount', () => {
      const { unmount } = render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });
});

describe('ConfirmDialog', () => {
  it('renders title and message', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Item"
        message="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('renders default button labels', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders custom button labels', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        confirmText="Delete"
        cancelText="Keep"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Keep')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('returns null when closed', () => {
    const { container } = render(
      <ConfirmDialog
        isOpen={false}
        title="Test"
        message="Test"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
