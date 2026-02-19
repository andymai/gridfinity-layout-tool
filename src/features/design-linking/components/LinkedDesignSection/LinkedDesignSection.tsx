/**
 * Linked Design Section - Shows linked design info in the bin inspector.
 *
 * Displays:
 * - Linked: Thumbnail with link indicator, name, labeled action buttons
 * - Unlinked: Create Design + Link Existing buttons
 * - Stale (design deleted): Warning + Unlink button
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLinkedDesign, useBinLinking, useQuickExport } from '../../hooks';
import { useLinkingStore } from '../../store';
import { ConfirmDialog } from '@/shared/components';
import { useDesignThumbnail } from '@/features/bin-designer/hooks/useDesignThumbnail';
import { useTranslation } from '@/i18n';
import type { Bin } from '@/core/types';

interface LinkedDesignSectionProps {
  bin: Bin;
  variant: 'desktop' | 'mobile';
}

export function LinkedDesignSection({ bin, variant }: LinkedDesignSectionProps) {
  const t = useTranslation();
  const { linkedDesign, isStale, hasLink } = useLinkedDesign(bin.linkedDesignId);
  const { thumbnail } = useDesignThumbnail(linkedDesign?.id);
  const { editLinkedDesign, showCreateDesignDialog, unlinkBin, deleteLinkedDesign } =
    useBinLinking();
  const { isExporting, exportToSTL } = useQuickExport();
  const showLinkDesignDialog = useLinkingStore((s) => s.showLinkDesignDialog);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isMobile = variant === 'mobile';
  const buttonHeight = isMobile ? 'h-11' : 'h-8';
  const textSize = isMobile ? 'text-sm' : 'text-xs';

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const handleUnlink = useCallback(() => {
    setMenuOpen(false);
    setConfirmUnlink(true);
  }, []);

  const handleDelete = useCallback(() => {
    setMenuOpen(false);
    setConfirmDelete(true);
  }, []);

  const confirmUnlinkAction = useCallback(() => {
    unlinkBin(bin.id);
    setConfirmUnlink(false);
  }, [unlinkBin, bin.id]);

  const confirmDeleteAction = useCallback(async () => {
    if (!linkedDesign) return;

    await deleteLinkedDesign(bin.id, linkedDesign.id, linkedDesign.name);
    setConfirmDelete(false);
  }, [linkedDesign, deleteLinkedDesign, bin.id]);

  const handleThumbnailClick = useCallback(() => {
    if (linkedDesign) {
      editLinkedDesign(linkedDesign.id);
    }
  }, [linkedDesign, editLinkedDesign]);

  const handleExport = useCallback(() => {
    if (linkedDesign) {
      void exportToSTL(linkedDesign.id, linkedDesign.name);
    }
  }, [linkedDesign, exportToSTL]);

  // No link - show Create Design and Link Existing buttons
  if (!hasLink) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className={`${textSize} text-content-tertiary`}>
            {t('designLinking.inspector.linkedDesign')}
          </label>
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-warning-muted text-warning">
            {t('designLinking.experimental')}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => showCreateDesignDialog(bin.id)}
            className={`btn btn-secondary flex-1 ${buttonHeight} flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            {t('designLinking.inspector.createDesign')}
          </button>
          <button
            onClick={() => showLinkDesignDialog(bin.id, bin.width, bin.depth, bin.height)}
            className={`btn btn-secondary flex-1 ${buttonHeight} flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary`}
            title={t('designLinking.inspector.linkExistingTooltip')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            {t('designLinking.inspector.linkExisting')}
          </button>
        </div>
      </div>
    );
  }

  // Stale link (design was deleted)
  if (isStale) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className={`${textSize} text-content-tertiary`}>
            {t('designLinking.inspector.linkedDesign')}
          </label>
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-warning-muted text-warning">
            {t('designLinking.experimental')}
          </span>
        </div>
        <div className="p-3 rounded-lg bg-status-warning/10 border border-status-warning/30">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-4 h-4 text-status-warning flex-shrink-0"
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
            <span className="text-sm text-status-warning font-medium">
              {t('designLinking.inspector.designDeleted')}
            </span>
          </div>
          <button
            onClick={() => unlinkBin(bin.id)}
            className={`btn btn-secondary w-full ${buttonHeight} text-sm`}
          >
            {t('designLinking.inspector.unlink')}
          </button>
        </div>
      </div>
    );
  }

  // Linked to existing design
  if (!linkedDesign) return null;

  const thumbSize = isMobile ? 'w-14 h-14' : 'w-12 h-12';
  const iconSize = isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const actionButtonClass = isMobile ? 'h-9 px-2.5 text-xs' : 'h-7 px-2 text-xs';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className={`${textSize} text-content-tertiary`}>
          {t('designLinking.inspector.linkedDesign')}
        </label>
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-warning-muted text-warning">
          {t('designLinking.experimental')}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Thumbnail with link indicator */}
        <button
          onClick={handleThumbnailClick}
          className={`${thumbSize} flex-shrink-0 rounded-md overflow-hidden relative hover:ring-2 hover:ring-accent/50 transition-all focus:outline-none focus:ring-2 focus:ring-accent`}
          title={t('designLinking.inspector.clickToEdit')}
        >
          {thumbnail ? (
            <img src={thumbnail} alt={linkedDesign.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-elevated border border-dashed border-stroke-subtle">
              <svg
                className="w-5 h-5 text-content-disabled"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
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
          {/* Link indicator badge */}
          <div className="absolute bottom-0.5 right-0.5 p-0.5 rounded-sm bg-surface/90 shadow-sm">
            <svg
              className="w-3 h-3 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </div>
        </button>

        {/* Name and dimensions */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-content truncate">{linkedDesign.name}</div>
          <div className="text-xs text-content-tertiary">
            {linkedDesign.width}×{linkedDesign.depth}×{linkedDesign.height}u
          </div>
        </div>
      </div>

      {/* Action buttons - icon + label */}
      <div className="flex items-center gap-2">
        {/* Edit button with label */}
        <button
          onClick={() => editLinkedDesign(linkedDesign.id)}
          className={`btn btn-secondary flex-1 ${actionButtonClass} flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary`}
        >
          <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
          {t('designLinking.inspector.editDesign')}
        </button>

        {/* Export button with label */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className={`btn btn-secondary flex-1 ${actionButtonClass} flex items-center justify-center gap-1.5 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary`}
        >
          {isExporting ? (
            <svg className={`${iconSize} animate-spin`} fill="none" viewBox="0 0 24 24">
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
          ) : (
            <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          )}
          {t('common.export')}
        </button>

        {/* Overflow menu button */}
        <div className="relative">
          <button
            ref={menuButtonRef}
            onClick={() => setMenuOpen(!menuOpen)}
            className={`btn btn-secondary ${isMobile ? 'h-9 w-9' : 'h-7 w-7'} p-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface-secondary`}
            title={t('common.moreOptions')}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 mt-1 w-40 py-1 bg-surface-secondary border border-stroke rounded-lg shadow-lg z-10"
              role="menu"
            >
              <button
                onClick={handleUnlink}
                className="w-full px-3 py-2 text-left text-sm text-content hover:bg-surface-hover flex items-center gap-2 transition-colors"
                role="menuitem"
              >
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
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6"
                  />
                </svg>
                {t('designLinking.inspector.unlink')}
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-3 py-2 text-left text-sm text-status-error hover:bg-surface-hover flex items-center gap-2 transition-colors"
                role="menuitem"
              >
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                {t('designLinking.inspector.deleteDesign')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation dialogs */}
      <ConfirmDialog
        isOpen={confirmUnlink}
        title={t('designLinking.confirm.unlinkTitle')}
        message={t('designLinking.confirm.unlinkMessage')}
        confirmText={t('designLinking.inspector.unlink')}
        cancelText={t('common.cancel')}
        onConfirm={confirmUnlinkAction}
        onCancel={() => setConfirmUnlink(false)}
      />

      <ConfirmDialog
        isOpen={confirmDelete}
        title={t('designLinking.confirm.deleteTitle')}
        message={t('designLinking.confirm.deleteMessage', { name: linkedDesign.name })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        destructive
        onConfirm={() => void confirmDeleteAction()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
