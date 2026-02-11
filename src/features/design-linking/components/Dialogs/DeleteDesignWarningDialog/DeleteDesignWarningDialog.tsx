/**
 * Warning dialog shown when deleting a design that has linked bins.
 *
 * Informs user that linked bins will be unlinked upon deletion.
 */

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLinkingStore } from '../../../store';
import { useTranslation } from '@/i18n';

export function DeleteDesignWarningDialog() {
  const t = useTranslation();
  const { pendingDeleteWarning, hideDeleteWarning } = useLinkingStore();

  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleCancel = useCallback(() => {
    pendingDeleteWarning?.onCancel();
    hideDeleteWarning();
  }, [pendingDeleteWarning, hideDeleteWarning]);

  // Focus management
  useEffect(() => {
    if (!pendingDeleteWarning) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    cancelButtonRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [pendingDeleteWarning, handleCancel]);

  const handleConfirm = useCallback(() => {
    pendingDeleteWarning?.onConfirm();
    hideDeleteWarning();
  }, [pendingDeleteWarning, hideDeleteWarning]);

  if (!pendingDeleteWarning) return null;

  const { designName, linkedBinIds } = pendingDeleteWarning;
  const count = linkedBinIds.length;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in bg-overlay-dark"
      onClick={handleCancel}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-warning-title"
        aria-describedby="delete-warning-description"
        className="max-w-md w-full mx-4 animate-scale-in bg-surface-secondary border border-stroke rounded-[var(--radius-xl)] p-5"
        style={{ boxShadow: 'var(--shadow-xl)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Warning icon */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-status-warning/10 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-status-warning"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 id="delete-warning-title" className="text-lg font-semibold text-content">
            {t('designLinking.deleteWarning.title')}
          </h2>
        </div>

        <p id="delete-warning-description" className="mb-3 text-sm text-content-secondary">
          {t('designLinking.deleteWarning.description', { count })}
        </p>

        {/* Design name badge */}
        <div className="mb-4 p-2.5 bg-surface rounded-lg border border-stroke-subtle">
          <div className="text-sm font-medium text-content">{designName}</div>
          <div className="text-xs text-content-disabled mt-0.5">
            {t('designLinking.deleteWarning.linkedBinsCount', { count })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            ref={cancelButtonRef}
            onClick={handleCancel}
            className="btn btn-secondary h-8 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className="btn btn-danger h-8 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary"
          >
            {t('designLinking.deleteWarning.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
