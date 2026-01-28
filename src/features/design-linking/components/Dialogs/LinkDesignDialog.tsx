/**
 * Dialog for linking an existing design to a bin.
 *
 * Shows compatible designs (matching footprint) and allows selection.
 * Footprint = same width and depth; height can differ.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { isOk } from '@/core/result';
import { listDesigns } from '@/features/bin-designer/storage/DesignerStorage';
import { useLinkingStore } from '../../store';
import { useBinLinking } from '../../hooks';
import { useTranslation } from '@/i18n';
import type { SavedDesign } from '@/features/bin-designer/types';

export function LinkDesignDialog() {
  const t = useTranslation();
  const { pendingLinkDesign, hideLinkDesignDialog } = useLinkingStore();
  const { linkBin } = useBinLinking();

  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter designs to only show compatible ones (matching footprint)
  const compatibleDesigns = useMemo(() => {
    if (!pendingLinkDesign) return [];
    const { width, depth } = pendingLinkDesign.footprint;
    return designs.filter(
      (d) => d.params.width === width && d.params.depth === depth
    );
  }, [designs, pendingLinkDesign]);

  const handleCancel = useCallback(() => {
    hideLinkDesignDialog();
  }, [hideLinkDesignDialog]);

  const handleSelect = useCallback(
    (design: SavedDesign) => {
      if (!pendingLinkDesign) return;
      linkBin(pendingLinkDesign.binId, design.id);
      hideLinkDesignDialog();
    },
    [pendingLinkDesign, linkBin, hideLinkDesignDialog]
  );

  // Load designs when dialog opens
  useEffect(() => {
    if (!pendingLinkDesign) return;

    setLoading(true);
    void listDesigns().then((result) => {
      if (isOk(result)) {
        setDesigns(result.value);
      }
      setLoading(false);
    });
  }, [pendingLinkDesign]);

  // Keyboard handling
  useEffect(() => {
    if (!pendingLinkDesign) return;

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
    };
  }, [pendingLinkDesign, handleCancel]);

  if (!pendingLinkDesign) return null;

  const { width, depth } = pendingLinkDesign.footprint;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in bg-overlay-dark"
      onClick={handleCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-design-title"
        className="max-w-lg w-full mx-4 max-h-[70vh] overflow-hidden animate-scale-in bg-surface-secondary border border-stroke rounded-[var(--radius-xl)]"
        style={{ boxShadow: 'var(--shadow-xl)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stroke-subtle px-5 py-4">
          <div>
            <h2 id="link-design-title" className="text-lg font-semibold text-content">
              {t('designLinking.linkDialog.title')}
            </h2>
            <p className="text-sm text-content-secondary mt-0.5">
              {t('designLinking.linkDialog.footprint', { width, depth })}
            </p>
          </div>
          <button
            onClick={handleCancel}
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

        {/* Design list */}
        <div className="max-h-[50vh] overflow-y-auto px-5 py-3" aria-busy={loading}>
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
          ) : compatibleDesigns.length === 0 ? (
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
              <p className="text-sm font-medium text-content-secondary">
                {t('designLinking.linkDialog.noCompatible')}
              </p>
              <p className="mt-1 text-xs text-content-disabled">
                {t('designLinking.linkDialog.noCompatibleHint', { width, depth })}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {compatibleDesigns.map((design) => {
                const { width: dw, depth: dd, height: dh, compartments } = design.params;
                const numCompartments = new Set(compartments.cells).size;

                return (
                  <li key={design.id}>
                    <button
                      onClick={() => handleSelect(design)}
                      className="w-full flex items-center gap-3 rounded-lg border border-stroke-subtle px-3 py-2.5 transition-colors hover:bg-surface-hover hover:border-stroke text-left"
                    >
                      {/* Thumbnail - 16x16 (64px) for better visibility */}
                      {design.thumbnail ? (
                        <div className="w-16 h-16 rounded-md overflow-hidden bg-surface-elevated flex-shrink-0">
                          <img
                            src={design.thumbnail}
                            alt={design.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-md bg-surface-elevated flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-7 h-7 text-content-disabled"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
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
                      )}

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-content">
                          {design.name}
                        </p>
                        <p className="text-xs text-content-secondary">
                          {dw}×{dd}×{dh}u
                          {numCompartments > 1 && (
                            <span className="ml-1.5 text-content-tertiary">
                              · {numCompartments} {t('binDesigner.compartments')}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Select indicator */}
                      <svg
                        className="h-5 w-5 text-content-tertiary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-stroke-subtle px-5 py-4">
          <button onClick={handleCancel} className="btn btn-secondary">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
