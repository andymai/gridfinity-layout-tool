/**
 * Dialog for linking an existing design to a bin.
 *
 * Shows compatible designs (matching footprint) and allows selection.
 * Footprint = same width and depth; height can differ (with warning).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { isOk } from '@/core/result';
import { listDesigns } from '@/features/bin-designer/storage/DesignerStorage';
import { useLinkingStore } from '../../../store';
import { useBinLinking } from '../../../hooks';
import { useTranslation } from '@/i18n';
import type { SavedDesign } from '@/features/bin-designer/types';

export function LinkDesignDialog() {
  const t = useTranslation();
  const { pendingLinkDesign, hideLinkDesignDialog } = useLinkingStore();
  const { linkBin } = useBinLinking();

  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter designs to only show compatible ones (matching footprint)
  const compatibleDesigns = useMemo(() => {
    if (!pendingLinkDesign) return [];
    const { width, depth } = pendingLinkDesign.footprint;
    return designs.filter((d) => d.params.width === width && d.params.depth === depth);
  }, [designs, pendingLinkDesign]);

  // Further filter by search query
  const filteredDesigns = useMemo(() => {
    if (!searchQuery.trim()) return compatibleDesigns;
    const query = searchQuery.toLowerCase();
    return compatibleDesigns.filter((d) => d.name.toLowerCase().includes(query));
  }, [compatibleDesigns, searchQuery]);

  const handleCancel = useCallback(() => {
    hideLinkDesignDialog();
    setSearchQuery('');
  }, [hideLinkDesignDialog]);

  const handleSelect = useCallback(
    (design: SavedDesign) => {
      if (!pendingLinkDesign) return;
      linkBin(pendingLinkDesign.binId, design.id);
      hideLinkDesignDialog();
      setSearchQuery('');
    },
    [pendingLinkDesign, linkBin, hideLinkDesignDialog]
  );

  // Load designs when dialog opens
  useEffect(() => {
    if (!pendingLinkDesign) return;

    let cancelled = false;
    setLoading(true);
    setSearchQuery('');

    void listDesigns().then((result) => {
      if (cancelled) return;
      if (isOk(result)) {
        setDesigns(result.value);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
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
  const binHeight = pendingLinkDesign.binHeight;
  const showSearch = !loading && compatibleDesigns.length > 3;
  const hasSearchResults = filteredDesigns.length > 0;
  const isSearching = searchQuery.trim().length > 0;

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
        className="max-w-lg w-full mx-4 max-h-[70vh] overflow-hidden animate-scale-in bg-surface-secondary border border-stroke rounded-[var(--radius-xl)] flex flex-col"
        style={{ boxShadow: 'var(--shadow-xl)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - compact */}
        <div className="flex items-center justify-between border-b border-stroke-subtle px-4 py-3 flex-shrink-0">
          <div>
            <h2 id="link-design-title" className="text-base font-semibold text-content">
              {t('designLinking.linkDialog.title')}
            </h2>
            <p className="text-xs text-content-secondary mt-0.5">
              {t('designLinking.linkDialog.footprint', { width, depth })}
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-md p-1.5 text-content-secondary hover:bg-surface-hover hover:text-content transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary"
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

        {/* Search input - shown when enough designs */}
        {showSearch && (
          <div className="px-4 py-2 border-b border-stroke-subtle flex-shrink-0">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('designLinking.linkDialog.searchPlaceholder')}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface border border-stroke rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-content-tertiary hover:text-content transition-colors"
                  aria-label={t('common.clear')}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Design list - scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0" aria-busy={loading}>
          {loading ? (
            /* Loading skeleton */
            <div className="space-y-2">
              <div className="flex items-center gap-2 py-1 text-xs text-content-tertiary">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                {t('designLinking.linkDialog.loading')}
              </div>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse motion-reduce:animate-none items-center gap-3 rounded-lg border border-stroke-subtle px-3 py-2"
                >
                  <div className="h-12 w-12 flex-shrink-0 rounded-md bg-surface-elevated" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-28 rounded bg-surface-elevated" />
                    <div className="h-3 w-20 rounded bg-surface-elevated" />
                  </div>
                </div>
              ))}
            </div>
          ) : compatibleDesigns.length === 0 ? (
            /* No compatible designs empty state */
            <div className="py-6 text-center">
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
              <p className="mt-1 text-xs text-content-disabled max-w-xs mx-auto">
                {t('designLinking.linkDialog.noCompatibleHint', { width, depth })}
              </p>
            </div>
          ) : !hasSearchResults && isSearching ? (
            /* Search returned no results */
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <p className="text-sm text-content-secondary">
                {t('designLinking.linkDialog.noResults')}
              </p>
            </div>
          ) : (
            /* Design list */
            <ul className="space-y-1.5">
              {filteredDesigns.map((design) => {
                const { width: dw, depth: dd, height: dh, compartments } = design.params;
                const numCompartments = new Set(compartments.cells).size;
                const heightMismatch = dh !== binHeight;

                return (
                  <li key={design.id}>
                    <button
                      onClick={() => handleSelect(design)}
                      className="w-full flex items-center gap-3 rounded-lg border border-stroke-subtle px-3 py-2 transition-colors hover:bg-surface-hover hover:border-stroke text-left focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset"
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-md overflow-hidden bg-surface-elevated flex-shrink-0 relative">
                        {design.thumbnail ? (
                          <img
                            src={design.thumbnail}
                            alt={design.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center border border-dashed border-stroke-subtle">
                            <svg
                              className="w-5 h-5 text-content-disabled"
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
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium text-content">{design.name}</p>
                          {heightMismatch && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-status-warning/10 text-status-warning">
                              {t('designLinking.linkDialog.heightMismatch')}
                            </span>
                          )}
                        </div>
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
                        className="h-4 w-4 text-content-tertiary flex-shrink-0"
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

        {/* Footer - compact */}
        <div className="flex justify-end gap-2 border-t border-stroke-subtle px-4 py-3 flex-shrink-0">
          <button onClick={handleCancel} className="btn btn-secondary h-8 text-sm px-3">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
