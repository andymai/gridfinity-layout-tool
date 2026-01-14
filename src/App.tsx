import { useEffect, useLayoutEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useLayoutStore, useUIStore, useLibraryStore } from './store';
import { useKeyboard, useAutoSave, useResponsive, useCrossTabSync, useLayoutRouting, usePWAUpdate, useAnalytics, useStorageMigration } from './hooks';
import { initializeLayoutLibrary } from './storage';
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
import { BinContextMenu, MultiBinContextMenu } from './components/mobile';
import { TabletPanelOverlay, TabletPanelTriggers } from './components/tablet';
import { LiveRegion } from './components/LiveRegion';
import { SharedLayoutImporter } from './components/SharedLayoutImporter';
import { SharedLayoutBanner } from './components/SharedLayoutBanner';
import { LabsDrawer } from './components/labs';
import { SHORTCUTS } from './constants';

// Legacy context menu state for backwards compatibility
interface LegacyContextMenuState {
  binId?: string;
  position: { x: number; y: number };
}

// Lazy load modals - only loaded when opened (with retry for chunk load failures)
const HelpModal = lazyWithRetry(() =>
  import('./components/modals/HelpModal').then(namedExport('HelpModal'))
);

// Lazy load mobile layout - only loaded on mobile devices
const MobileLayout = lazyWithRetry(() =>
  import('./components/MobileLayout').then(namedExport('MobileLayout'))
);

// Initialize layout library once at module level to avoid effect setState issues
let initialLoadError: Error | null = null;
try {
  const { library, activeLayout } = initializeLayoutLibrary();
  useLibraryStore.getState().initLibrary(library);
  useLayoutStore.getState().importLayout(activeLayout, library.activeLayoutId, 'init');
} catch (e) {
  initialLoadError = e as Error;
}

export default function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMobileHelpOpen, setIsMobileHelpOpen] = useState(false);
  const { isMobile, isTablet } = useResponsive();
  const contextMenu = useUIStore(state => state.contextMenu);
  const hideContextMenu = useUIStore(state => state.hideContextMenu);

  // Tablet panel state (use collapsed state inverted - collapsed means hidden in overlay mode)
  const leftPanelCollapsed = useUIStore(state => state.leftPanelCollapsed);
  const rightPanelCollapsed = useUIStore(state => state.rightPanelCollapsed);
  const toggleLeftPanel = useUIStore(state => state.toggleLeftPanel);
  const toggleRightPanel = useUIStore(state => state.toggleRightPanel);

  // For tablet, we want panels to start collapsed (hidden as overlays)
  // leftPanelCollapsed=true means sidebar is hidden, false means visible as overlay
  const tabletLeftPanelOpen = isTablet && !leftPanelCollapsed;
  const tabletRightPanelOpen = isTablet && !rightPanelCollapsed;

  // Track previous tablet state to detect mode entry
  const wasTabletRef = useRef(isTablet);

  // Tablet panel management: Collapse both panels when entering tablet mode
  // Note: Mutual exclusion (only one panel open at a time) is handled in store actions
  useEffect(() => {
    const justEnteredTablet = isTablet && !wasTabletRef.current;
    wasTabletRef.current = isTablet;

    if (!isTablet) return;

    // When entering tablet mode, collapse both panels
    if (justEnteredTablet) {
      if (!leftPanelCollapsed) toggleLeftPanel();
      if (!rightPanelCollapsed) toggleRightPanel();
    }
  }, [isTablet, leftPanelCollapsed, rightPanelCollapsed, toggleLeftPanel, toggleRightPanel]);

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
    return (
      <div className="h-screen animate-fade-in">
        <Suspense fallback={<div className="h-screen bg-surface" />}>
          <MobileLayout isMobileHelpOpen={isMobileHelpOpen} setIsMobileHelpOpen={setIsMobileHelpOpen} saveStatus={saveStatus} />
        </Suspense>
      </div>
    );
  }

  // Tablet layout - full width grid with overlay panels
  if (isTablet) {
    return (
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
          onClose={toggleLeftPanel}
          side="left"
        >
          <PanelErrorBoundary panelName="Sidebar">
            <Sidebar />
          </PanelErrorBoundary>
        </TabletPanelOverlay>

        {/* Right panel as overlay */}
        <TabletPanelOverlay
          isOpen={tabletRightPanelOpen}
          onClose={toggleRightPanel}
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
          onOpenLeftPanel={toggleLeftPanel}
          onOpenRightPanel={toggleRightPanel}
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
  return (
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

/**
 * Context menu wrapper that routes to single or multi-bin menu.
 */
function BinContextMenuWrapper({
  binIds,
  position,
  onClose,
  source,
}: {
  binIds: string[];
  position: { x: number; y: number };
  onClose: () => void;
  source?: 'grid' | 'staging';
}) {
  const bins = useLayoutStore(state => state.layout.bins);
  const selectedBinIds = useUIStore(state => state.selectedBinIds);

  // Guard: ensure binIds is valid
  if (!binIds || binIds.length === 0) return null;

  // Multi-select detection: if first bin is selected AND multiple bins selected
  const isMultiSelect = selectedBinIds.includes(binIds[0]) && selectedBinIds.length > 1;

  if (isMultiSelect) {
    const selectedBins = bins.filter(b => selectedBinIds.includes(b.id));
    return <MultiBinContextMenu binIds={selectedBins.map(b => b.id)} position={position} onClose={onClose} source={source} />;
  }

  // Single bin context menu
  const bin = bins.find(b => b.id === binIds[0]);
  if (!bin) return null;

  return <BinContextMenu bin={bin} position={position} onClose={onClose} source={source} />;
}
