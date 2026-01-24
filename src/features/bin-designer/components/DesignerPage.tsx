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
import { MobileParameterTabs } from '@/features/bin-designer/components/MobileParameterTabs';
import { PreviewCanvas } from '@/features/bin-designer/components/PreviewCanvas';
import { ExportDialog } from '@/features/bin-designer/components/ExportDialog';
import { DesignListDialog } from '@/features/bin-designer/components/DesignListDialog';
import { ToolSwitcher } from '@/shared/components/ToolSwitcher';
import { useGeneration } from '@/features/bin-designer/hooks/useGeneration';
import { useAutoSave } from '@/features/bin-designer/hooks/useAutoSave';
import { useDesignerUrlSync } from '@/features/bin-designer/hooks/useDesignerUrlSync';
import { fetchDesignerShare } from '@/features/bin-designer/hooks/useDesignerSharing';
import { migrateParams } from '@/features/bin-designer/constants/defaults';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useToastStore } from '@/core/store/toast';
import { useShallow } from 'zustand/react/shallow';
import { isOk } from '@/core/result';
import type { SaveStatus } from '@/features/bin-designer/types';

interface DesignerPageProps {
  /** Unused - navigation is handled by ToolSwitcher */
  onNavigateBack?: () => void;
}

/**
 * Render a compact status label that reflects the current save state.
 *
 * @param status - The current save state; one of `'idle'`, `'saving'`, `'saved'`, or `'error'`.
 * @returns A small text <span> showing `"Saving…"`, `"Saved"`, or `"Save failed"` depending on `status`, or `null` when `status` is `'idle'`.
 */
function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 text-[11px] mr-2 ${
        status === 'saving'
          ? 'text-content-tertiary'
          : status === 'saved'
            ? 'text-content-secondary animate-fade-in'
            : 'text-red-400'
      }`}
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
      <span>
        {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : 'Save failed'}
      </span>
    </div>
  );
}

/**
 * Designer page for creating, previewing, sharing, and exporting bin designs.
 *
 * Renders a responsive layout (desktop: side panel + preview; tablet/mobile: stacked preview + tabbed controls)
 * and the header actions and dialogs required to edit parameters, auto-generate meshes, autosave, share/load designs,
 * add designs to an export cart, and open the export flow.
 *
 * @param onNavigateBack - Callback invoked when the user requests navigation back to the layout planner.
 * @returns The rendered Designer page element.
 */
export function DesignerPage(_props: DesignerPageProps) {
  // Initialize generation bridge - auto-generates mesh when params change
  useGeneration();

  // Auto-save params to IndexedDB (debounced 1s)
  useAutoSave();

  // Sync URL ↔ store (deep linking, back/forward navigation)
  useDesignerUrlSync();

  const { isDesktop, isMobile } = useResponsive();
  const saveStatus = useDesignerStore((s) => s.saveStatus);
  const designName = useDesignerStore((s) => s.designName);
  const setDesignName = useDesignerStore((s) => s.setDesignName);
  const designListOpen = useDesignerStore((s) => s.ui.designListOpen);
  const setDesignListOpen = useDesignerStore((s) => s.setDesignListOpen);
  const setParams = useDesignerStore((s) => s.setParams);
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
  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);
  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);
  // Platform detection for keyboard shortcut hints
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
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
    setDesignName(editNameValue.trim() || 'Untitled Bin');
    setIsEditingName(false);
  }, [editNameValue, setDesignName]);

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

  const addToast = useToastStore((s) => s.addToast);

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

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 bg-surface-secondary border-b border-stroke-subtle overflow-hidden">
        <div className="flex items-center gap-4 min-w-0">
          <ToolSwitcher compact={!isDesktop} />

          {/* Divider */}
          <div className="w-px h-6 bg-stroke-subtle" />

          {/* Experimental badge */}
          <span className="hidden items-center gap-1 rounded-sm bg-warning-muted px-1.5 py-0.5 text-xs font-medium text-warning sm:inline-flex">
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
            Experimental
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
              aria-label="Design name"
              className="px-3 py-1.5 rounded-md text-sm transition-all bg-surface-elevated border border-accent text-content"
              style={{
                boxShadow: '0 0 0 3px var(--color-primary-muted)',
              }}
            />
          ) : (
            <button
              onClick={handleNameClick}
              className="hidden px-3 py-1.5 text-sm rounded-md transition-all hover:scale-[1.02] text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content truncate max-w-[200px] sm:inline-block"
              title="Click to rename design"
            >
              {designName}
            </button>
          )}

          {/* Designs switcher button */}
          <button
            onClick={() => setDesignListOpen(true)}
            className="hidden px-2 py-1.5 text-sm rounded-md transition-all text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content sm:flex items-center gap-1.5"
            title="Open design list"
            aria-label="Open design list"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <span className="hidden lg:inline">Designs</span>
          </button>

          {/* Designs button (icon only, for mobile) */}
          <button
            onClick={() => setDesignListOpen(true)}
            className="sm:hidden btn btn-ghost btn-icon"
            title="My Designs"
            aria-label="Open design list"
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
            onClick={() => setExportDialogOpen(true)}
            disabled={!canExport}
            className="hidden px-2 py-1.5 text-sm rounded-md transition-all text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content sm:flex items-center gap-1.5"
            title="Export bin as STL"
            aria-label="Export bin as STL"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span className="hidden lg:inline">Export</span>
          </button>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Save status indicator */}
          <SaveStatusIndicator status={saveStatus} />

          {/* Undo/Redo buttons */}
          <div className="flex items-center">
            <button
              onClick={handleUndo}
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
              onClick={handleRedo}
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

          {/* Divider */}
          <div className="w-px h-6 bg-stroke-subtle mx-1" />

          {/* Export button (primary, desktop) */}
          <button
            onClick={() => setExportDialogOpen(true)}
            disabled={!canExport}
            className="hidden items-center gap-1.5 btn btn-primary px-3 py-1.5 text-sm font-medium sm:flex"
            aria-label="Export bin as STL"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export
          </button>

          {/* Mobile export icon button */}
          <button
            onClick={() => setExportDialogOpen(true)}
            disabled={!canExport}
            className="sm:hidden btn btn-ghost btn-icon"
            title="Export bin"
            aria-label="Export bin as STL"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
        </div>
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
          Loading shared design…
        </div>
      )}

      {/* Main content - responsive layout */}
      {isDesktop ? (
        /* Desktop: side-by-side */
        <main className="flex flex-1 overflow-hidden">
          <div className="w-72 flex-shrink-0 overflow-hidden border-r border-stroke-subtle bg-surface-secondary">
            <ParameterPanel />
          </div>
          <div className="relative flex-1 overflow-hidden">
            <PreviewCanvas />
          </div>
        </main>
      ) : (
        /* Tablet/Mobile: stacked */
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* 3D preview area - taller on tablet, shorter on mobile */}
          <div
            className="relative flex-shrink-0 border-b border-stroke-subtle"
            style={{ height: isMobile ? '40vh' : '50vh' }}
          >
            <PreviewCanvas />
          </div>

          {/* Tabbed parameter panel */}
          <div className="flex-1 overflow-hidden bg-surface-secondary">
            <MobileParameterTabs />
          </div>
        </main>
      )}

      {/* Modals */}
      <ExportDialog />
      <DesignListDialog open={designListOpen} onClose={() => setDesignListOpen(false)} />
    </div>
  );
}
