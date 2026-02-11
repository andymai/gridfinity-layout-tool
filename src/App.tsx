import { useEffect, useLayoutEffect, useState, useCallback, Suspense } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  useLayoutStore,
  useLibraryStore,
  useSelectionStore,
  useViewStore,
  useLabsStore,
} from './core/store';
import { useSharedPreviewStore } from './core/store/sharedPreview';
import { initLayoutAnalytics } from './core/store/layoutAnalytics';
import {
  useLayoutRouting,
  useAnalytics,
  useStorageMigration,
  useTabletPanels,
  useKeyboard,
} from './hooks';
import {
  useAutoSave,
  useResponsive,
  useCrossTabSync,
  usePWAUpdate,
  usePrefetchChunks,
} from './shared/hooks';
import { useCollabMode } from './hooks/useCollabMode';
import { useOwnedShareSync } from './features/cloud-share/hooks/useOwnedShareSync';
import { initializeLayoutLibrary, loadSharedWithMe, downloadLayoutAsFile } from '@/core/storage';
import { lazyWithRetry, namedExport } from './utils/lazyWithRetry';
import { Grid } from './features/grid-editor';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Staging } from './features/staging/components/Staging';
import { RightPanel } from './components/RightPanel';
import { DropZones } from './components/DropZones';
import { DragPreview } from './components/DragPreview';
import { ToastContainer } from './shared/components/Toast';
import { LoadingFallback } from './shared/components/LoadingFallback';
import { PanelErrorBoundary } from './components/PanelErrorBoundary';
// Import directly to avoid pulling in entire Mobile barrel (67 KB MobileLayoutsPanel etc.)
import { BinContextMenuWrapper } from './components/Mobile/BinContextMenuWrapper';
import { TabletPanelOverlay, TabletPanelTriggers } from './components/Tablet';
import { LiveRegion } from './components/LiveRegion';
import { LocalMutationsProvider } from './shared/contexts';
import { useTranslation } from '@/i18n';
import { CommandPalette, useCommandPalette } from '@/features/command-palette';
import { useOnboarding } from '@/features/onboarding/hooks/useOnboarding';

// Lazy load design-linking dialogs - loaded when mutations provider wraps content
const DesignLinkingDialogs = lazyWithRetry(() =>
  import('./features/design-linking/components/DesignLinkingDialogs').then(
    namedExport('DesignLinkingDialogs')
  )
);

// Lazy load cloud-share components - only needed when viewing/sharing layouts
const SharedLayoutImporter = lazyWithRetry(() =>
  import('./features/cloud-share/components/SharedLayoutImporter').then(
    namedExport('SharedLayoutImporter')
  )
);
const SharedLayoutBanner = lazyWithRetry(() =>
  import('./features/cloud-share/components/SharedLayoutBanner').then(
    namedExport('SharedLayoutBanner')
  )
);

// Lazy load LabsDrawer - experimental feature most users won't use
const LabsDrawer = lazyWithRetry(() =>
  import('./features/labs/components/LabsDrawer').then(namedExport('LabsDrawer'))
);

// Lazy load Welcome Modal - only shown on first visit for new users
const WelcomeModal = lazyWithRetry(() =>
  import('./components/Modals/WelcomeModal').then(namedExport('WelcomeModal'))
);

// Lazy load Bin Designer page - only loaded when navigating to /designer
const DesignerPage = lazyWithRetry(() =>
  import('./features/bin-designer/components/DesignerPage').then(namedExport('DesignerPage'))
);
import { useDesignerRouting } from './hooks/useDesignerRouting';
import { usePlaceBinFromURL } from './features/bin-designer/hooks/usePlaceBinInLayout';
import { SHORTCUTS } from './core/constants';

// Lazy load modals - only loaded when opened (with retry for chunk load failures)
const HelpModal = lazyWithRetry(() =>
  import('./components/Modals/HelpModal').then(namedExport('HelpModal'))
);

// Lazy load mobile layout - only loaded on mobile devices
const MobileLayout = lazyWithRetry(() =>
  import('./layouts/MobileLayout').then(namedExport('MobileLayout'))
);

// Lazy load collaborative editing provider - only loaded when Labs feature enabled
// AND layout has edit permission (most users never need this ~80KB chunk)
const CollabProvider = lazyWithRetry(() =>
  import('./components/Collab/CollabProvider').then(namedExport('CollabProvider'))
);

// Track whether the initial layout has rendered, so we only play the fade-in
// animation on first app load (not when switching between tools).
let hasRenderedInitialLayout = false;

// Initialize layout library once at module level to avoid effect setState issues
let initialLoadError: Error | null = null;
try {
  const { library, activeLayout } = initializeLayoutLibrary();
  useLibraryStore.getState().initLibrary(library);
  useLayoutStore.getState().importLayout(activeLayout, library.activeLayoutId, 'init');

  // Initialize "Shared with me" entries from localStorage
  const sharedWithMeEntries = loadSharedWithMe();
  useLibraryStore.getState().initSharedWithMe(sharedWithMeEntries);
} catch (e) {
  initialLoadError = e as Error;
}

/**
 * Root application component that composes and renders the responsive app UI, providers, and feature-gated lazy modules.
 *
 * Renders mobile, tablet, or desktop layouts as appropriate; initializes app-level effects (routing, autosave,
 * cross-tab sync, analytics, storage migration, PWA updates, keyboard shortcuts); and wraps content with either
 * collaborative or local mutations providers. Conditionally mounts lazy features such as Designer, LabsDrawer,
 * SharedLayoutImporter, and collaboration provider.
 *
 * @returns The top-level React element for the application UI, including layout, panels, modals, and global providers.
 */
export default function App() {
  const t = useTranslation();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMobileHelpOpen, setIsMobileHelpOpen] = useState(false);

  // Bin Designer route detection
  const { isDesignerRoute, navigateToDesigner } = useDesignerRouting();

  // Command palette state (⌘K / Ctrl+K) — disabled on designer route
  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen } = useCommandPalette({
    disabled: isDesignerRoute,
  });
  const { isMobile, isTablet } = useResponsive();

  // Onboarding — first-visit welcome modal
  const { shouldShowWelcome, shouldShowDrawTutorial, markWelcomeComplete } = useOnboarding();

  const contextMenu = useViewStore((state) => state.contextMenu);
  const hideContextMenu = useViewStore((state) => state.hideContextMenu);

  // Collaborative mode detection
  const { isCollaborative, shareId } = useCollabMode();

  // Lazy loading conditions - only load chunks when actually needed
  const isLabsDrawerOpen = useLabsStore((state) => state.isDrawerOpen);
  const hasSharedLayoutPreview = useSharedPreviewStore((state) => state.sharedPreview !== null);

  // Check if URL contains share parameters (determines if SharedLayoutImporter is needed)
  // This is checked once at component mount and doesn't re-run on URL changes
  // (SharedLayoutImporter handles subsequent URL changes internally)
  const [hasShareUrl] = useState(() => {
    const hash = window.location.hash;
    const pathname = window.location.pathname;
    return hash.includes('share=') || /^\/l\/[a-zA-Z0-9]{12}$/.test(pathname);
  });

  // Handle ?placeBin= param from Designer's "Use in Layout" button
  usePlaceBinFromURL();

  // Auto-sync owned shared layouts to Blob storage (Google Docs-like behavior)
  useOwnedShareSync();

  // Initialize layout analytics subscriber (tracks feature usage from state changes)
  useEffect(() => {
    return initLayoutAnalytics();
  }, []);

  // Tablet panel state (auto-collapses on tablet mode entry)
  const {
    leftPanelOpen: tabletLeftPanelOpen,
    rightPanelOpen: tabletRightPanelOpen,
    openLeftPanel,
    closeLeftPanel,
    openRightPanel,
    closeRightPanel,
  } = useTabletPanels(isTablet);

  // Performance: Only subscribe to the specific arrays we need, not the entire layout object
  const { layers, categories } = useLayoutStore(
    useShallow((state) => ({
      layers: state.layout.layers,
      categories: state.layout.categories,
    }))
  );
  const activeLayerId = useSelectionStore((state) => state.activeLayerId);
  const activeCategoryId = useSelectionStore((state) => state.activeCategoryId);
  const setActiveLayer = useSelectionStore((state) => state.setActiveLayer);
  const setActiveCategory = useSelectionStore((state) => state.setActiveCategory);

  // Initialize activeLayerId and activeCategoryId to valid values (sync before paint)
  useLayoutEffect(() => {
    // Check if current activeLayerId is valid for the current layout
    const layerExists = layers.some((l) => l.id === activeLayerId);
    if ((!activeLayerId || !layerExists) && layers.length > 0) {
      setActiveLayer(layers[0].id);
    }
    // Ensure activeCategoryId is valid for current layout
    const categoryExists = categories.some((c) => c.id === activeCategoryId);
    if (!categoryExists && categories.length > 0) {
      setActiveCategory(categories[0].id);
    }
  }, [activeLayerId, activeCategoryId, layers, categories, setActiveLayer, setActiveCategory]);

  // Global keyboard shortcuts
  useKeyboard();

  // Auto-save to localStorage
  const saveStatus = useAutoSave();

  // Cross-tab sync detection
  useCrossTabSync();

  // URL-based layout routing (bookmarkable URLs)
  // Skip URL manipulation when on the designer route (it owns its own URL)
  useLayoutRouting({ skip: isDesignerRoute });

  // PWA update detection and auto-reload
  usePWAUpdate();

  // Analytics session tracking
  useAnalytics();

  // Storage migration (localStorage → IndexedDB)
  useStorageMigration();

  // Prefetch lazy-loaded chunks during idle time (desktop only)
  usePrefetchChunks();

  // Only fade in on initial app load, not when switching between tools
  const entranceClass = hasRenderedInitialLayout ? '' : 'animate-fade-in';
  useEffect(() => {
    hasRenderedInitialLayout = true;
  }, []);

  // Help modal keyboard shortcut
  const handleHelpKeyboard = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    if ((SHORTCUTS.HELP as readonly string[]).includes(e.key)) {
      e.preventDefault();
      setIsHelpOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleHelpKeyboard);
    return () => window.removeEventListener('keydown', handleHelpKeyboard);
  }, [handleHelpKeyboard]);

  // Custom event listeners for command palette actions
  useEffect(() => {
    const handleOpenHelp = () => setIsHelpOpen(true);
    window.addEventListener('open-help-modal', handleOpenHelp);
    return () => window.removeEventListener('open-help-modal', handleOpenHelp);
  }, []);

  // Switch to designer command palette action
  useEffect(() => {
    const handleSwitchToDesigner = () => navigateToDesigner();
    window.addEventListener('switch-to-designer', handleSwitchToDesigner);
    return () => window.removeEventListener('switch-to-designer', handleSwitchToDesigner);
  }, [navigateToDesigner]);

  // Download layout command palette action
  useEffect(() => {
    const handleDownloadLayout = () => {
      const layout = useLayoutStore.getState().layout;
      const filename = `${layout.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
      void downloadLayoutAsFile(layout, filename);
    };
    window.addEventListener('download-layout', handleDownloadLayout);
    return () => window.removeEventListener('download-layout', handleDownloadLayout);
  }, []);

  // Helper to wrap content with appropriate MutationsProvider
  // - Collaborative mode: CollabProvider provides CollabMutationsProvider (lazy loaded)
  // - Local mode: LocalMutationsProvider
  // Also renders DesignLinkingDialogs once (uses portal, so placement doesn't matter)
  const wrapWithMutations = (content: React.ReactNode) => {
    const dialogs = (
      <Suspense fallback={null}>
        <DesignLinkingDialogs />
      </Suspense>
    );
    if (isCollaborative && shareId) {
      return (
        <Suspense fallback={<LoadingFallback label={t('loading.collaboration')} />}>
          <CollabProvider shareId={shareId}>
            {content}
            {dialogs}
          </CollabProvider>
        </Suspense>
      );
    }
    return (
      <LocalMutationsProvider>
        {content}
        {dialogs}
      </LocalMutationsProvider>
    );
  };

  if (initialLoadError) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface p-8" role="alert">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-error-muted flex items-center justify-center">
            <svg
              className="w-7 h-7 text-error"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold mb-2 text-content">{t('app.unableToLoadApp')}</h1>
          <p className="text-sm text-content-secondary mb-4">
            There was a problem loading your saved data. This is usually caused by corrupted
            storage. Try clearing your browser data for this site.
          </p>
          <pre className="text-left text-xs rounded-lg p-3 mb-4 overflow-auto max-h-24 text-error bg-surface-elevated border border-stroke-subtle">
            {initialLoadError.message}
          </pre>
          <button
            onClick={() => {
              try {
                localStorage.clear();
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
            className="btn btn-primary"
          >
            {t('app.clearDataReload')}
          </button>
        </div>
      </div>
    );
  }

  // Route-specific content (shared overlays rendered once below)
  const routeContent = (() => {
    // Bin Designer route - lazy loaded
    if (isDesignerRoute) {
      return (
        <Suspense fallback={<LoadingFallback label={t('loading.designer')} />}>
          <DesignerPage />
        </Suspense>
      );
    }

    // Mobile layout - lazy loaded
    if (isMobile) {
      return wrapWithMutations(
        <div className={`h-screen ${entranceClass}`}>
          <Suspense fallback={<LoadingFallback label={t('loading.mobileLayout')} />}>
            <MobileLayout
              isMobileHelpOpen={isMobileHelpOpen}
              setIsMobileHelpOpen={setIsMobileHelpOpen}
              saveStatus={saveStatus}
            />
          </Suspense>
        </div>
      );
    }

    // Tablet layout - full width grid with overlay panels
    if (isTablet) {
      return wrapWithMutations(
        <div
          className={`h-screen flex flex-col overflow-hidden bg-surface text-content ${entranceClass}`}
        >
          {/* Shared layout banner (shown when viewing unsaved shared layout) */}
          {hasSharedLayoutPreview && (
            <Suspense fallback={null}>
              <SharedLayoutBanner />
            </Suspense>
          )}

          {/* Header */}
          <Header onHelpClick={() => setIsHelpOpen(true)} saveStatus={saveStatus} />

          {/* Main content area - Grid takes full width */}
          <div className="flex-1 flex overflow-hidden">
            <main className="flex-1 flex flex-col overflow-hidden bg-surface">
              <Grid shouldShowDrawTutorial={shouldShowDrawTutorial} />
              <Staging />
            </main>
          </div>

          {/* Left sidebar as overlay */}
          <TabletPanelOverlay isOpen={tabletLeftPanelOpen} onClose={closeLeftPanel} side="left">
            <PanelErrorBoundary panelName="Sidebar">
              <Sidebar />
            </PanelErrorBoundary>
          </TabletPanelOverlay>

          {/* Right panel as overlay */}
          <TabletPanelOverlay isOpen={tabletRightPanelOpen} onClose={closeRightPanel} side="right">
            <PanelErrorBoundary panelName="Inspector">
              <RightPanel />
            </PanelErrorBoundary>
          </TabletPanelOverlay>

          {/* Drop zones (appear when dragging) */}
          <DropZones />

          {/* Floating drag preview */}
          <DragPreview />

          {/* Panel trigger buttons (FABs) - shown when panels are closed */}
          <TabletPanelTriggers
            leftPanelOpen={tabletLeftPanelOpen}
            rightPanelOpen={tabletRightPanelOpen}
            onOpenLeftPanel={openLeftPanel}
            onOpenRightPanel={openRightPanel}
          />

          {/* Modals */}
          {isHelpOpen && (
            <Suspense fallback={<LoadingFallback variant="overlay" label={t('loading.help')} />}>
              <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} isTablet />
            </Suspense>
          )}

          {/* Context menu (long-press on bin) */}
          {(() => {
            if (contextMenu) {
              const binIds = contextMenu.binIds;
              return (
                <BinContextMenuWrapper
                  binIds={binIds}
                  position={contextMenu.position}
                  onClose={hideContextMenu}
                  source={contextMenu.source}
                />
              );
            }
            return null;
          })()}

          {/* Shared layout URL importer - only load when URL has share params */}
          {hasShareUrl && (
            <Suspense fallback={null}>
              <SharedLayoutImporter />
            </Suspense>
          )}
        </div>
      );
    }

    // Desktop layout
    return wrapWithMutations(
      <div
        className={`h-screen flex flex-col overflow-hidden bg-surface text-content ${entranceClass}`}
      >
        {/* Skip to content link for keyboard navigation */}
        <a href="#main-grid" className="skip-to-content">
          {t('app.skipToGridEditor')}
        </a>

        {/* Shared layout banner (shown when viewing unsaved shared layout) */}
        {hasSharedLayoutPreview && (
          <Suspense fallback={null}>
            <SharedLayoutBanner />
          </Suspense>
        )}

        {/* Header */}
        <Header onHelpClick={() => setIsHelpOpen(true)} saveStatus={saveStatus} />

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar */}
          <PanelErrorBoundary panelName="Sidebar">
            <Sidebar />
          </PanelErrorBoundary>

          {/* Grid area */}
          <main
            id="main-grid"
            className="flex-1 flex flex-col overflow-hidden bg-surface"
            tabIndex={-1}
          >
            <Grid shouldShowDrawTutorial={shouldShowDrawTutorial} />
            <Staging />
          </main>

          {/* Right panel - Selection & Actions */}
          <PanelErrorBoundary panelName="Inspector">
            <RightPanel />
          </PanelErrorBoundary>
        </div>

        {/* Drop zones (appear when dragging) */}
        <DropZones />

        {/* Floating drag preview */}
        <DragPreview />

        {/* Modals */}
        {isHelpOpen && (
          <Suspense fallback={<LoadingFallback variant="overlay" label={t('loading.help')} />}>
            <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
          </Suspense>
        )}

        {/* Context menu (right-click on bin) */}
        {(() => {
          if (contextMenu) {
            const binIds = contextMenu.binIds;
            return (
              <BinContextMenuWrapper
                binIds={binIds}
                position={contextMenu.position}
                onClose={hideContextMenu}
                source={contextMenu.source}
              />
            );
          }
          return null;
        })()}

        {/* ARIA live region for screen reader announcements */}
        <LiveRegion />

        {/* Shared layout URL importer - only load when URL has share params */}
        {hasShareUrl && (
          <Suspense fallback={null}>
            <SharedLayoutImporter />
          </Suspense>
        )}
      </div>
    );
  })();

  // Shared overlays — rendered once for all routes (designer, mobile, tablet, desktop)
  return (
    <>
      {routeContent}
      <ToastContainer />
      {!isMobile && (
        <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      )}
      {isLabsDrawerOpen && (
        <Suspense fallback={null}>
          <LabsDrawer />
        </Suspense>
      )}
      {shouldShowWelcome && (
        <Suspense fallback={null}>
          <WelcomeModal isOpen onClose={markWelcomeComplete} />
        </Suspense>
      )}
    </>
  );
}
