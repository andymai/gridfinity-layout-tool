import {
  useEffect,
  useRef,
  useCallback,
  useId,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { focusRing } from '../variants';
import { useDialogStack, isTopmostDialog } from './dialogStack';
import { useFocusTrap, type DialogInitialFocus } from './useFocusTrap';
import { useBodyScrollLock } from './useBodyScrollLock';

// Dialog Context

interface DialogContextValue {
  titleId: string;
  descriptionId: string;
  onClose: () => void;
  dismissable: boolean;
  registerTitle: () => () => void;
  registerDescription: () => () => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog compound components must be used within Dialog.Root');
  }
  return context;
}
const overlayVariants = cva(['fixed inset-0', 'bg-overlay-dark', 'animate-fade-in']);

const contentVariants = cva(
  [
    'fixed z-50',
    'bg-surface-secondary',
    'border border-stroke',
    'rounded-[var(--radius-xl)]',
    'shadow-[var(--shadow-xl)]',
    'animate-scale-in',
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
        '2xl': 'w-[90vw] max-w-2xl',
        '3xl': 'w-[90vw] max-w-3xl',
        '4xl': 'w-[95vw] max-w-4xl',
        '5xl': 'w-[95vw] max-w-5xl',
        full: 'w-[95vw] max-w-4xl',
      },
      height: {
        auto: 'max-h-[90vh]',
        fixed: 'h-[85vh] max-h-[90vh]',
      },
      position: {
        center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        top: 'left-1/2 top-16 -translate-x-1/2',
      },
      fullScreen: {
        never: '',
        mobile: [
          'max-md:left-0 max-md:top-0',
          'max-md:translate-x-0 max-md:translate-y-0',
          'max-md:w-full max-md:max-w-none',
          'max-md:h-dvh max-md:max-h-none',
          'max-md:rounded-none max-md:border-0',
        ],
      },
      mobilePresentation: {
        dialog: '',
        sheet: [
          'max-md:left-0 max-md:bottom-0 max-md:top-auto',
          'max-md:translate-x-0 max-md:translate-y-0',
          'max-md:w-full max-md:max-w-none',
          'max-md:rounded-b-none max-md:rounded-t-2xl',
          'max-md:animate-slide-up',
        ],
      },
    },
    defaultVariants: {
      size: 'md',
      height: 'auto',
      position: 'center',
      fullScreen: 'never',
      mobilePresentation: 'dialog',
    },
  }
);

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
   * When false, overlay click, Escape, and the Header close button are all
   * inert — for busy/async states that must not be interrupted.
   * @default true
   */
  dismissable?: boolean;

  /**
   * Where focus lands when the dialog opens: the first focusable element,
   * the dialog container itself, or a specific element ref.
   * @default 'first'
   */
  initialFocus?: DialogInitialFocus;

  /**
   * Accessible name for headerless dialogs. Used only when no Dialog.Header
   * title is mounted.
   */
  'aria-label'?: string;

  /**
   * Stops keydown propagation at the dialog boundary so app-level shortcuts
   * don't fire while the dialog is open.
   * @default true
   */
  containKeyboard?: boolean;

  /**
   * Additional classes for the overlay element.
   */
  overlayClassName?: string;

  /**
   * Additional classes for the content container.
   */
  className?: string;
}

/**
 * Modal dialog with focus trap, stacking, and accessibility.
 *
 * Use compound components for structure:
 * - Dialog.Root: Container with open/close logic
 * - Dialog.Header: Title, optional leading slot, and close button
 * - Dialog.SubHeader: Tab bars / search row under the title
 * - Dialog.Body: Main content area (scrollable)
 * - Dialog.Split / Dialog.Sidebar / Dialog.Pane: Two-column layouts
 * - Dialog.Footer: Action buttons
 *
 * `size="full"` is a deprecated alias of `size="4xl"`.
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
 * // Settings-style dialog: stable height, full-screen on mobile, sidebar rail
 * <Dialog.Root open={open} onClose={close} size="3xl" height="fixed" fullScreen="mobile">
 *   <Dialog.Header title="Settings" bordered />
 *   <Dialog.Split>
 *     <Dialog.Sidebar width="sm">{nav}</Dialog.Sidebar>
 *     <Dialog.Pane>{content}</Dialog.Pane>
 *   </Dialog.Split>
 *   <Dialog.Footer justify="between" bordered leading={legalLinks}>
 *     <Button onClick={close}>Done</Button>
 *   </Dialog.Footer>
 * </Dialog.Root>
 *
 * @example
 * // Mobile action sheet
 * <Dialog.Root open={open} onClose={close} mobilePresentation="sheet">
 *   <Dialog.Header title="Rename layer" />
 *   <Dialog.Body>{form}</Dialog.Body>
 * </Dialog.Root>
 */
export function DialogRoot({
  open,
  onClose,
  children,
  size = 'md',
  height = 'auto',
  position = 'center',
  fullScreen = 'never',
  mobilePresentation = 'dialog',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  dismissable = true,
  initialFocus = 'first',
  'aria-label': ariaLabel,
  containKeyboard = true,
  overlayClassName,
  className,
}: DialogRootProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const dialogId = useId();
  const titleId = useId();
  const descriptionId = useId();

  const { depth } = useDialogStack(dialogId, open);

  const [titleRegistrations, setTitleRegistrations] = useState(0);
  const [descriptionRegistrations, setDescriptionRegistrations] = useState(0);

  const registerTitle = useCallback(() => {
    setTitleRegistrations((count) => count + 1);
    return () => setTitleRegistrations((count) => count - 1);
  }, []);

  const registerDescription = useCallback(() => {
    setDescriptionRegistrations((count) => count + 1);
    return () => setDescriptionRegistrations((count) => count - 1);
  }, []);

  // Restore focus via effect cleanup so it also runs when the dialog closes
  // by unmounting (open kept literally true and the parent conditionally
  // renders), not only when the open prop flips to false.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open]);

  const canDismiss = dismissable && closeOnEscape;

  // Handle Escape key (document level, for events that never enter the
  // content — containKeyboard handles in-content Escape before it gets here)
  useEffect(() => {
    if (!open || !canDismiss) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (!isTopmostDialog(dialogId)) return;
      e.preventDefault();
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, canDismiss, onClose, dialogId]);

  // Apply focus trap and scroll lock
  useFocusTrap(contentRef, open, initialFocus);
  useBodyScrollLock(open);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (dismissable && closeOnOverlayClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [dismissable, closeOnOverlayClick, onClose]
  );

  const handleContentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!containKeyboard) return;
      if (e.key === 'Escape' && canDismiss && isTopmostDialog(dialogId)) {
        e.preventDefault();
        onClose();
      }
      e.stopPropagation();
    },
    [containKeyboard, canDismiss, onClose, dialogId]
  );

  const requestClose = useCallback(() => {
    if (dismissable) {
      onClose();
    }
  }, [dismissable, onClose]);

  if (!open) return null;

  return createPortal(
    <DialogContext.Provider
      value={{
        titleId,
        descriptionId,
        onClose: requestClose,
        dismissable,
        registerTitle,
        registerDescription,
      }}
    >
      {/* Overlay */}
      <div
        data-testid="dialog-overlay"
        className={cn(overlayVariants(), overlayClassName)}
        style={{ zIndex: 50 + depth * 2 }}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Content */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleRegistrations > 0 ? titleId : undefined}
        aria-label={titleRegistrations > 0 ? undefined : ariaLabel}
        aria-describedby={descriptionRegistrations > 0 ? descriptionId : undefined}
        tabIndex={-1}
        style={{ zIndex: 51 + depth * 2 }}
        onKeyDown={handleContentKeyDown}
        className={cn(
          contentVariants({ size, height, position, fullScreen, mobilePresentation }),
          className
        )}
      >
        {mobilePresentation === 'sheet' && (
          <div
            data-testid="dialog-drag-handle"
            aria-hidden="true"
            className="mx-auto mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-stroke-subtle md:hidden"
          />
        )}
        {children}
      </div>
    </DialogContext.Provider>,
    document.body
  );
}
