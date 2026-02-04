import { useEffect, useRef, useState, useCallback, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { Button } from '../Button';
import { XIcon, CheckIcon, AlertTriangleIcon, InfoIcon } from '../Icon';
import { focusRing, interactiveTransition } from '../variants';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Variants
// ─────────────────────────────────────────────────────────────────────────────

const toastVariants = cva(
  [
    'relative',
    'flex items-start gap-3',
    'px-4 py-3',
    'rounded-lg',
    'shadow-floating',
    'min-w-[280px] max-w-[400px]',
    'pointer-events-auto',
    interactiveTransition,
  ],
  {
    variants: {
      type: {
        success: 'bg-toast-success text-white',
        error: 'bg-toast-error text-white',
        info: 'bg-toast-default text-content',
      },
    },
    defaultVariants: {
      type: 'info',
    },
  }
);

const containerVariants = cva(['fixed', 'z-50', 'flex flex-col', 'gap-2', 'pointer-events-none'], {
  variants: {
    position: {
      'top-center': 'top-4 left-1/2 -translate-x-1/2',
      'bottom-right': 'bottom-4 right-4',
      'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    },
  },
  defaultVariants: {
    position: 'bottom-right',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Toast Item Component
// ─────────────────────────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
  position: 'top' | 'bottom';
}

function ToastItem({ toast, onDismiss, position }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  // State for CSS animation pause (triggers re-render for progress bar)
  const [isPaused, setIsPaused] = useState(false);
  // Ref for timer logic (avoids effect re-runs)
  const isPausedRef = useRef(false);
  const remainingTimeRef = useRef(toast.duration ?? 5000);
  const lastTickRef = useRef(0);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    // Wait for exit animation before removing
    setTimeout(() => onDismiss(toast.id), 150);
  }, [onDismiss, toast.id]);

  // Auto-dismiss timer with pause support
  useEffect(() => {
    if (toast.duration === 0) return; // 0 means no auto-dismiss

    const duration = toast.duration ?? 5000;
    remainingTimeRef.current = duration;
    lastTickRef.current = Date.now();

    const tick = () => {
      const now = Date.now();

      if (!isPausedRef.current) {
        // Only decrement when not paused
        const elapsed = now - lastTickRef.current;
        remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);

        if (remainingTimeRef.current <= 0) {
          handleDismiss();
        }
      }

      // Always update lastTick to track time correctly on resume
      lastTickRef.current = now;
    };

    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [toast.duration, toast.id, handleDismiss]);

  // Pause on hover - update both ref (for timer) and state (for CSS animation)
  const handleMouseEnter = () => {
    isPausedRef.current = true;
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    lastTickRef.current = Date.now(); // Reset tick baseline for accurate timing
  };

  const Icon = {
    success: CheckIcon,
    error: AlertTriangleIcon,
    info: InfoIcon,
  }[toast.type];

  const animationClass = isExiting
    ? position === 'top'
      ? 'toast-exit-top'
      : 'toast-exit-bottom'
    : position === 'top'
      ? 'toast-enter-top'
      : 'toast-enter-bottom';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(toastVariants({ type: toast.type }), animationClass)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Icon size="md" className="flex-shrink-0 mt-0.5" aria-hidden="true" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{toast.message}</p>

        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            className={cn(
              'mt-1 text-sm font-medium underline underline-offset-2',
              'hover:opacity-80',
              interactiveTransition,
              ...focusRing
            )}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <Button
        iconOnly
        size="sm"
        variant="ghost"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        className="flex-shrink-0 -mr-1 -mt-1 hover:bg-white/10"
      >
        <XIcon size="sm" />
      </Button>

      {/* Progress bar */}
      {toast.duration !== 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="h-full bg-white/40"
            style={{
              animation: `toast-progress ${toast.duration ?? 5000}ms linear`,
              animationPlayState: isPaused ? 'paused' : 'running',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast Container
// ─────────────────────────────────────────────────────────────────────────────

type ContainerVariantProps = VariantProps<typeof containerVariants>;

export interface ToastContainerProps extends ContainerVariantProps {
  /**
   * Array of toast data to display.
   */
  toasts: ToastData[];

  /**
   * Called when a toast should be dismissed.
   */
  onDismiss: (id: string) => void;
}

/**
 * Container for displaying toast notifications.
 *
 * Typically used with a toast store or state management.
 * Handles positioning, animations, and auto-dismiss timers.
 *
 * @example
 * // With a simple state
 * const [toasts, setToasts] = useState<ToastData[]>([]);
 *
 * const addToast = (toast: Omit<ToastData, 'id'>) => {
 *   setToasts(t => [...t, { ...toast, id: crypto.randomUUID() }]);
 * };
 *
 * const removeToast = (id: string) => {
 *   setToasts(t => t.filter(toast => toast.id !== id));
 * };
 *
 * <ToastContainer
 *   toasts={toasts}
 *   onDismiss={removeToast}
 *   position="bottom-right"
 * />
 *
 * // Trigger a toast
 * addToast({ type: 'success', message: 'Changes saved!' });
 *
 * @example
 * // With action button
 * addToast({
 *   type: 'info',
 *   message: 'Item deleted',
 *   action: {
 *     label: 'Undo',
 *     onClick: () => undoDelete(),
 *   },
 * });
 *
 * @example
 * // Error toast (no auto-dismiss)
 * addToast({
 *   type: 'error',
 *   message: 'Failed to save changes',
 *   duration: 0, // Never auto-dismiss
 * });
 */
export const ToastContainer = forwardRef<HTMLDivElement, ToastContainerProps>(
  ({ toasts, onDismiss, position = 'bottom-right' }, ref) => {
    if (toasts.length === 0) return null;

    const isTop = position === 'top-center';

    return createPortal(
      <div ref={ref} className={containerVariants({ position })}>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
            position={isTop ? 'top' : 'bottom'}
          />
        ))}
      </div>,
      document.body
    );
  }
);

ToastContainer.displayName = 'ToastContainer';
