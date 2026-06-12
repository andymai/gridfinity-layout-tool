import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useId,
  useState,
  useSyncExternalStore,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { Button } from '../Button';
import { Alert } from '../Alert';
import { XIcon } from '../Icon';
import { focusRing, intentBackgrounds } from '../variants';

// Dialog Stack

const dialogStack: string[] = [];
const dialogStackListeners = new Set<() => void>();

function emitDialogStackChange() {
  dialogStackListeners.forEach((listener) => listener());
}

/**
 * Registers a dialog as the new topmost entry of the module-level stack.
 * Exposed so non-Dialog overlays (e.g. BottomSheet) can participate.
 */
export function registerDialog(id: string): void {
  if (!dialogStack.includes(id)) {
    dialogStack.push(id);
    emitDialogStackChange();
  }
}

/**
 * Removes a dialog from the module-level stack.
 */
export function unregisterDialog(id: string): void {
  const index = dialogStack.indexOf(id);
  if (index !== -1) {
    dialogStack.splice(index, 1);
    emitDialogStackChange();
  }
}

/**
 * Whether the given dialog is the topmost open dialog.
 */
export function isTopmostDialog(id: string): boolean {
  return dialogStack[dialogStack.length - 1] === id;
}

function subscribeToDialogStack(listener: () => void): () => void {
  dialogStackListeners.add(listener);
  return () => dialogStackListeners.delete(listener);
}

/**
 * Registers in the dialog stack while `active`, and returns the live stack
 * position. `depth` drives z-index layering; `isTopmost` gates Escape and
 * focus-trap behavior so nested dialogs don't fight over keyboard input.
 */
export function useDialogStack(id: string, active: boolean): { depth: number; isTopmost: boolean } {
  // useLayoutEffect so depth/isTopmost are correct on first paint when
  // multiple dialogs mount open together.
  useLayoutEffect(() => {
    if (!active) return;
    registerDialog(id);
    return () => unregisterDialog(id);
  }, [id, active]);

  const index = useSyncExternalStore(subscribeToDialogStack, () => dialogStack.indexOf(id));
  const stackSize = useSyncExternalStore(subscribeToDialogStack, () => dialogStack.length);

  return {
    depth: index === -1 ? 0 : index,
    isTopmost: index !== -1 && index === stackSize - 1,
  };
}

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

function useDialogContext() {
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

const headerVariants = cva(
  [
    'flex items-center justify-between',
    'px-[var(--space-2xl)] pt-[var(--space-2xl)] pb-2',
    'flex-shrink-0',
  ],
  {
    variants: {
      bordered: {
        true: 'border-b border-stroke-subtle pb-4',
      },
    },
  }
);

const subHeaderVariants = cva([
  'px-[var(--space-2xl)] py-3',
  'border-b border-stroke-subtle',
  'flex-shrink-0',
]);

const bodyVariants = cva(['flex-1'], {
  variants: {
    padding: {
      default: 'px-[var(--space-2xl)] py-0',
      none: 'p-0',
    },
    scroll: {
      true: 'overflow-y-auto',
      false: 'min-h-0 overflow-hidden flex flex-col',
    },
  },
  defaultVariants: {
    padding: 'default',
    scroll: true,
  },
});

const footerVariants = cva(
  ['flex items-center gap-3', 'px-[var(--space-2xl)] pt-6 pb-[var(--space-2xl)]', 'flex-shrink-0'],
  {
    variants: {
      justify: {
        end: 'justify-end',
        between: 'justify-between',
      },
      bordered: {
        true: 'border-t border-stroke-subtle',
      },
    },
    defaultVariants: {
      justify: 'end',
    },
  }
);

const splitVariants = cva(['flex flex-row max-md:flex-col', 'flex-1 min-h-0']);

const sidebarVariants = cva(['flex-shrink-0', 'border-r border-stroke-subtle', 'overflow-y-auto'], {
  variants: {
    width: {
      sm: 'w-40',
      md: 'w-64',
    },
  },
  defaultVariants: {
    width: 'md',
  },
});

const paneVariants = cva(['flex-1', 'overflow-y-auto', 'p-[var(--space-2xl)]']);

// Focus Trap Hook

export type DialogInitialFocus = 'first' | 'container' | React.RefObject<HTMLElement | null>;

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Traps Tab focus inside `containerRef` while active and applies initial
 * focus on activation. Listens on the container (not document) so nested
 * dialogs and contained keyboard events don't interfere with each other.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  initialFocus: DialogInitialFocus = 'first'
): void {
  const initialFocusRef = useRef(initialFocus);

  useEffect(() => {
    initialFocusRef.current = initialFocus;
  }, [initialFocus]);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

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

    const target = initialFocusRef.current;
    if (target === 'container') {
      container.focus();
    } else if (target !== 'first' && target.current) {
      target.current.focus();
    } else {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        container.focus();
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, isActive]);
}

// Body Scroll Lock Hook

// Reference-counted so concurrent dialogs closing in any order can't restore
// stale captured styles (non-LIFO close previously unlocked under an open
// dialog, then re-locked the body permanently).
let bodyScrollLockCount = 0;
let bodyScrollOriginalOverflow = '';
let bodyScrollOriginalPaddingRight = '';

function acquireBodyScrollLock(): void {
  if (bodyScrollLockCount === 0) {
    bodyScrollOriginalOverflow = document.body.style.overflow;
    bodyScrollOriginalPaddingRight = document.body.style.paddingRight;

    // Calculate scrollbar width to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  bodyScrollLockCount += 1;
}

function releaseBodyScrollLock(): void {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = bodyScrollOriginalOverflow;
    document.body.style.paddingRight = bodyScrollOriginalPaddingRight;
  }
}

export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;
    acquireBodyScrollLock();
    return releaseBodyScrollLock;
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
function DialogRoot({
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

// Dialog Header

export interface DialogHeaderProps {
  /**
   * Dialog title. When omitted, provide `aria-label` on Dialog.Root.
   */
  title?: ReactNode;

  /**
   * Leading slot before the title (e.g. a back button or icon).
   */
  leading?: ReactNode;

  /**
   * Renders a bottom border under the header.
   * @default false
   */
  bordered?: boolean;

  /**
   * Whether to show the close button.
   * @default true
   */
  showCloseButton?: boolean;

  /**
   * Aria-label for the close button. Pass a translated string when available.
   * @default 'Close dialog'
   */
  closeAriaLabel?: string;

  /**
   * Trailing actions slot, rendered before the close button.
   */
  children?: ReactNode;
}

function DialogHeader({
  title,
  leading,
  bordered = false,
  showCloseButton = true,
  closeAriaLabel = 'Close dialog',
  children,
}: DialogHeaderProps) {
  const { titleId, onClose, dismissable, registerTitle } = useDialogContext();

  const hasTitle = title !== undefined && title !== null;

  // useLayoutEffect so aria-labelledby is wired before first paint.
  useLayoutEffect(() => {
    if (!hasTitle) return;
    return registerTitle();
  }, [hasTitle, registerTitle]);

  return (
    <div className={headerVariants({ bordered })}>
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        {hasTitle && (
          <h2 id={titleId} className="text-xl font-semibold text-content">
            {title}
          </h2>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {showCloseButton && (
          <Button
            iconOnly
            size="sm"
            variant="ghost"
            onClick={onClose}
            disabled={!dismissable}
            aria-label={closeAriaLabel}
          >
            <XIcon size="sm" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Dialog SubHeader

export interface DialogSubHeaderProps {
  /**
   * Row content, e.g. a tab bar or search input under the title.
   */
  children: ReactNode;
  className?: string;
}

function DialogSubHeader({ children, className }: DialogSubHeaderProps) {
  return <div className={cn(subHeaderVariants(), className)}>{children}</div>;
}

// Dialog Body

export interface DialogBodyProps {
  children: ReactNode;
  className?: string;

  /**
   * Built-in horizontal padding, or none when the content owns its padding.
   * @default 'default'
   */
  padding?: 'default' | 'none';

  /**
   * Scrollable body. When false the body becomes an overflow-hidden flex
   * column so a child (textarea, grid) can flex and scroll itself.
   * @default true
   */
  scroll?: boolean;
}

function DialogBody({ children, className, padding = 'default', scroll = true }: DialogBodyProps) {
  const { descriptionId, registerDescription } = useDialogContext();

  // useLayoutEffect so aria-describedby is wired before first paint.
  useLayoutEffect(() => registerDescription(), [registerDescription]);

  return (
    <div id={descriptionId} className={cn(bodyVariants({ padding, scroll }), className)}>
      {children}
    </div>
  );
}

// Dialog Split / Sidebar / Pane

export interface DialogSplitProps {
  /**
   * Two-column content, typically a Dialog.Sidebar followed by Dialog.Pane(s).
   * Stacks vertically below the MD breakpoint.
   */
  children: ReactNode;
  className?: string;
}

function DialogSplit({ children, className }: DialogSplitProps) {
  return <div className={cn(splitVariants(), className)}>{children}</div>;
}

export interface DialogSidebarProps {
  children: ReactNode;
  className?: string;

  /**
   * Rail width.
   * @default 'md'
   */
  width?: 'sm' | 'md';
}

function DialogSidebar({ children, className, width = 'md' }: DialogSidebarProps) {
  return <div className={cn(sidebarVariants({ width }), className)}>{children}</div>;
}

export interface DialogPaneProps {
  children: ReactNode;
  className?: string;
}

function DialogPane({ children, className }: DialogPaneProps) {
  return <div className={cn(paneVariants(), className)}>{children}</div>;
}

// Dialog Footer

export interface DialogFooterProps {
  children: ReactNode;
  className?: string;

  /**
   * Horizontal alignment of the footer actions.
   * @default 'end'
   */
  justify?: 'end' | 'between';

  /**
   * Renders a top border above the footer.
   * @default false
   */
  bordered?: boolean;

  /**
   * Leading slot pushed to the start (e.g. a warning line or legal links).
   */
  leading?: ReactNode;
}

function DialogFooter({
  children,
  className,
  justify = 'end',
  bordered = false,
  leading,
}: DialogFooterProps) {
  return (
    <div className={cn(footerVariants({ justify, bordered }), className)}>
      {leading && <div className="mr-auto flex items-center gap-3">{leading}</div>}
      {children}
    </div>
  );
}

// Compound Component Export

export const Dialog = {
  Root: DialogRoot,
  Header: DialogHeader,
  SubHeader: DialogSubHeader,
  Body: DialogBody,
  Split: DialogSplit,
  Sidebar: DialogSidebar,
  Pane: DialogPane,
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
   * Async-in-flight state: spinner on the confirm button, both buttons and
   * all dismissal paths disabled.
   * @default false
   */
  busy?: boolean;

  /**
   * Error line rendered below the message.
   */
  error?: string;

  /**
   * Decorative icon rendered in a tinted circle next to the title.
   */
  icon?: ReactNode;

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
 *
 * @example
 * <ConfirmDialog
 *   isOpen={open}
 *   title="Convert layout"
 *   message="Bins will be remapped to the half-grid."
 *   icon={<GridIcon size="md" />}
 *   busy={isRemediating}
 *   error={remediationError}
 *   onConfirm={remediate}
 *   onCancel={close}
 * />
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  busy = false,
  error,
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <DialogRoot open={isOpen} onClose={onCancel} size="md" dismissable={!busy}>
      <DialogHeader
        title={title}
        leading={
          icon ? (
            <div
              aria-hidden="true"
              className={cn(
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
                destructive ? intentBackgrounds.error : intentBackgrounds.warning
              )}
            >
              {icon}
            </div>
          ) : undefined
        }
      />
      <DialogBody>
        <p className="text-sm text-content-secondary">{message}</p>
        {error && (
          <Alert intent="error" className="mt-3">
            {error}
          </Alert>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {cancelText}
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
          {confirmText}
        </Button>
      </DialogFooter>
    </DialogRoot>
  );
}

// Named exports for type access
export type { DialogRootProps as DialogProps };
