import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HalfBinConstraintViolation } from '@/utils/halfBinConstraints';
import { useTranslation } from '@/i18n';

interface HalfBinModeBlockedModalProps {
  isOpen: boolean;
  violation: HalfBinConstraintViolation;
  onClose: () => void;
  onRemediate: () => void | Promise<void>;
}

/**
 * Modal shown when user attempts to disable half-bin mode while fractional bins exist.
 *
 * Provides clear explanation of the constraint violation and offers a one-click
 * remediation action to move all fractional bins to the staging area.
 *
 * ## Features
 * - Loading state during remediation
 * - Error handling with user feedback
 * - Accessible (ARIA labels, focus management, keyboard navigation)
 * - Escape key to cancel
 * - Focus trap within modal
 *
 * @example
 * ```tsx
 * const [showModal, setShowModal] = useState(false);
 * const [violation, setViolation] = useState<HalfBinConstraintViolation | null>(null);
 *
 * const handleRemediate = async () => {
 *   // Move bins to staging
 *   await execute(() => {
 *     violation.binIds.forEach(id => moveBinToStaging(id));
 *   });
 *   toggleHalfBinMode();
 * };
 *
 * <HalfBinModeBlockedModal
 *   isOpen={showModal}
 *   violation={violation}
 *   onClose={() => setShowModal(false)}
 *   onRemediate={handleRemediate}
 * />
 * ```
 */
export function HalfBinModeBlockedModal({
  isOpen,
  violation,
  onClose,
  onRemediate,
}: HalfBinModeBlockedModalProps) {
  const t = useTranslation();
  const [isRemediating, setIsRemediating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus the cancel button when dialog opens
    cancelButtonRef.current?.focus();

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRemediating) {
        onClose();
      }
    };

    // Focus trap
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTab);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTab);
    };
  }, [isOpen, isRemediating, onClose]);

  const handleRemediate = async () => {
    setIsRemediating(true);
    setError(null);

    try {
      await onRemediate();
      // Success - modal will be closed by parent component
    } catch (err) {
      setError(err instanceof Error ? err.message : t('halfBinBlocked.errorFallback'));
      setIsRemediating(false);
    }
  };

  if (!isOpen) return null;

  // Use portal to escape parent stacking contexts (e.g., BottomSheet with transform)
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in bg-overlay-dark"
      onClick={isRemediating ? undefined : onClose}
      role="presentation"
    >
      <div role="presentation" onClick={(e) => e.stopPropagation()}>
        <div
          ref={dialogRef}
          className="relative bg-surface rounded-lg shadow-2xl p-6 max-w-md mx-4 animate-scale-in border border-stroke"
          role="dialog"
          aria-labelledby="half-bin-blocked-title"
          aria-describedby="half-bin-blocked-message"
          aria-modal="true"
        >
          {/* Icon */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-warning-muted flex items-center justify-center">
              <svg
                className="w-6 h-6 text-warning"
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
            </div>

            <div className="flex-1 min-w-0">
              {/* Title */}
              <h2 id="half-bin-blocked-title" className="text-lg font-semibold text-content mb-2">
                {t('halfBinBlocked.title')}
              </h2>

              {/* Message */}
              <div id="half-bin-blocked-message" className="space-y-3">
                <p className="text-sm text-content-secondary leading-relaxed">
                  {t('halfBinBlocked.message')}
                </p>
              </div>

              {/* Error message */}
              {error && (
                <div
                  className="mt-4 p-3 rounded-md bg-error-muted border border-error/20"
                  role="alert"
                >
                  <p className="text-sm text-error font-medium">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              ref={cancelButtonRef}
              onClick={onClose}
              disabled={isRemediating}
              className="px-4 py-2 text-sm font-medium rounded-md
                     text-content-secondary hover:text-content
                     hover:bg-surface-elevated
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
              aria-label={t('halfBinBlocked.cancelAriaLabel')}
            >
              {t('common.cancel')}
            </button>

            <button
              onClick={handleRemediate}
              disabled={isRemediating}
              className="px-4 py-2 text-sm font-medium rounded-md
                     bg-accent text-on-dark
                     hover:bg-accent/90
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors
                     flex items-center gap-2"
              aria-label={t('halfBinMode.remediate.ariaLabel', { count: violation.count })}
            >
              {isRemediating ? (
                <>
                  <svg
                    className="animate-spin motion-reduce:animate-none h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>{t('common.loading')}</span>
                </>
              ) : (
                <>
                  <span>{t('halfBinBlocked.close')}</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
