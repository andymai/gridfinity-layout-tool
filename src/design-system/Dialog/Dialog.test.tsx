import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
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

  describe('sizes', () => {
    const renderWithSize = (size: 'full' | '2xl' | '3xl' | '4xl' | '5xl') => {
      const result = render(
        <Dialog.Root open={true} onClose={vi.fn()} size={size}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      const className = screen.getByRole('dialog').className;
      result.unmount();
      return className;
    };

    it('applies 2xl size classes', () => {
      expect(renderWithSize('2xl')).toContain('max-w-2xl');
    });

    it('applies 3xl size classes', () => {
      expect(renderWithSize('3xl')).toContain('max-w-3xl');
    });

    it('applies 4xl size classes', () => {
      const className = renderWithSize('4xl');
      expect(className).toContain('w-[95vw]');
      expect(className).toContain('max-w-4xl');
    });

    it('applies 5xl size classes', () => {
      const className = renderWithSize('5xl');
      expect(className).toContain('w-[95vw]');
      expect(className).toContain('max-w-5xl');
    });

    it('renders deprecated full size identically to 4xl', () => {
      expect(renderWithSize('full')).toBe(renderWithSize('4xl'));
    });
  });

  describe('height', () => {
    it('defaults to auto height with max-h cap', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      const className = screen.getByRole('dialog').className;
      expect(className).toContain('max-h-[90vh]');
      expect(className).not.toContain('h-[85vh]');
    });

    it('applies fixed height classes', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()} height="fixed">
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      expect(screen.getByRole('dialog').className).toContain('h-[85vh]');
    });
  });

  describe('mobile presentation', () => {
    it('applies sheet classes and renders the drag handle', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()} mobilePresentation="sheet">
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      const className = screen.getByRole('dialog').className;
      expect(className).toContain('max-md:rounded-t-2xl');
      expect(className).toContain('max-md:animate-slide-up');
      expect(screen.getByTestId('dialog-drag-handle')).toBeInTheDocument();
    });

    it('does not render the drag handle for dialog presentation', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      expect(screen.queryByTestId('dialog-drag-handle')).not.toBeInTheDocument();
    });

    it('applies mobile full-screen classes', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()} fullScreen="mobile">
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      const className = screen.getByRole('dialog').className;
      expect(className).toContain('max-md:h-dvh');
      expect(className).toContain('max-md:rounded-none');
    });
  });

  describe('overlay', () => {
    it('applies overlayClassName to the overlay', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()} overlayClassName="backdrop-blur-sm">
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      expect(screen.getByTestId('dialog-overlay').className).toContain('backdrop-blur-sm');
    });

    it('closes on overlay click by default', () => {
      const onClose = vi.fn();
      render(
        <Dialog.Root open={true} onClose={onClose}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      fireEvent.click(screen.getByTestId('dialog-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
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

    it('calls onClose once when Escape is pressed inside the content', () => {
      const onClose = vi.fn();
      render(
        <Dialog.Root open={true} onClose={onClose}>
          <Dialog.Header title="Test" />
          <Dialog.Body>
            <input aria-label="Field" />
          </Dialog.Body>
        </Dialog.Root>
      );
      fireEvent.keyDown(screen.getByLabelText('Field'), { key: 'Escape' });
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

  describe('dismissable', () => {
    it('blocks Escape when dismissable is false', () => {
      const onClose = vi.fn();
      render(
        <Dialog.Root open={true} onClose={onClose} dismissable={false}>
          <Dialog.Header title="Test" />
          <Dialog.Body>
            <input aria-label="Field" />
          </Dialog.Body>
        </Dialog.Root>
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.keyDown(screen.getByLabelText('Field'), { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('blocks overlay click when dismissable is false', () => {
      const onClose = vi.fn();
      render(
        <Dialog.Root open={true} onClose={onClose} dismissable={false}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      fireEvent.click(screen.getByTestId('dialog-overlay'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('makes the header close button inert when dismissable is false', () => {
      const onClose = vi.fn();
      render(
        <Dialog.Root open={true} onClose={onClose} dismissable={false}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      const closeButton = screen.getByLabelText('Close dialog');
      expect(closeButton).toBeDisabled();
      fireEvent.click(closeButton);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('initial focus', () => {
    it('focuses the first focusable element by default', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      expect(screen.getByLabelText('Close dialog')).toHaveFocus();
    });

    it('focuses the container when initialFocus is container', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()} initialFocus="container">
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      expect(screen.getByRole('dialog')).toHaveFocus();
    });

    it('focuses the referenced element when initialFocus is a ref', () => {
      function Harness() {
        const targetRef = useRef<HTMLElement | null>(null);
        return (
          <Dialog.Root open={true} onClose={vi.fn()} initialFocus={targetRef}>
            <Dialog.Header title="Test" />
            <Dialog.Body>
              <button>First</button>
              <button
                ref={(node) => {
                  targetRef.current = node;
                }}
              >
                Target
              </button>
            </Dialog.Body>
          </Dialog.Root>
        );
      }
      render(<Harness />);
      expect(screen.getByText('Target')).toHaveFocus();
    });
  });

  describe('keyboard containment', () => {
    it('stops keydown propagation past the dialog by default', () => {
      const documentSpy = vi.fn();
      document.addEventListener('keydown', documentSpy);
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>
            <input aria-label="Field" />
          </Dialog.Body>
        </Dialog.Root>
      );
      fireEvent.keyDown(screen.getByLabelText('Field'), { key: 'a' });
      expect(documentSpy).not.toHaveBeenCalled();
      document.removeEventListener('keydown', documentSpy);
    });

    it('lets keydown propagate when containKeyboard is false', () => {
      const documentSpy = vi.fn();
      document.addEventListener('keydown', documentSpy);
      render(
        <Dialog.Root open={true} onClose={vi.fn()} containKeyboard={false}>
          <Dialog.Header title="Test" />
          <Dialog.Body>
            <input aria-label="Field" />
          </Dialog.Body>
        </Dialog.Root>
      );
      fireEvent.keyDown(screen.getByLabelText('Field'), { key: 'a' });
      expect(documentSpy).toHaveBeenCalledTimes(1);
      document.removeEventListener('keydown', documentSpy);
    });
  });

  describe('stacking', () => {
    it('closes only the topmost dialog on Escape', () => {
      const onCloseOuter = vi.fn();
      const onCloseInner = vi.fn();
      render(
        <>
          <Dialog.Root open={true} onClose={onCloseOuter}>
            <Dialog.Header title="Outer" />
            <Dialog.Body>Outer content</Dialog.Body>
          </Dialog.Root>
          <Dialog.Root open={true} onClose={onCloseInner}>
            <Dialog.Header title="Inner" />
            <Dialog.Body>Inner content</Dialog.Body>
          </Dialog.Root>
        </>
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCloseInner).toHaveBeenCalledTimes(1);
      expect(onCloseOuter).not.toHaveBeenCalled();
    });

    it('layers stacked dialogs by depth', () => {
      render(
        <>
          <Dialog.Root open={true} onClose={vi.fn()}>
            <Dialog.Header title="Outer" />
            <Dialog.Body>Outer content</Dialog.Body>
          </Dialog.Root>
          <Dialog.Root open={true} onClose={vi.fn()}>
            <Dialog.Header title="Inner" />
            <Dialog.Body>Inner content</Dialog.Body>
          </Dialog.Root>
        </>
      );
      const overlays = screen.getAllByTestId('dialog-overlay');
      const dialogs = screen.getAllByRole('dialog');
      expect(overlays[0].style.zIndex).toBe('50');
      expect(dialogs[0].style.zIndex).toBe('51');
      expect(overlays[1].style.zIndex).toBe('52');
      expect(dialogs[1].style.zIndex).toBe('53');
    });
  });

  describe('header parts', () => {
    it('renders the leading slot', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" leading={<span>Back</span>} />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    it('applies bordered header classes', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" bordered />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      const header = screen.getByText('Test').parentElement?.parentElement;
      expect(header?.className).toContain('border-b');
    });

    it('accepts a ReactNode title', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title={<em>Fancy</em>} />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      expect(screen.getByText('Fancy')).toBeInTheDocument();
    });
  });

  describe('sub header', () => {
    it('renders children with the separator row classes', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.SubHeader>
            <span>Tabs go here</span>
          </Dialog.SubHeader>
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      const subHeader = screen.getByText('Tabs go here').parentElement;
      expect(subHeader?.className).toContain('border-b');
      expect(subHeader?.className).toContain('flex-shrink-0');
    });
  });

  describe('body parts', () => {
    it('removes padding with padding none', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body padding="none">Content</Dialog.Body>
        </Dialog.Root>
      );
      const body = screen.getByText('Content');
      expect(body.className).toContain('p-0');
      expect(body.className).not.toContain('px-[var(--space-2xl)]');
    });

    it('becomes an overflow-hidden flex container when scroll is false', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body scroll={false}>Content</Dialog.Body>
        </Dialog.Root>
      );
      const body = screen.getByText('Content');
      expect(body.className).toContain('overflow-hidden');
      expect(body.className).not.toContain('overflow-y-auto');
    });
  });

  describe('split layout', () => {
    it('renders Split, Sidebar, and Pane structure', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Split>
            <Dialog.Sidebar>Nav rail</Dialog.Sidebar>
            <Dialog.Pane>Main pane</Dialog.Pane>
          </Dialog.Split>
        </Dialog.Root>
      );
      const sidebar = screen.getByText('Nav rail');
      const pane = screen.getByText('Main pane');
      const split = sidebar.parentElement;
      expect(split?.className).toContain('flex');
      expect(split?.className).toContain('max-md:flex-col');
      expect(sidebar.className).toContain('w-64');
      expect(sidebar.className).toContain('border-r');
      expect(pane.className).toContain('flex-1');
      expect(pane.className).toContain('overflow-y-auto');
    });

    it('supports the small sidebar width', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Split>
            <Dialog.Sidebar width="sm">Nav rail</Dialog.Sidebar>
            <Dialog.Pane>Main pane</Dialog.Pane>
          </Dialog.Split>
        </Dialog.Root>
      );
      expect(screen.getByText('Nav rail').className).toContain('w-40');
    });
  });

  describe('footer parts', () => {
    it('defaults to end justification', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
          <Dialog.Footer>
            <button>Go</button>
          </Dialog.Footer>
        </Dialog.Root>
      );
      expect(screen.getByText('Go').parentElement?.className).toContain('justify-end');
    });

    it('supports between justification', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
          <Dialog.Footer justify="between">
            <button>Go</button>
          </Dialog.Footer>
        </Dialog.Root>
      );
      expect(screen.getByText('Go').parentElement?.className).toContain('justify-between');
    });

    it('applies bordered footer classes', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
          <Dialog.Footer bordered>
            <button>Go</button>
          </Dialog.Footer>
        </Dialog.Root>
      );
      expect(screen.getByText('Go').parentElement?.className).toContain('border-t');
    });

    it('renders the leading slot at the start', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
          <Dialog.Footer leading={<span>No layers selected</span>}>
            <button>Go</button>
          </Dialog.Footer>
        </Dialog.Root>
      );
      const leading = screen.getByText('No layers selected');
      expect(leading).toBeInTheDocument();
      expect(leading.parentElement?.className).toContain('mr-auto');
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

    it('omits aria-labelledby and uses aria-label when no Header title mounts', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()} aria-label="Welcome hero">
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      const dialog = screen.getByRole('dialog', { name: 'Welcome hero' });
      expect(dialog).not.toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-label', 'Welcome hero');
    });

    it('prefers the Header title over aria-label', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()} aria-label="Fallback">
          <Dialog.Header title="Real Title" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).not.toHaveAttribute('aria-label');
    });

    it('omits aria-describedby when no Body mounts', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <div>Raw content</div>
        </Dialog.Root>
      );
      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
    });

    it('sets aria-describedby when a Body mounts', () => {
      render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Test" />
          <Dialog.Body>Content</Dialog.Body>
        </Dialog.Root>
      );
      const dialog = screen.getByRole('dialog');
      const describedBy = dialog.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)?.textContent).toBe('Content');
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

    it('keeps body locked when concurrent dialogs close in non-LIFO order', () => {
      const first = render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="First" />
          <Dialog.Body>First</Dialog.Body>
        </Dialog.Root>
      );
      const second = render(
        <Dialog.Root open={true} onClose={vi.fn()}>
          <Dialog.Header title="Second" />
          <Dialog.Body>Second</Dialog.Body>
        </Dialog.Root>
      );

      first.unmount();
      expect(document.body.style.overflow).toBe('hidden');

      second.unmount();
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

  it('disables both buttons and shows busy state when busy', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test"
        busy
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const confirmButton = screen.getByText('Confirm').closest('button');
    const cancelButton = screen.getByText('Cancel').closest('button');
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveAttribute('aria-busy', 'true');
    expect(cancelButton).toBeDisabled();
  });

  it('is not dismissable while busy', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test"
        busy
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('dialog-overlay'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('renders the error line as an alert', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test"
        error="Something went wrong"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('renders the icon in a tinted circle', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test"
        icon={<span data-testid="confirm-icon" />}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const circle = screen.getByTestId('confirm-icon').parentElement;
    expect(circle?.className).toContain('rounded-full');
    expect(circle?.className).toContain('bg-warning-muted');
  });

  it('tints the icon circle with the error intent when destructive', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test"
        destructive
        icon={<span data-testid="confirm-icon" />}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByTestId('confirm-icon').parentElement?.className).toContain('bg-error-muted');
  });
});
