import { useState, useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import type { Toast, ToastType } from '@/core/store/toast';
import { useToastStore } from '@/core/store/toast';
import { useResponsive } from '@/shared/hooks';
import { useTranslation } from '@/i18n';

// Animation duration must match CSS in index.css (.toast-exit-*)
const EXIT_ANIMATION_MS = 150;

// Icons for each toast type
function SuccessIcon() {
  return (
    <svg
      className="w-5 h-5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      className="w-5 h-5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      className="w-5 h-5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// Static style config - defined outside component to avoid recreation
const TYPE_STYLES: Record<ToastType, { bg: string; border: string; progressColor: string }> = {
  error: { bg: 'bg-toast-error', border: 'border-error', progressColor: 'bg-error' },
  success: { bg: 'bg-toast-success', border: 'border-success', progressColor: 'bg-success' },
  info: { bg: 'bg-toast-default', border: 'border-stroke', progressColor: 'bg-content-tertiary' },
};

interface ToastItemProps {
  toast: Toast;
  position: 'top' | 'bottom';
  onRemove: (id: string) => void;
}

function ToastItem({ toast, position, onRemove }: ToastItemProps) {
  const t = useTranslation();
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(toast.duration);
  const startTimeRef = useRef(0);

  const handleDismiss = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    // Wait for exit animation to complete
    setTimeout(() => onRemove(toast.id), EXIT_ANIMATION_MS);
  }, [isExiting, onRemove, toast.id]);

  // Timer management with pause/resume
  useEffect(() => {
    if (toast.duration === 0) return; // No auto-dismiss

    const startTimer = () => {
      startTimeRef.current = performance.now();
      timerRef.current = setTimeout(handleDismiss, remainingRef.current);
    };

    const pauseTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        // Calculate how much time is left
        const elapsed = performance.now() - startTimeRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      }
    };

    if (isPaused) {
      pauseTimer();
    } else {
      startTimer();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPaused, toast.duration, handleDismiss]);

  const style = TYPE_STYLES[toast.type];

  // Animation classes based on position and state
  const animationClass = isExiting
    ? position === 'top'
      ? 'toast-exit-top'
      : 'toast-exit-bottom'
    : position === 'top'
      ? 'toast-enter-top'
      : 'toast-enter-bottom';

  // Icon based on type
  const Icon =
    toast.type === 'error' ? ErrorIcon : toast.type === 'success' ? SuccessIcon : InfoIcon;

  return (
    <div
      className={`
        relative overflow-hidden
        flex items-start gap-3 p-4 pr-10
        rounded-xl border shadow-lg backdrop-blur-sm
        ${style.bg} ${style.border} text-on-dark
        ${animationClass}
      `}
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <Icon />
      </div>

      {/* Message and action */}
      <div className="flex-1 min-w-0">
        <div className="text-sm leading-relaxed whitespace-pre-wrap pr-1">{toast.message}</div>
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            className="mt-2 text-sm font-medium underline underline-offset-2 opacity-90 hover:opacity-100 transition-opacity"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-1/2 -translate-y-1/2 right-1 p-2 flex items-center justify-center rounded-md text-current opacity-60 hover:opacity-100 hover:bg-white/10 transition-all focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:opacity-100"
        aria-label={t('toast.dismissNotification')}
      >
        <CloseIcon />
      </button>

      {/* Progress bar */}
      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 overflow-hidden">
          <div
            className={`h-full ${style.progressColor} opacity-60`}
            style={{
              animation: `toast-progress ${toast.duration}ms linear forwards`,
              animationPlayState: isPaused ? 'paused' : 'running',
            }}
          />
        </div>
      )}
    </div>
  );
}

export function ToastContainer() {
  const t = useTranslation();
  const { toasts, removeToast } = useToastStore(
    useShallow((state) => ({
      toasts: state.toasts,
      removeToast: state.removeToast,
    }))
  );
  const { isMobile } = useResponsive();

  if (toasts.length === 0) return null;

  // Position: top-center on mobile, bottom-right on tablet/desktop
  const position = isMobile ? 'top' : 'bottom';

  const containerClasses = isMobile
    ? 'fixed top-0 left-0 right-0 z-50 flex flex-col items-center gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))]'
    : 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';

  const toastWidth = isMobile ? 'w-full max-w-md' : 'w-80';

  return (
    <div className={containerClasses} role="region" aria-label={t('toast.notifications')} aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={toastWidth}>
          <ToastItem toast={toast} position={position} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
}
