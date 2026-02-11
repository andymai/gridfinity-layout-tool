/**
 * Dialog for creating a new design from an existing bin.
 *
 * Prompts for design name, with default based on bin dimensions.
 * Option to include the bin's label in the name.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLinkingStore } from '../../../store';
import { useBinLinking } from '../../../hooks';
import { formatDimensions } from '../../../domain';
import { useTranslation } from '@/i18n';

export function CreateDesignDialog() {
  const t = useTranslation();
  const { pendingCreateDesign, hideCreateDesignDialog } = useLinkingStore();
  const { navigateToCreateDesign } = useBinLinking();

  const [name, setName] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleCancel = useCallback(() => {
    hideCreateDesignDialog();
    setName('');
  }, [hideCreateDesignDialog]);

  // Initialize name and focus management when dialog opens
  useEffect(() => {
    if (!pendingCreateDesign) return;

    // Initialize name with default (deferred to avoid synchronous setState in effect)
    queueMicrotask(() => setName(pendingCreateDesign.defaultName));

    previousFocusRef.current = document.activeElement as HTMLElement;
    setTimeout(() => inputRef.current?.select(), 0);
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
  }, [pendingCreateDesign, handleCancel]);

  const handleCreate = useCallback(() => {
    if (!pendingCreateDesign || !name.trim()) return;

    const { binId, dimensions } = pendingCreateDesign;
    navigateToCreateDesign(
      binId,
      name.trim(),
      dimensions.width,
      dimensions.depth,
      dimensions.height
    );
    setName('');
  }, [pendingCreateDesign, name, navigateToCreateDesign]);

  const handleUseBinLabel = useCallback(() => {
    if (pendingCreateDesign?.binLabel) {
      setName(pendingCreateDesign.binLabel);
    }
  }, [pendingCreateDesign]);

  const handleSubmit = useCallback(
    (e: React.SubmitEvent) => {
      e.preventDefault();
      handleCreate();
    },
    [handleCreate]
  );

  if (!pendingCreateDesign) return null;

  const { dimensions, binLabel } = pendingCreateDesign;
  const dimensionStr = formatDimensions(dimensions);

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
        aria-labelledby="create-design-title"
        className="max-w-md w-full mx-4 animate-scale-in bg-surface-secondary border border-stroke rounded-[var(--radius-xl)] p-5"
        style={{ boxShadow: 'var(--shadow-xl)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <h2 id="create-design-title" className="mb-3 text-lg font-semibold text-content">
          {t('designLinking.createDialog.title')}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Name input */}
          <div className="mb-3">
            <label htmlFor="design-name" className="block text-sm text-content-secondary mb-1">
              {t('designLinking.createDialog.nameLabel')}
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                id="design-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('designLinking.createDialog.namePlaceholder')}
                className="input flex-1"
                maxLength={64}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional autofocus for modal/dialog UX
                autoFocus
              />
              {binLabel && (
                <button
                  type="button"
                  onClick={handleUseBinLabel}
                  className="btn btn-secondary text-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary"
                  title={t('designLinking.createDialog.useLabelTooltip', { label: binLabel })}
                >
                  {t('designLinking.createDialog.useLabel')}
                </button>
              )}
            </div>
          </div>

          {/* Dimensions display */}
          <div className="mb-4 p-2.5 bg-surface rounded-lg border border-stroke-subtle">
            <div className="text-sm text-content-secondary">
              {t('designLinking.createDialog.dimensions', {
                width: dimensions.width,
                depth: dimensions.depth,
                height: dimensions.height,
              })}
            </div>
            <div className="text-xs text-content-disabled mt-0.5">
              {t('designLinking.createDialog.gridUnits', { dimensions: dimensionStr })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-secondary h-8 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary h-8 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary"
              disabled={!name.trim()}
            >
              {t('designLinking.createDialog.create')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
