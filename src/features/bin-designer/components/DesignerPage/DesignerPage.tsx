/**
 * Bin Designer page layout.
 *
 * Three responsive layouts:
 * - Desktop (≥900px): Side panel (288px) + full 3D preview
 * - Tablet (768-899px): Stacked - 3D preview (50vh) + tabbed controls below
 * - Mobile (<768px): Stacked - 3D preview (40vh) + tabbed controls
 *
 * The useGeneration hook auto-generates mesh when parameters change.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ParameterPanel } from '@/features/bin-designer/components/ParameterPanel';
import { PreviewCanvas } from '@/features/bin-designer/components/PreviewCanvas';
import { CutoutWorkspace } from '@/features/bin-designer/components/CutoutWorkspace';
import { ResizeDivider } from '@/features/bin-designer/components/CutoutWorkspace/ResizeDivider';
import { loadSplitRatio } from '@/features/bin-designer/components/CutoutWorkspace/splitRatioStorage';
import { ExportDialog } from '@/features/bin-designer/components/ExportDialog';
import { DesignListDialog } from '@/features/bin-designer/components/DesignListDialog';
import { ToolSwitcher } from '@/shared/components/ToolSwitcher';
import { useGeneration } from '@/features/bin-designer/hooks/useGeneration';
import { useDesignerInit } from '@/features/bin-designer/hooks/useDesignerInit';
import { useCreateFromBin } from '@/features/bin-designer/hooks/useCreateFromBin';
import { useAutoSave } from '@/features/bin-designer/hooks/useAutoSave';
import { useThumbnailCapture } from '@/features/bin-designer/hooks/useThumbnailCapture';
import { useDesignerUrlSync } from '@/features/bin-designer/hooks/useDesignerUrlSync';
import { useUnsavedWarning } from '@/features/bin-designer/hooks/useUnsavedWarning';
import { fetchDesignerShare } from '@/features/bin-designer/hooks/useDesignerSharing';
import { migrateParams } from '@/features/bin-designer/constants/defaults';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useToastStore } from '@/core/store/toast';
import { useShallow } from 'zustand/react/shallow';
import { isOk } from '@/core/result';
import {
  saveDesign,
  setActiveDesignId,
  updateDesignName,
} from '@/features/bin-designer/storage/DesignerStorage';
import { captureThumbnail } from '@/features/bin-designer/utils/thumbnail';
import { upsertRegistryEntry } from '@/features/bin-designer/store/customBinRegistry';
import { useLayoutStore } from '@/core/store/layout';
import type { SaveStatus } from '@/features/bin-designer/types';
import { binId } from '@/core/types';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';

/** CSS class for each save status */
const SAVE_STATUS_CLASSES: Record<Exclude<SaveStatus, 'idle'>, string> = {
  saving: 'text-content-tertiary',
  saved: 'text-content-secondary animate-fade-in',
  error: 'text-red-400',
};

/**
 * Info banner shown on non-desktop viewports when the cutout editor is open.
 * Explains that the cutout editor is only available on desktop.
 */
function CutoutDesktopOnlyBanner() {
  const t = useTranslation();
  return (
    <div className="flex items-center gap-2 bg-info/10 px-4 py-2 text-xs text-info border-b border-info/20">
      <svg
        className="h-4 w-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{t('binDesigner.cutoutDesktopOnly')}</span>
    </div>
  );
}

/**
 * Render a compact status label that reflects the current save state.
 * Returns null when status is 'idle'.
 */
function SaveStatusIndicator({ status, compact }: { status: SaveStatus; compact?: boolean }) {
  const t = useTranslation();
  if (status === 'idle') return null;

  const statusTextKey = {
    saving: 'binDesigner.saving',
    saved: 'binDesigner.saved',
    error: 'binDesigner.saveFailed',
  } as const;

  return (
    <div
      className={`flex items-center gap-1.5 ${compact ? 'px-0.5 py-0.5' : 'px-2 py-1 mr-2'} text-[11px] ${SAVE_STATUS_CLASSES[status]}`}
      aria-live="polite"
      role="status"
    >
      {status === 'saving' && (
        <svg
          className="w-3 h-3 animate-spin motion-reduce:animate-none"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-70"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {status === 'saved' && (
        <svg
          className="w-3 h-3 text-success"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === 'error' && (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      )}
      {!compact && <span>{t(statusTextKey[status])}</span>}
    </div>
  );
}

/**
 * Designer page for creating, previewing, sharing, and exporting bin designs.
 *
 * Renders a responsive layout (desktop: side panel + preview; tablet/mobile: stacked preview + tabbed controls)
 * and the header actions and dialogs required to edit parameters, auto-generate meshes, autosave, share/load designs,
 * and open the export flow.
 */
export function DesignerPage() {
  // Initialize designer - ensures we always have an active design
  // Must be called before useAutoSave to set currentDesignId
  useDesignerInit();

  // Handle createFrom=bin URL params (must run after init, before generation)
  useCreateFromBin();

  // Initialize generation bridge - auto-generates mesh when params change
  useGeneration();

  // Auto-save params to IndexedDB (debounced 1s)
  useAutoSave();

  // Capture thumbnail after first mesh generation (for designs created from bins)
  useThumbnailCapture();

  // Sync URL ↔ store (deep linking, back/forward navigation)
  useDesignerUrlSync();

  // Warn before closing tab with unsaved changes
  useUnsavedWarning();

  const { isDesktop, isMobile, isLandscape } = useResponsive();
  const cutoutEditorOpen = useDesignerStore((s) => s.ui.cutoutEditorOpen);
  const [splitRatio, setSplitRatio] = useState(loadSplitRatio);
  const t = useTranslation();
  const saveStatus = useDesignerStore((s) => s.saveStatus);
  const designName = useDesignerStore((s) => s.designName);
  const setDesignName = useDesignerStore((s) => s.setDesignName);
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const setCurrentDesignId = useDesignerStore((s) => s.setCurrentDesignId);
  const setSaveStatus = useDesignerStore((s) => s.setSaveStatus);
  const params = useDesignerStore((s) => s.params);
  const exportFileNameConfig = useDesignerStore((s) => s.exportFileNameConfig);
  const designListOpen = useDesignerStore((s) => s.ui.designListOpen);
  const setDesignListOpen = useDesignerStore((s) => s.setDesignListOpen);
  const setParams = useDesignerStore((s) => s.setParams);
  const pendingBinLink = useDesignerStore((s) => s.pendingBinLink);
  const clearPendingBinLink = useDesignerStore((s) => s.clearPendingBinLink);
  const updateBin = useLayoutStore((s) => s.updateBin);
  const canExport = useDesignerStore(
    (s) =>
      s.generation.mesh !== null &&
      s.generation.mesh.error === null &&
      s.generation.mesh.vertices !== null &&
      s.generation.mesh.normals !== null
  );
  const setExportDialogOpen = useDesignerStore((s) => s.setExportDialogOpen);
  const { canUndo, canRedo } = useDesignerStore(
    useShallow((s) => ({
      canUndo: s.history.past.length > 0,
      canRedo: s.history.future.length > 0,
    }))
  );
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const addToast = useToastStore((s) => s.addToast);
  // Platform detection for keyboard shortcut hints
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
  const modKey = isMac ? '\u2318' : 'Ctrl';

  // Inline name editing (like planner mode)
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(designName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameClick = useCallback(() => {
    setEditNameValue(designName);
    setIsEditingName(true);
  }, [designName]);

  const handleNameSubmit = useCallback(() => {
    const name = editNameValue.trim() || 'Untitled Bin';
    setDesignName(name);
    setIsEditingName(false);

    // Persist rename for existing designs
    if (currentDesignId) {
      void updateDesignName(currentDesignId, name).then((result) => {
        if (isOk(result)) {
          upsertRegistryEntry({
            id: result.value.id,
            name: result.value.name,
            width: params.width,
            depth: params.depth,
            height: params.height,
            updatedAt: result.value.updatedAt,
          });
        }
      });
      return;
    }

    // First save: when user names an unsaved design, persist it
    if (!currentDesignId) {
      setSaveStatus('saving');
      const thumbnail = captureThumbnail();
      void saveDesign({ name, params, thumbnail, exportFileNameConfig }).then((result) => {
        if (isOk(result)) {
          setCurrentDesignId(result.value.id);
          setActiveDesignId(result.value.id);
          setSaveStatus('saved');
          upsertRegistryEntry({
            id: result.value.id,
            name: result.value.name,
            width: params.width,
            depth: params.depth,
            height: params.height,
            updatedAt: result.value.updatedAt,
          });

          // Auto-link design to source bin if this was created from a bin
          if (pendingBinLink) {
            const linkResult = updateBin(binId(pendingBinLink), {
              linkedDesignId: result.value.id,
            });
            clearPendingBinLink();
            if (isOk(linkResult)) {
              addToast({
                message: t('binDesigner.designCreatedAndLinked'),
                type: 'success',
                duration: 4000,
              });
            }
          }
        } else {
          setSaveStatus('error');
        }
      });
    }
  }, [
    editNameValue,
    setDesignName,
    currentDesignId,
    params,
    exportFileNameConfig,
    setCurrentDesignId,
    setSaveStatus,
    pendingBinLink,
    updateBin,
    clearPendingBinLink,
    addToast,
    t,
  ]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleNameSubmit();
      } else if (e.key === 'Escape') {
        setEditNameValue(designName);
        setIsEditingName(false);
      }
    },
    [handleNameSubmit, designName]
  );

  // Handle ?share= URL parameter on mount
  const shareHandled = useRef(false);
  const [shareLoading, setShareLoading] = useState(() =>
    new URLSearchParams(window.location.search).has('share')
  );
  useEffect(() => {
    if (shareHandled.current) return;
    shareHandled.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    if (!shareId) return;

    // Clean URL immediately (remove ?share= param)
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.replaceState({}, '', url.pathname + url.search);

    // Load shared design
    void fetchDesignerShare(shareId).then((result) => {
      if (isOk(result)) {
        setParams(migrateParams(result.value));
        addToast({ message: 'Shared design loaded', type: 'success', duration: 3000 });
      } else {
        addToast({ message: 'Failed to load shared design', type: 'error', duration: 5000 });
      }
      setShareLoading(false);
    });
  }, [setParams, addToast]);

  // Long-press handler for mobile name editing
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleNameTouchStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      setEditNameValue(designName);
      setIsEditingName(true);
    }, 500);
  }, [designName]);
  const handleNameTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Mobile title bar */}
      {!isDesktop && (
        <div className="h-7 flex items-center justify-between px-3 bg-surface border-b border-stroke-subtle">
          <span className="text-xs font-medium text-content-secondary">
            {t('toolSwitcher.gridfinityLayoutTool')}
          </span>
          <div className="flex items-center gap-3">
            <a
              href="https://ko-fi.com/andyaragon"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                {ICON_PATHS.heart.map((d) => (
                  <path key={d} d={d} />
                ))}
              </svg>
              {t('mobile.header.tip')}
            </a>
            <a
              href="https://github.com/andymai/gridfinity-layout-tool"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-content-tertiary hover:underline"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              {t('mobile.header.github')}
            </a>
          </div>
        </div>
      )}

      {/* Header / Action bar */}
      <header className="h-12 flex items-center justify-between px-4 bg-surface-secondary border-b border-stroke-subtle overflow-hidden">
        {isDesktop ? (
          /* ---- Desktop action bar ---- */
          <>
            <div className="flex items-center gap-4 min-w-0">
              <ToolSwitcher />

              {/* Divider */}
              <div className="w-px h-6 bg-stroke-subtle" />

              {/* Experimental badge */}
              <span className="inline-flex items-center gap-1 rounded-sm bg-warning-muted px-1.5 py-0.5 text-xs font-medium text-warning">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
                {t('binDesigner.experimental')}
              </span>

              {/* Design name (click to rename inline) */}
              {isEditingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onBlur={handleNameSubmit}
                  onKeyDown={handleNameKeyDown}
                  maxLength={50}
                  aria-label={t('binDesigner.designName')}
                  className="px-3 py-1.5 rounded-md text-sm transition-all bg-surface-elevated border border-accent text-content max-w-[200px]"
                  style={{
                    boxShadow: '0 0 0 3px var(--color-primary-muted)',
                  }}
                />
              ) : (
                <button
                  onClick={handleNameClick}
                  className="inline-block px-3 py-1.5 text-sm rounded-md transition-all hover:scale-[1.02] text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content truncate max-w-[200px]"
                  title={t('binDesigner.clickToRename')}
                >
                  {designName}
                </button>
              )}

              {/* Designs switcher button */}
              <button
                onClick={() => setDesignListOpen(true)}
                className="px-2 py-1.5 text-sm rounded-md transition-all text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content flex items-center gap-1.5"
                title={t('binDesigner.openDesignList')}
                aria-label={t('binDesigner.openDesignList')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <span className="hidden lg:inline">{t('binDesigner.designs')}</span>
              </button>

              {/* Export button */}
              <button
                onClick={() => setExportDialogOpen(true)}
                disabled={!canExport}
                className="px-2 py-1.5 text-sm rounded-md transition-all text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content flex items-center gap-1.5"
                title={t('binDesigner.exportSTL')}
                aria-label={t('binDesigner.exportBinAsStl')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span className="hidden lg:inline">{t('common.export')}</span>
              </button>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <SaveStatusIndicator status={saveStatus} />

              <div className="flex items-center">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="btn btn-ghost btn-icon"
                  title={`Undo (${modKey}+Z)`}
                  aria-label={`Undo (${modKey}+Z)`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="btn btn-ghost btn-icon"
                  title={`Redo (${modKey}+Y)`}
                  aria-label={`Redo (${modKey}+Y)`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ---- Mobile/Tablet action bar ---- */
          <>
            <ToolSwitcher compact iconOnly />

            {/* Design name - center, tap opens design list, long-press/context-menu renames */}
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={handleNameKeyDown}
                maxLength={50}
                aria-label={t('binDesigner.designName')}
                className="flex-1 mx-3 min-w-0 px-2 py-1 rounded-md text-sm bg-surface-elevated border border-accent text-content"
                style={{
                  boxShadow: '0 0 0 3px var(--color-primary-muted)',
                }}
              />
            ) : (
              <button
                onClick={() => setDesignListOpen(true)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setEditNameValue(designName);
                  setIsEditingName(true);
                }}
                onTouchStart={handleNameTouchStart}
                onTouchMove={handleNameTouchEnd}
                onTouchEnd={handleNameTouchEnd}
                onTouchCancel={handleNameTouchEnd}
                className="flex-1 mx-3 min-w-0 flex items-center justify-center gap-1 px-2 py-1 text-sm rounded-md text-content-secondary bg-transparent hover:bg-surface-hover"
                title={t('binDesigner.clickToRename')}
              >
                <span className="truncate">{designName}</span>
                <svg
                  className="w-3 h-3 flex-shrink-0 text-content-tertiary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}

            <div className="flex items-center gap-0.5 flex-shrink-0">
              <SaveStatusIndicator status={saveStatus} compact />

              {/* Designs button */}
              <button
                onClick={() => setDesignListOpen(true)}
                className="btn btn-ghost btn-icon"
                title={t('binDesigner.savedDesigns')}
                aria-label={t('binDesigner.openDesignList')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </button>

              {/* Export button */}
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setExportDialogOpen(true)}
                disabled={!canExport}
                aria-label={t('binDesigner.exportBinAsStl')}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                  />
                </svg>
              </button>

              {/* Undo/Redo */}
              <button
                onClick={undo}
                disabled={!canUndo}
                className="btn btn-ghost btn-icon"
                aria-label={`Undo (${modKey}+Z)`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="btn btn-ghost btn-icon"
                aria-label={`Redo (${modKey}+Y)`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
                  />
                </svg>
              </button>
            </div>
          </>
        )}
      </header>

      {/* Share loading banner */}
      {shareLoading && (
        <div className="flex items-center justify-center gap-2 bg-accent-muted px-3 py-1.5 text-xs font-medium text-accent">
          <svg
            className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {t('binDesigner.loadingSharedDesign')}
        </div>
      )}

      {/* Main content - responsive layout */}
      {isDesktop && cutoutEditorOpen ? (
        /* Desktop: cutout workspace + resizable divider + 3D preview */
        <main className="flex flex-1 overflow-hidden">
          <div className="overflow-hidden" style={{ width: `${splitRatio * 100}%` }}>
            <CutoutWorkspace />
          </div>
          <ResizeDivider ratio={splitRatio} onRatioChange={setSplitRatio} />
          <div className="relative flex-1 overflow-hidden">
            <PreviewCanvas />
          </div>
        </main>
      ) : isDesktop ? (
        /* Desktop: side-by-side */
        <main className="flex flex-1 overflow-hidden">
          <div className="w-72 flex-shrink-0 overflow-hidden border-r border-stroke-subtle bg-surface-secondary">
            <ParameterPanel />
          </div>
          <div className="relative flex-1 overflow-hidden">
            <PreviewCanvas />
          </div>
        </main>
      ) : !isDesktop && isLandscape ? (
        /* Landscape tablet/mobile: side-by-side */
        <main className="flex flex-1 flex-col overflow-hidden">
          {cutoutEditorOpen && <CutoutDesktopOnlyBanner />}
          <div className="flex flex-1 overflow-hidden">
            <div className="relative flex-1">
              <PreviewCanvas />
            </div>
            <div className="w-64 flex-shrink-0 overflow-hidden border-l border-stroke-subtle bg-surface-secondary">
              <ParameterPanel />
            </div>
          </div>
        </main>
      ) : (
        /* Tablet/Mobile: stacked */
        <main className="flex flex-1 flex-col overflow-hidden">
          {cutoutEditorOpen && <CutoutDesktopOnlyBanner />}

          {/* 3D preview area - taller on tablet, shorter on mobile */}
          <div
            className="relative flex-shrink-0 border-b border-stroke-subtle"
            style={{ height: isMobile ? '40vh' : '50vh' }}
          >
            <PreviewCanvas />
          </div>

          {/* Parameter panel */}
          <div className="flex-1 overflow-hidden bg-surface-secondary">
            <ParameterPanel />
          </div>
        </main>
      )}

      {/* Modals */}
      <ExportDialog />
      <DesignListDialog open={designListOpen} onClose={() => setDesignListOpen(false)} />
    </div>
  );
}
