/**
 * Dialog for confirming dimension sync from design to bins.
 *
 * Shows which bins can be updated and which will be unlinked.
 */

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { useLinkingStore } from '../../../store';
import { useBinLinking } from '../../../hooks';
import { formatDimensions } from '../../../domain';
import { useTranslation } from '@/i18n';

export function SyncDimensionsDialog() {
  const t = useTranslation();
  const { pendingSync, hideSyncDialog } = useLinkingStore(
    useShallow((s) => ({
      pendingSync: s.pendingSync,
      hideSyncDialog: s.hideSyncDialog,
    }))
  );
  const { executeSyncFromDesign } = useBinLinking();

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleCancel = useCallback(() => {
    hideSyncDialog();
  }, [hideSyncDialog]);

  // Focus management
  useEffect(() => {
    if (!pendingSync) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
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
  }, [pendingSync, handleCancel]);

  const handleSync = useCallback(async () => {
    if (!pendingSync) return;
    await executeSyncFromDesign(pendingSync.binIds, pendingSync.designId);
    hideSyncDialog();
  }, [pendingSync, executeSyncFromDesign, hideSyncDialog]);

  if (!pendingSync) return null;

  const { designName, comparison, eligibility, binsHaveVaryingDimensions } = pendingSync;
  const canSyncCount = eligibility.filter((e) => e.canSync).length;
  const willUnlinkCount = eligibility.filter((e) => !e.canSync).length;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in bg-overlay-dark"
      onClick={handleCancel}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-dialog-title"
        className="max-w-md w-full mx-4 animate-scale-in bg-surface-secondary border border-stroke rounded-[var(--radius-xl)] p-5"
        style={{ boxShadow: 'var(--shadow-xl)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <h2 id="sync-dialog-title" className="mb-1.5 text-lg font-semibold text-content">
          {t('designLinking.syncDialog.title')}
        </h2>

        <p className="mb-3 text-sm text-content-secondary">
          {t('designLinking.syncDialog.description', { name: designName })}
        </p>

        {/* Dimension comparison */}
        <div className="mb-3 p-2.5 bg-surface rounded-lg border border-stroke-subtle space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-content-secondary">
              {t('designLinking.syncDialog.designDimensions', {
                dimensions: formatDimensions(comparison.design),
              })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-content-secondary">
              {t('designLinking.syncDialog.binDimensions', {
                dimensions: formatDimensions(comparison.bin),
              })}
            </span>
          </div>
          {binsHaveVaryingDimensions && (
            <div className="text-xs text-status-warning mt-0.5">
              {t('designLinking.syncDialog.binsVary')}
            </div>
          )}
        </div>

        {/* Sync results preview */}
        <div className="mb-4 space-y-1.5">
          {canSyncCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-status-success">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t('designLinking.syncDialog.binsToUpdate', { count: canSyncCount })}
            </div>
          )}
          {willUnlinkCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-status-warning">
              <svg
                className="w-4 h-4 flex-shrink-0"
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
              {t('designLinking.syncDialog.binsToUnlink', { count: willUnlinkCount })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleCancel}
            className="btn btn-secondary h-8 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => void handleSync()}
            className="btn btn-primary h-8 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary"
          >
            {t('designLinking.syncDialog.sync')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
