/**
 * Warning dialog shown before deleting a baseplate library design.
 *
 * Confirms the destructive delete and, when the current layout links the
 * design (`affectedCount > 0`), notes that it will lose the link. Cross-layout
 * usage isn't enumerated, so the copy avoids asserting a global count.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';

interface DeleteBaseplateWarningDialogProps {
  isOpen: boolean;
  designName: string;
  affectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteBaseplateWarningDialog({
  isOpen,
  designName,
  affectedCount,
  onConfirm,
  onCancel,
}: DeleteBaseplateWarningDialogProps) {
  const t = useTranslation();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    cancelButtonRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    // Capture phase: the dialog container calls stopPropagation on keydown,
    // which would otherwise starve this bubble-phase listener.
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape, true);
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in bg-overlay-dark"
      onClick={onCancel}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="baseplate-delete-warning-title"
        aria-describedby="baseplate-delete-warning-description"
        className="max-w-md w-full mx-4 animate-scale-in bg-surface-secondary border border-stroke rounded-[var(--radius-xl)] p-5"
        style={{ boxShadow: 'var(--shadow-xl)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-status-warning/10 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-status-warning"
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
          <h2 id="baseplate-delete-warning-title" className="text-lg font-semibold text-content">
            {t('baseplate.library.deleteWarning.title')}
          </h2>
        </div>

        <p
          id="baseplate-delete-warning-description"
          className="mb-3 text-sm text-content-secondary"
        >
          {t('baseplate.library.deleteWarning.description')}
        </p>

        <div className="mb-4 p-2.5 bg-surface rounded-lg border border-stroke-subtle">
          <div className="text-sm font-medium text-content">{designName}</div>
          {affectedCount > 0 && (
            <div className="text-xs text-content-disabled mt-0.5">
              {t('baseplate.library.deleteWarning.usedByCurrent')}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button ref={cancelButtonRef} variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {t('baseplate.library.deleteWarning.confirm')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
