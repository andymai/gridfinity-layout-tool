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

import { useState, useEffect, useRef, useCallback } from 'react';
import { ParameterPanel } from '@/features/bin-designer/components/ParameterPanel';
import { MobileParameterTabs } from '@/features/bin-designer/components/MobileParameterTabs';
import { PreviewCanvas } from '@/features/bin-designer/components/PreviewCanvas';
import { ExportDialog } from '@/features/bin-designer/components/ExportDialog';
import { DesignListDialog } from '@/features/bin-designer/components/DesignListDialog';
import { ShareDialog } from '@/features/bin-designer/components/ShareDialog';
import { CartDialog } from '@/features/bin-designer/components/CartDialog';
import { ToolSwitcher } from '@/shared/components/ToolSwitcher';
import { useCartStore } from '@/features/bin-designer/store/cart';
import { navigateToPlaceInLayout } from '@/features/bin-designer/hooks/usePlaceBinInLayout';
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
  const params = useDesignerStore((s) => s.params);
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const canExport = useDesignerStore(
    (s) =>
      s.generation.mesh !== null &&
      s.generation.mesh.error === null &&
      s.generation.mesh.vertices !== null &&
      s.generation.mesh.normals !== null
  );
  const setExportDialogOpen = useDesignerStore((s) => s.setExportDialogOpen);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [cartDialogOpen, setCartDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const cartItemCount = useCartStore((s) => s.items.length);
  const addToCart = useCartStore((s) => s.addToCart);
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

  const handleAddToCart = useCallback(() => {
    addToCart({
      id: currentDesignId ?? `unsaved-${Date.now()}`,
      name: designName,
      params,
      thumbnail: null,
    });
    addToast({ message: `"${designName}" added to cart`, type: 'success', duration: 2500 });
    setMobileMenuOpen(false);
  }, [addToCart, addToast, currentDesignId, designName, params]);

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
    <div className="flex h-screen flex-col bg-surface animate-fade-in">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-stroke-subtle bg-surface-secondary px-3 py-2 lg:px-4 lg:py-3">
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
          {/* Share button */}
          <button
            onClick={() => setShareDialogOpen(true)}
            className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content sm:flex"
            aria-label="Share design"
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
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Share
          </button>
          {/* Use in Layout button */}
          <button
            onClick={() =>
              navigateToPlaceInLayout(params.width, params.depth, params.height, designName)
            }
            className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content sm:flex"
            aria-label="Use this bin in Layout Planner"
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
          </button>
          {/* Add to Cart button */}
          <button
            onClick={handleAddToCart}
            className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content sm:flex"
            aria-label="Add to export cart"
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
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Cart
          </button>
          {/* View Cart button (shows badge when items present) */}
          {cartItemCount > 0 && (
            <button
              onClick={() => setCartDialogOpen(true)}
              className="relative hidden items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content sm:flex"
              aria-label={`Export cart: ${cartItemCount} items`}
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
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                {cartItemCount > 9 ? '9+' : cartItemCount}
              </span>
            </button>
          )}
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
                  onClick={() => {
                    setShareDialogOpen(true);
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
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  Share
                </button>
                <button
                  onClick={() => {
                    navigateToPlaceInLayout(params.width, params.depth, params.height, designName);
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
                      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                    />
                  </svg>
                  Use in Layout
                </button>
                <div className="my-1 border-t border-stroke-subtle" />
                <button
                  onClick={handleAddToCart}
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
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Add to Cart
                </button>
                {cartItemCount > 0 && (
                  <button
                    onClick={() => {
                      setCartDialogOpen(true);
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
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                    View Cart ({cartItemCount})
                  </button>
                )}
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
          <div className="w-80 flex-shrink-0 overflow-hidden border-r border-stroke-subtle bg-surface-secondary">
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
      <ShareDialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} />
      <CartDialog open={cartDialogOpen} onClose={() => setCartDialogOpen(false)} />
    </div>
  );
}
