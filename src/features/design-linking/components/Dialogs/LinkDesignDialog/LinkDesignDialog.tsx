/**
 * Dialog for linking an existing design to a bin.
 *
 * Shows compatible designs (matching footprint) and allows selection.
 * Footprint = same width and depth; height can differ (with warning).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isOk } from '@/core/result';
import {
  designFootprint,
  isBinDesign,
  listDesigns,
  type SavedDesign,
} from '@/features/bin-designer';
import { useShallow } from 'zustand/react/shallow';
import { useLinkingStore } from '../../../store';
import { useBinLinking } from '../../../hooks';
import { Button, IconButton, XIcon } from '@/design-system';
import { useTranslation } from '@/i18n';

export function LinkDesignDialog() {
  const t = useTranslation();
  const { pendingLinkDesign, hideLinkDesignDialog } = useLinkingStore(
    useShallow((s) => ({
      pendingLinkDesign: s.pendingLinkDesign,
      hideLinkDesignDialog: s.hideLinkDesignDialog,
    }))
  );
  const { linkBin } = useBinLinking();

  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [fetchedForBinId, setFetchedForBinId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Derive loading: true when dialog is open but designs haven't been fetched for current bin
  const loading = pendingLinkDesign !== null && fetchedForBinId !== pendingLinkDesign.binId;

  // Reset search query when pendingLinkDesign changes
  const prevBinIdRef = useRef<string | null>(null);
  const currentBinId = pendingLinkDesign?.binId ?? null;
  if (currentBinId !== prevBinIdRef.current) {
    prevBinIdRef.current = currentBinId;
    if (searchQuery !== '') {
      setSearchQuery('');
    }
  }

  // Filter designs to only show compatible ones (matching footprint)
  const compatibleDesigns = useMemo(() => {
    if (!pendingLinkDesign) return [];
    const { width, depth } = pendingLinkDesign.footprint;
    // Linkable kinds: parametric bins and imported meshes. Other non-bin
    // items (tool racks) have no bin semantics and stay excluded.
    return designs.filter((d) => {
      if (!isBinDesign(d) && d.structure?.kind !== 'importedMesh') return false;
      const fp = designFootprint(d);
      return fp.width === width && fp.depth === depth;
    });
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

    void listDesigns().then((result) => {
      if (cancelled) return;
      if (isOk(result)) {
        setDesigns(result.value);
      }
      setFetchedForBinId(pendingLinkDesign.binId);
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
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-design-title"
        className="max-w-lg w-full mx-4 max-h-[70vh] overflow-hidden animate-scale-in bg-surface-secondary border border-stroke rounded-[var(--radius-xl)] flex flex-col"
        style={{ boxShadow: 'var(--shadow-xl)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
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
          <IconButton
            onClick={handleCancel}
            touchTarget={false}
            className="text-content-secondary hover:text-content"
            aria-label={t('common.close')}
          >
            <XIcon size="md" />
          </IconButton>
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
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface border border-stroke rounded-md transition-colors"
              />
              {searchQuery && (
                <IconButton
                  onClick={() => setSearchQuery('')}
                  size="sm"
                  touchTarget={false}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content"
                  aria-label={t('common.clear')}
                >
                  <XIcon size="sm" />
                </IconButton>
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
                const { width: dw, depth: dd, height: dh } = designFootprint(design);
                const numCompartments = design.params
                  ? new Set(design.params.compartments.cells).size
                  : 0;
                const isImportedMesh = design.structure?.kind === 'importedMesh';
                const heightMismatch = dh !== binHeight;

                return (
                  <li key={design.id}>
                    <Button
                      variant="ghost"
                      onClick={() => handleSelect(design)}
                      className="w-full flex items-center justify-start gap-3 rounded-lg border border-stroke-subtle px-3 py-2 hover:bg-surface-hover hover:border-stroke text-left font-normal"
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
                          {isImportedMesh && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-surface-elevated text-content-secondary">
                              {t('binDesigner.itemKind.importedMesh')}
                            </span>
                          )}
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
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer - compact */}
        <div className="flex justify-end gap-2 border-t border-stroke-subtle px-4 py-3 flex-shrink-0">
          <Button variant="secondary" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
