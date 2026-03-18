import {
  useEffect,
  useRef,
  useCallback,
  useId,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { Button } from '../Button';
import { XIcon } from '../Icon';
import { focusRing } from '../variants';

// Dialog Context

interface DialogContextValue {
  titleId: string;
  descriptionId: string;
  onClose: () => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog compound components must be used within Dialog.Root');
  }
  return context;
}
const overlayVariants = cva(['fixed inset-0 z-50', 'bg-overlay-dark', 'animate-fade-in']);

const contentVariants = cva(
  [
    'fixed z-50',
    'bg-surface-secondary',
    'border border-stroke',
    'rounded-[var(--radius-xl)]',
    'shadow-[var(--shadow-xl)]',
    'animate-scale-in',
    'max-h-[90vh]',
    'overflow-hidden',
    'flex flex-col',
    ...focusRing,
  ],
  {
    variants: {
      size: {
        sm: 'w-[90vw] max-w-sm',
        md: 'w-[90vw] max-w-md',
        lg: 'w-[90vw] max-w-lg',
        xl: 'w-[90vw] max-w-xl',
        full: 'w-[95vw] max-w-4xl',
      },
      position: {
        center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        top: 'left-1/2 top-16 -translate-x-1/2',
      },
    },
    defaultVariants: {
      size: 'md',
      position: 'center',
    },
  }
);

const headerVariants = cva([
  'flex items-center justify-between',
  'px-[var(--space-2xl)] pt-[var(--space-2xl)] pb-2',
  'flex-shrink-0',
]);

const bodyVariants = cva(['px-[var(--space-2xl)] py-0', 'overflow-y-auto', 'flex-1']);

const footerVariants = cva([
  'flex items-center justify-end gap-3',
  'px-[var(--space-2xl)] pt-6 pb-[var(--space-2xl)]',
  'flex-shrink-0',
]);

// Focus Trap Hook

function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, isActive: boolean) {
  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const getFocusableElements = () => {
      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Focus first focusable element
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, isActive]);
}

// Body Scroll Lock Hook

function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Calculate scrollbar width to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isLocked]);
}

// Dialog Root

type ContentVariantProps = VariantProps<typeof contentVariants>;

export interface DialogRootProps extends ContentVariantProps {
  /**
   * Whether the dialog is open.
   */
  open: boolean;

  /**
   * Called when the dialog should close.
   */
  onClose: () => void;

  /**
   * Dialog content. Use Dialog.Header, Dialog.Body, and Dialog.Footer.
   */
  children: ReactNode;

  /**
   * Whether clicking the overlay closes the dialog.
   * @default true
   */
  closeOnOverlayClick?: boolean;

  /**
   * Whether pressing Escape closes the dialog.
   * @default true
   */
  closeOnEscape?: boolean;

  /**
   * Additional classes for the content container.
   */
  className?: string;
}

/**
 * Modal dialog with focus trap and accessibility.
 *
 * Use compound components for structure:
 * - Dialog.Root: Container with open/close logic
 * - Dialog.Header: Title and close button
 * - Dialog.Body: Main content area (scrollable)
 * - Dialog.Footer: Action buttons
 *
 * @example
 * <Dialog.Root open={isOpen} onClose={() => setIsOpen(false)}>
 *   <Dialog.Header title="Confirm Action" />
 *   <Dialog.Body>
 *     <p>Are you sure you want to proceed?</p>
 *   </Dialog.Body>
 *   <Dialog.Footer>
 *     <Button variant="ghost" onClick={() => setIsOpen(false)}>
 *       Cancel
 *     </Button>
 *     <Button variant="primary" onClick={handleConfirm}>
 *       Confirm
 *     </Button>
 *   </Dialog.Footer>
 * </Dialog.Root>
 *
 * @example
 * // Destructive dialog
 * <Dialog.Root open={showDelete} onClose={closeDelete} size="sm">
 *   <Dialog.Header title="Delete Item" />
 *   <Dialog.Body>
 *     This action cannot be undone.
 *   </Dialog.Body>
 *   <Dialog.Footer>
 *     <Button variant="ghost" onClick={closeDelete}>Cancel</Button>
 *     <Button variant="danger" onClick={handleDelete}>Delete</Button>
 *   </Dialog.Footer>
 * </Dialog.Root>
 */
function DialogRoot({
  open,
  onClose,
  children,
  size = 'md',
  position = 'center',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
}: DialogRootProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const descriptionId = useId();

  // Store the element that had focus before opening
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [open]);

  // Restore focus when closing
  useEffect(() => {
    if (!open && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [open]);

  // Handle Escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  // Apply focus trap and scroll lock
  useFocusTrap(contentRef, open);
  useBodyScrollLock(open);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  if (!open) return null;

  return createPortal(
    <DialogContext.Provider value={{ titleId, descriptionId, onClose }}>
      {/* Overlay */}
      <div className={overlayVariants()} onClick={handleOverlayClick} aria-hidden="true" />

      {/* Content */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(contentVariants({ size, position }), className)}
      >
        {children}
      </div>
    </DialogContext.Provider>,
    document.body
  );
}

// Dialog Header

export interface DialogHeaderProps {
  /**
   * Dialog title.
   */
  title: string;

  /**
   * Whether to show the close button.
   * @default true
   */
  showCloseButton?: boolean;

  /**
   * Additional content to render in the header.
   */
  children?: ReactNode;
}

function DialogHeader({ title, showCloseButton = true, children }: DialogHeaderProps) {
  const { titleId, onClose } = useDialogContext();

  return (
    <div className={headerVariants()}>
      <h2 id={titleId} className="text-xl font-semibold text-content">
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {children}
        {showCloseButton && (
          <Button iconOnly size="sm" variant="ghost" onClick={onClose} aria-label="Close dialog">
            <XIcon size="sm" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Dialog Body

export interface DialogBodyProps {
  children: ReactNode;
  className?: string;
}

function DialogBody({ children, className }: DialogBodyProps) {
  const { descriptionId } = useDialogContext();

  return (
    <div id={descriptionId} className={cn(bodyVariants(), className)}>
      {children}
    </div>
  );
}

// Dialog Footer

export interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

function DialogFooter({ children, className }: DialogFooterProps) {
  return <div className={cn(footerVariants(), className)}>{children}</div>;
}

// Compound Component Export

export const Dialog = {
  Root: DialogRoot,
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
};

// ConfirmDialog (convenience wrapper)

export interface ConfirmDialogProps {
  /**
   * Whether the dialog is open.
   */
  isOpen: boolean;

  /**
   * Dialog title.
   */
  title: string;

  /**
   * Confirmation message body.
   */
  message: string;

  /**
   * Label for the confirm button.
   * @default 'Confirm'
   */
  confirmText?: string;

  /**
   * Label for the cancel button.
   * @default 'Cancel'
   */
  cancelText?: string;

  /**
   * Whether the action is destructive (uses danger variant).
   * @default false
   */
  destructive?: boolean;

  /**
   * Called when the user confirms.
   */
  onConfirm: () => void;

  /**
   * Called when the user cancels or closes.
   */
  onCancel: () => void;
}

/**
 * Pre-built confirmation dialog using Dialog compound parts.
 *
 * @example
 * <ConfirmDialog
 *   isOpen={showDelete}
 *   title="Delete Layout"
 *   message="This action cannot be undone."
 *   confirmText="Delete"
 *   destructive
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowDelete(false)}
 * />
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <DialogRoot open={isOpen} onClose={onCancel} size="md">
      <DialogHeader title={title} />
      <DialogBody>
        <p className="text-sm text-content-secondary">{message}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmText}
        </Button>
      </DialogFooter>
    </DialogRoot>
  );
}

// Named exports for type access
export type { DialogRootProps as DialogProps };
