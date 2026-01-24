/**
 * Bin Designer page layout.
 *
 * Three responsive layouts:
 * - Desktop (≥900px): Side panel (320px) + full 3D preview
 * - Tablet (768-899px): Stacked - 3D preview (50vh) + tabbed controls below
 * - Mobile (<768px): Stacked - 3D preview (40vh) + tabbed controls + floating export FAB
 *
 * The useGeneration hook auto-generates mesh when parameters change.
 */

import { useState, useEffect, useRef } from 'react';
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

  const labels: Record<Exclude<SaveStatus, 'idle'>, string> = {
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Save failed',
  };

  const colors: Record<Exclude<SaveStatus, 'idle'>, string> = {
    saving: 'text-content-secondary',
    saved: 'text-green-400',
    error: 'text-red-400',
  };

  return (
    <span className={`text-xs ${colors[status]}`} aria-live="polite">
      {labels[status]}
    </span>
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const addToast = useToastStore((s) => s.addToast);

  // Close mobile menu on outside click or Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

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
      <header className="h-12 flex items-center justify-between border-b border-stroke-subtle bg-surface-secondary px-3 lg:px-4">
        <div className="flex items-center gap-2 lg:gap-3">
          <ToolSwitcher compact={!isDesktop} />
          <div className="hidden h-5 w-px bg-stroke-subtle sm:block" />
          <button
            onClick={() => setDesignListOpen(true)}
            className="hidden items-center gap-1 rounded-md px-2 py-1 text-sm text-content hover:bg-surface-hover sm:flex"
            aria-label="Open design list"
          >
            <span className="max-w-[120px] truncate font-medium lg:max-w-[160px]">
              {designName}
            </span>
            <svg
              className="h-3.5 w-3.5 text-content-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          <SaveStatusIndicator status={saveStatus} />
        </div>
        <div className="flex items-center gap-2">
          {/* Use in Layout button (coming soon) */}
          <button
            disabled
            className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-content-disabled cursor-not-allowed sm:flex"
            aria-label="Use in Layout (coming soon)"
            title="Coming soon"
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
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
            Use in Layout
            <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] text-content-tertiary">
              Soon
            </span>
          </button>
          {/* Export button (hidden on mobile, replaced by FAB) */}
          <button
            onClick={() => setExportDialogOpen(true)}
            disabled={!canExport}
            className="hidden items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-content-disabled sm:flex"
            aria-label="Export bin as STL"
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export
          </button>

          {/* Mobile overflow menu (visible only on small screens) */}
          <div className="relative sm:hidden" ref={mobileMenuRef}>
            <button
              ref={menuButtonRef}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-content-secondary hover:bg-surface-hover hover:text-content"
              aria-label="More actions"
              aria-expanded={mobileMenuOpen}
              aria-haspopup="menu"
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
                  d="M12 5v.01M12 12v.01M12 19v.01"
                />
              </svg>
            </button>
            {mobileMenuOpen && (
              <div
                className="absolute right-0 top-full z-40 mt-1 w-48 rounded-lg border border-stroke-subtle bg-surface-elevated py-1 shadow-xl"
                role="menu"
                aria-label="Actions"
              >
                <button
                  onClick={() => {
                    setDesignListOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-content hover:bg-surface-hover"
                  role="menuitem"
                >
                  <svg
                    className="h-4 w-4 text-content-secondary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                  My Designs
                </button>
                <button
                  disabled
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-content-disabled cursor-not-allowed"
                  role="menuitem"
                  aria-disabled="true"
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
                      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                    />
                  </svg>
                  Use in Layout
                  <span className="ml-auto text-[10px] text-content-tertiary">Soon</span>
                </button>
              </div>
            )}
          </div>
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

      {/* Mobile floating export button */}
      {isMobile && (
        <button
          onClick={() => setExportDialogOpen(true)}
          disabled={!canExport}
          className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700 disabled:bg-surface-elevated disabled:text-content-disabled disabled:shadow-none"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
          aria-label="Export bin as STL"
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </button>
      )}

      {/* Modals */}
      <ExportDialog />
      <DesignListDialog open={designListOpen} onClose={() => setDesignListOpen(false)} />
    </div>
  );
}
