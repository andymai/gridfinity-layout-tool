import { useEffect, useLayoutEffect, useState, useCallback, Suspense } from 'react';
import { useLayoutStore, useUIStore, useLibraryStore } from './store';
import { useKeyboard, useAutoSave, useResponsive, useCrossTabSync, useLayoutRouting, usePWAUpdate, useAnalytics, useStorageMigration, useTabletPanels } from './hooks';
import { useCollabMode } from './hooks/useCollabMode';
import { useOwnedShareSync } from './hooks/useOwnedShareSync';
import { initializeLayoutLibrary, loadSharedWithMe } from './storage';
import { lazyWithRetry, namedExport } from './utils/lazyWithRetry';
import { Grid } from './components/Grid';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Staging } from './components/Staging';
import { RightPanel } from './components/RightPanel';
import { DropZones } from './components/DropZones';
import { DragPreview } from './components/DragPreview';
import { ToastContainer } from './components/Toast';
import { PanelErrorBoundary } from './components/PanelErrorBoundary';
import { BinContextMenuWrapper } from './components/Mobile';
import { TabletPanelOverlay, TabletPanelTriggers } from './components/Tablet';
import { LiveRegion } from './components/LiveRegion';
import { SharedLayoutImporter, SharedLayoutBanner } from './components/Share';
import { LabsDrawer } from './components/Labs';
import { LocalMutationsProvider } from './context/MutationsContext';
import { SHORTCUTS } from './constants';

// Legacy context menu state for backwards compatibility
interface LegacyContextMenuState {
  binId?: string;
  position: { x: number; y: number };
}

// Lazy load modals - only loaded when opened (with retry for chunk load failures)
const HelpModal = lazyWithRetry(() =>
  import('./components/Modals/HelpModal').then(namedExport('HelpModal'))
);

// Lazy load mobile layout - only loaded on mobile devices
const MobileLayout = lazyWithRetry(() =>
  import('./components/MobileLayout').then(namedExport('MobileLayout'))
);

// Lazy load collaborative editing provider - only loaded when Labs feature enabled
// AND layout has edit permission (most users never need this ~80KB chunk)
const CollabProvider = lazyWithRetry(() =>
  import('./components/Collab/CollabProvider').then(namedExport('CollabProvider'))
);

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

export default function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMobileHelpOpen, setIsMobileHelpOpen] = useState(false);
  const { isMobile, isTablet } = useResponsive();
  const contextMenu = useUIStore(state => state.contextMenu);
  const hideContextMenu = useUIStore(state => state.hideContextMenu);

  // Collaborative mode detection
  const { isCollaborative, shareId } = useCollabMode();

  // Auto-sync owned shared layouts to Blob storage (Google Docs-like behavior)
  useOwnedShareSync();

  // Tablet panel state (auto-collapses on tablet mode entry)
  const {
    leftPanelOpen: tabletLeftPanelOpen,
    rightPanelOpen: tabletRightPanelOpen,
    openLeftPanel,
    closeLeftPanel,
    openRightPanel,
    closeRightPanel,
  } = useTabletPanels(isTablet);

  const layout = useLayoutStore(state => state.layout);
  const activeLayerId = useUIStore(state => state.activeLayerId);
  const activeCategoryId = useUIStore(state => state.activeCategoryId);
  const setActiveLayer = useUIStore(state => state.setActiveLayer);
  const setActiveCategory = useUIStore(state => state.setActiveCategory);

  // Initialize activeLayerId and activeCategoryId to valid values (sync before paint)
  useLayoutEffect(() => {
    // Check if current activeLayerId is valid for the current layout
    const layerExists = layout.layers.some(l => l.id === activeLayerId);
    if ((!activeLayerId || !layerExists) && layout.layers.length > 0) {
      setActiveLayer(layout.layers[0].id);
    }
    // Ensure activeCategoryId is valid for current layout
    const categoryExists = layout.categories.some(c => c.id === activeCategoryId);
    if (!categoryExists && layout.categories.length > 0) {
      setActiveCategory(layout.categories[0].id);
    }
  }, [activeLayerId, activeCategoryId, layout.layers, layout.categories, setActiveLayer, setActiveCategory]);

  // Global keyboard shortcuts
  useKeyboard();

  // Auto-save to localStorage
  const saveStatus = useAutoSave();

  // Cross-tab sync detection
  useCrossTabSync();

  // URL-based layout routing (bookmarkable URLs)
  useLayoutRouting();

  // PWA update detection and auto-reload
  usePWAUpdate();

  // Analytics session tracking
  useAnalytics();

  // Storage migration (localStorage → IndexedDB)
  useStorageMigration();

  // Help modal keyboard shortcut
  const handleHelpKeyboard = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    if ((SHORTCUTS.HELP as readonly string[]).includes(e.key)) {
      e.preventDefault();
      setIsHelpOpen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleHelpKeyboard);
    return () => window.removeEventListener('keydown', handleHelpKeyboard);
  }, [handleHelpKeyboard]);

  // Helper to wrap content with appropriate MutationsProvider
  // - Collaborative mode: CollabProvider provides CollabMutationsProvider (lazy loaded)
  // - Local mode: LocalMutationsProvider
  const wrapWithMutations = (content: React.ReactNode) => {
    if (isCollaborative && shareId) {
      return (
        <Suspense fallback={<div className="h-screen bg-surface" />}>
          <CollabProvider shareId={shareId}>
            {content}
          </CollabProvider>
        </Suspense>
      );
    }
    return (
      <LocalMutationsProvider>
        {content}
      </LocalMutationsProvider>
    );
  };

  if (initialLoadError) {
    return (
      <div className="h-screen flex items-center justify-center bg-red-900 text-white">
        <div>
          <h1>Error loading app</h1>
          <pre>{initialLoadError.message}</pre>
        </div>
      </div>
    );
  }

  // Mobile layout - lazy loaded
  if (isMobile) {
    return wrapWithMutations(
      <div className="h-screen animate-fade-in">
        <Suspense fallback={<div className="h-screen bg-surface" />}>
          <MobileLayout isMobileHelpOpen={isMobileHelpOpen} setIsMobileHelpOpen={setIsMobileHelpOpen} saveStatus={saveStatus} />
        </Suspense>
      </div>
    );
  }

  // Tablet layout - full width grid with overlay panels
  if (isTablet) {
    return wrapWithMutations(
      <div className="h-screen flex flex-col overflow-hidden bg-surface text-content animate-fade-in">
        {/* Shared layout banner (shown when viewing unsaved shared layout) */}
        <SharedLayoutBanner />

        {/* Header */}
        <Header onHelpClick={() => setIsHelpOpen(true)} saveStatus={saveStatus} />

        {/* Main content area - Grid takes full width */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 flex flex-col overflow-hidden bg-surface">
            <Grid />
            <Staging />
          </main>
        </div>

        {/* Left sidebar as overlay */}
        <TabletPanelOverlay
          isOpen={tabletLeftPanelOpen}
          onClose={closeLeftPanel}
          side="left"
        >
          <PanelErrorBoundary panelName="Sidebar">
            <Sidebar />
          </PanelErrorBoundary>
        </TabletPanelOverlay>

        {/* Right panel as overlay */}
        <TabletPanelOverlay
          isOpen={tabletRightPanelOpen}
          onClose={closeRightPanel}
          side="right"
        >
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
          <Suspense fallback={null}>
            <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} isTablet />
          </Suspense>
        )}

        {/* Context menu (long-press on bin) */}
        {(() => {
          if (contextMenu) {
            const legacy = contextMenu as unknown as LegacyContextMenuState;
            const binIds = contextMenu.binIds || (legacy.binId ? [legacy.binId] : []);
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

        {/* Toast notifications */}
        <ToastContainer />

        {/* Shared layout URL importer */}
        <SharedLayoutImporter />

        {/* Labs drawer */}
        <LabsDrawer />
      </div>
    );
  }

  // Desktop layout
  return wrapWithMutations(
    <div className="h-screen flex flex-col overflow-hidden bg-surface text-content animate-fade-in">
      {/* Shared layout banner (shown when viewing unsaved shared layout) */}
      <SharedLayoutBanner />

      {/* Header */}
      <Header onHelpClick={() => setIsHelpOpen(true)} saveStatus={saveStatus} />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <PanelErrorBoundary panelName="Sidebar">
          <Sidebar />
        </PanelErrorBoundary>

        {/* Grid area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-surface">
          <Grid />
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
        <Suspense fallback={null}>
          <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        </Suspense>
      )}

      {/* Context menu (right-click on bin) */}
      {(() => {
        if (contextMenu) {
          const legacy = contextMenu as unknown as LegacyContextMenuState;
          const binIds = contextMenu.binIds || (legacy.binId ? [legacy.binId] : []);
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

      {/* Toast notifications */}
      <ToastContainer />

      {/* ARIA live region for screen reader announcements */}
      <LiveRegion />

      {/* Shared layout URL importer */}
      <SharedLayoutImporter />

      {/* Labs drawer */}
      <LabsDrawer />
    </div>
  );
}
