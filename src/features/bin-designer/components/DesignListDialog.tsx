/**
 * Design list dialog for the Bin Designer.
 *
 * Shows all saved designs with load, rename, and delete actions.
 * Accessible from the header via the design name/selector.
 */

import { useCallback, useEffect, useState } from 'react';
import { isOk } from '@/core/result';
import { listDesigns, deleteDesign } from '@/features/bin-designer/storage/DesignerStorage';
import { removeRegistryEntry } from '../store/customBinRegistry';
import { useDesignerStore } from '../store';
import { useDesignerRouting } from '@/hooks/useDesignerRouting';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useToastStore } from '@/core/store/toast';
import { BinDesignThumbnail } from './BinDesignThumbnail';
import type { SavedDesign } from '../types';
import { useTranslation, useFormatting } from '@/i18n';

interface DesignListDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Renders a modal dialog listing saved designs and providing load, rename, delete, and create actions.
 *
 * @param open - Whether the dialog is visible
 * @param onClose - Callback invoked to close the dialog
 * @returns The dialog's JSX element when open, otherwise `null`
 */
export function DesignListDialog({ open, onClose }: DesignListDialogProps) {
  const t = useTranslation();
  const { formatRelativeDate } = useFormatting();
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const dialogRef = useFocusTrap<HTMLDivElement>({
    active: open,
    onEscape: onClose,
  });

  const loadDesign = useDesignerStore((s) => s.loadDesign);
  const newDesign = useDesignerStore((s) => s.newDesign);
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const { navigateToDesign, syncUrlToDesign } = useDesignerRouting();
  const addToast = useToastStore((s) => s.addToast);

  const refreshDesigns = useCallback(async () => {
    setLoading(true);
    const result = await listDesigns();
    if (isOk(result)) {
      setDesigns(result.value);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      void refreshDesigns();
    }
  }, [open, refreshDesigns]);

  const handleLoad = useCallback(
    (design: SavedDesign) => {
      loadDesign(design);
      navigateToDesign(design.id);
      addToast({ message: `Loaded "${design.name}"`, type: 'success', duration: 2000 });
      onClose();
    },
    [loadDesign, navigateToDesign, addToast, onClose]
  );

  const handleNewDesign = useCallback(() => {
    // Confirm if user has an active design with history
    const state = useDesignerStore.getState();
    if (state.currentDesignId && state.history.past.length > 0) {
      if (
        !window.confirm('Start a new design? Your current design is saved and can be loaded later.')
      ) {
        return;
      }
    }
    newDesign();
    syncUrlToDesign(null);
    addToast({ message: 'New design created', type: 'success', duration: 2000 });
    onClose();
  }, [newDesign, syncUrlToDesign, addToast, onClose]);

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
      const result = await deleteDesign(id);
      if (isOk(result)) {
        setDesigns((prev) => prev.filter((d) => d.id !== id));
        removeRegistryEntry(id);
        addToast({ message: `Deleted "${name}"`, type: 'success', duration: 2000 });
      } else {
        addToast({ message: 'Failed to delete design', type: 'error', duration: 4000 });
      }
    },
    [addToast]
  );

  const handleRenameStart = useCallback((design: SavedDesign) => {
    setEditingId(design.id);
    setEditName(design.name);
  }, []);

  const handleRenameConfirm = useCallback(
    async (design: SavedDesign) => {
      const trimmed = editName.trim();
      if (trimmed && trimmed !== design.name) {
        // Re-save with updated name (uses saveDesign which preserves createdAt)
        const { saveDesign } = await import('@/features/bin-designer/storage/DesignerStorage');
        await saveDesign({ ...design, name: trimmed });
        setDesigns((prev) => prev.map((d) => (d.id === design.id ? { ...d, name: trimmed } : d)));
        // Update current design name if this is the active one
        if (design.id === currentDesignId) {
          useDesignerStore.getState().setDesignName(trimmed);
        }
      }
      setEditingId(null);
    },
    [editName, currentDesignId]
  );

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('binDesigner.myDesigns')}
    >
      <div
        className="mx-4 max-h-[70vh] w-full max-w-lg overflow-hidden rounded-xl border border-stroke-subtle bg-surface-secondary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stroke-subtle px-5 py-4">
          <h2 className="text-lg font-semibold text-content">{t('binDesigner.myDesigns')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewDesign}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface transition-colors hover:bg-accent-hover"
            >{t('binDesigner.newDesign')}</button>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-content-secondary hover:bg-surface-hover hover:text-content"
              aria-label={t('common.close')}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Design list */}
        <div
          className="max-h-[50vh] overflow-y-auto px-5 py-3"
          aria-busy={loading}
          aria-label={t('binDesigner.savedDesigns')}
        >
          {loading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse motion-reduce:animate-none items-center gap-3 rounded-lg border border-stroke-subtle px-3 py-2.5"
                >
                  <div className="h-10 w-10 flex-shrink-0 rounded-md bg-surface-elevated" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-24 rounded bg-surface-elevated" />
                    <div className="h-3 w-16 rounded bg-surface-elevated" />
                  </div>
                </div>
              ))}
            </div>
          ) : designs.length === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
                <svg
                  className="h-6 w-6 text-content-tertiary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-content-secondary">{t('binDesigner.noSavedDesignsYet')}</p>
              <p className="mt-1 text-xs text-content-disabled">{t('binDesigner.changesAreSavedAutomaticallyAsYouDe')}</p>
              <button
                onClick={() => {
                  handleNewDesign();
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface transition-colors hover:bg-accent-hover"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>{t('binDesigner.startANewDesign')}</button>
            </div>
          ) : (
            <ul className="space-y-2">
              {designs.map((design) => {
                const isActive = design.id === currentDesignId;
                const { width, depth, height, compartments } = design.params;
                const numCompartments = new Set(compartments.cells).size;

                return (
                  <li
                    key={design.id}
                    className={`group relative flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                      isActive
                        ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
                        : 'border-stroke-subtle hover:bg-surface-hover'
                    }`}
                  >
                    {/* Active badge */}
                    {isActive && (
                      <span className="absolute -top-2 left-3 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface">
                        {t('binDesigner.active')}
                      </span>
                    )}

                    {/* Isometric thumbnail */}
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-surface-elevated">
                      <BinDesignThumbnail params={design.params} size={40} />
                    </div>

                    {/* Name, dimensions & date */}
                    <div className="min-w-0 flex-1">
                      {editingId === design.id ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={() => void handleRenameConfirm(design)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleRenameConfirm(design);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="w-full rounded border border-accent bg-surface px-1.5 py-0.5 text-sm text-content outline-none"
                          autoFocus
                          aria-label={t('binDesigner.designName')}
                        />
                      ) : (
                        <p className="truncate text-sm font-medium text-content">{design.name}</p>
                      )}
                      <p className="text-xs text-content-secondary">
                        {width}×{depth}×{height}u
                        {numCompartments > 1 && (
                          <span className="ml-1.5 text-content-tertiary">
                            · {numCompartments} {t('binDesigner.compartments')}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-content-tertiary">
                        {formatRelativeDate(design.updatedAt, { includeTime: true })}
                      </p>
                    </div>

                    {/* Actions — always visible on touch, hover/focus on desktop */}
                    <div className="flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      {!isActive && (
                        <button
                          onClick={() => handleLoad(design)}
                          className="rounded px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10"
                          aria-label={`Load ${design.name}`}
                        >{t('binDesigner.load')}</button>
                      )}
                      <button
                        onClick={() => handleRenameStart(design)}
                        className="rounded p-1 text-content-secondary hover:bg-surface-hover hover:text-content"
                        aria-label={`Rename ${design.name}`}
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => void handleDelete(design.id, design.name)}
                        className="rounded p-1 text-content-secondary hover:bg-red-500/10 hover:text-red-400"
                        aria-label={`Delete ${design.name}`}
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
