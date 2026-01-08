import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { useLayoutStore, useUIStore } from './store';
import { useKeyboard, useAutoSave, useResponsive } from './hooks';
import { loadLayout } from './utils/storage';
import { Grid } from './components/Grid';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Staging } from './components/Staging';
import { RightPanel } from './components/RightPanel';
import { DropZones } from './components/DropZones';
import { DragPreview } from './components/DragPreview';
import { HelpModal } from './components/modals/HelpModal';
import { ToastContainer } from './components/Toast';
import {
  MobileHeader,
  BottomNavBar,
  BottomSheet,
  getPanelTitle,
  MobileLayersPanel,
  MobileCategoriesPanel,
  MobileInspector,
  MobilePrintList,
  MobileSettingsPanel,
  BinContextMenu,
  MobileHelpModal,
} from './components/mobile';
import { TabletPanelOverlay } from './components/tablet';
import { SHORTCUTS } from './constants';

// Load layout once at module level to avoid effect setState issues
let initialLoadError: Error | null = null;
try {
  const savedLayout = loadLayout();
  if (savedLayout) {
    useLayoutStore.getState().importLayout(savedLayout);
  }
} catch (e) {
  initialLoadError = e as Error;
}

export default function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMobileHelpOpen, setIsMobileHelpOpen] = useState(false);
  const { isMobile, isTablet } = useResponsive();
  const activeMobilePanel = useUIStore(state => state.activeMobilePanel);
  const setActiveMobilePanel = useUIStore(state => state.setActiveMobilePanel);
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

  // Consolidated tablet panel management:
  // 1. Collapse both panels when entering tablet mode
  // 2. Auto-close opposite panel when one opens
  useEffect(() => {
    const justEnteredTablet = isTablet && !wasTabletRef.current;
    wasTabletRef.current = isTablet;

    if (!isTablet) return;

    // When entering tablet mode, collapse both panels
    if (justEnteredTablet) {
      if (!leftPanelCollapsed) toggleLeftPanel();
      if (!rightPanelCollapsed) toggleRightPanel();
      return;
    }

    // Auto-close opposite panel when one opens (only one panel at a time)
    if (!leftPanelCollapsed && !rightPanelCollapsed) {
      // Both are open - close the right panel (left takes priority)
      toggleRightPanel();
    }
  }, [isTablet, leftPanelCollapsed, rightPanelCollapsed, toggleLeftPanel, toggleRightPanel]);

  const layout = useLayoutStore(state => state.layout);
  const activeLayerId = useUIStore(state => state.activeLayerId);
  const activeCategoryId = useUIStore(state => state.activeCategoryId);
  const setActiveLayer = useUIStore(state => state.setActiveLayer);
  const setActiveCategory = useUIStore(state => state.setActiveCategory);
  const paintSize = useUIStore(state => state.paintSize);
  const setPaintSize = useUIStore(state => state.setPaintSize);

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
  useAutoSave();

  // Help modal keyboard shortcut
  const handleHelpKeyboard = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (e.key === SHORTCUTS.HELP) {
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

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-surface text-content">
        {/* Mobile Header */}
        <MobileHeader onMenuClick={() => setActiveMobilePanel('settings')} onHelpClick={() => setIsMobileHelpOpen(true)} />

        {/* Main content area - Grid takes full width */}
        <main className="flex-1 flex flex-col overflow-hidden bg-surface">
          <Grid />
          <Staging />
        </main>

        {/* Bottom Navigation */}
        <BottomNavBar />

        {/* Bottom Sheet for panels */}
        {activeMobilePanel && (
          <BottomSheet title={getPanelTitle(activeMobilePanel)}>
            <MobilePanelContent panel={activeMobilePanel} />
          </BottomSheet>
        )}

        {/* Drop zones (appear when dragging) */}
        <DropZones />

        {/* Floating drag preview */}
        <DragPreview />

        {/* Paint mode indicator */}
        {paintSize && (
          <div className="paint-mode-indicator" role="status" aria-live="polite">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Paint Mode: {paintSize.width}×{paintSize.depth}</span>
            <button
              onClick={() => setPaintSize(null)}
              className="ml-1 hover:opacity-80 transition-opacity"
              aria-label="Exit paint mode"
            >
              <kbd>Esc</kbd>
            </button>
          </div>
        )}

        {/* Context menu (long-press on bin) */}
        {contextMenu && (
          <BinContextMenuWrapper
            binId={contextMenu.binId}
            position={contextMenu.position}
            onClose={hideContextMenu}
          />
        )}

        {/* Toast notifications */}
        <ToastContainer />

        {/* Mobile help modal (touch gestures guide) */}
        <MobileHelpModal isOpen={isMobileHelpOpen} onClose={() => setIsMobileHelpOpen(false)} />
      </div>
    );
  }

  // Tablet layout - full width grid with overlay panels
  if (isTablet) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-surface text-content">
        {/* Header */}
        <Header onHelpClick={() => setIsHelpOpen(true)} />

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
          <Sidebar />
        </TabletPanelOverlay>

        {/* Right panel as overlay */}
        <TabletPanelOverlay
          isOpen={tabletRightPanelOpen}
          onClose={toggleRightPanel}
          side="right"
        >
          <RightPanel />
        </TabletPanelOverlay>

        {/* Drop zones (appear when dragging) */}
        <DropZones />

        {/* Floating drag preview */}
        <DragPreview />

        {/* Modals */}
        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

        {/* Paint mode indicator */}
        {paintSize && (
          <div className="paint-mode-indicator" role="status" aria-live="polite">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Paint Mode: {paintSize.width}×{paintSize.depth}</span>
            <button
              onClick={() => setPaintSize(null)}
              className="ml-1 hover:opacity-80 transition-opacity"
              aria-label="Exit paint mode"
            >
              <kbd>Esc</kbd>
            </button>
          </div>
        )}

        {/* Context menu (long-press on bin) */}
        {contextMenu && (
          <BinContextMenuWrapper
            binId={contextMenu.binId}
            position={contextMenu.position}
            onClose={hideContextMenu}
          />
        )}

        {/* Toast notifications */}
        <ToastContainer />
      </div>
    );
  }

  // Desktop layout (unchanged)
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface text-content">
      {/* Header */}
      <Header onHelpClick={() => setIsHelpOpen(true)} />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <Sidebar />

        {/* Grid area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-surface">
          <Grid />
          <Staging />
        </main>

        {/* Right panel - Selection & Actions */}
        <RightPanel />
      </div>

      {/* Drop zones (appear when dragging) */}
      <DropZones />

      {/* Floating drag preview */}
      <DragPreview />

      {/* Modals */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Paint mode indicator */}
      {paintSize && (
        <div className="paint-mode-indicator" role="status" aria-live="polite">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span>Paint Mode: {paintSize.width}×{paintSize.depth}</span>
          <button
            onClick={() => setPaintSize(null)}
            className="ml-1 hover:opacity-80 transition-opacity"
            aria-label="Exit paint mode"
          >
            <kbd>Esc</kbd>
          </button>
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}

/**
 * Mobile panel content based on active panel type.
 */
function MobilePanelContent({ panel }: { panel: string }) {
  switch (panel) {
    case 'layers':
      return <MobileLayersPanel />;
    case 'inspector':
      return <MobileInspector />;
    case 'categories':
      return <MobileCategoriesPanel />;
    case 'print':
      return <MobilePrintList />;
    case 'settings':
      return <MobileSettingsPanel />;
    default:
      return null;
  }
}

/**
 * Context menu wrapper that looks up the bin from the store.
 */
function BinContextMenuWrapper({
  binId,
  position,
  onClose,
}: {
  binId: string;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const bins = useLayoutStore(state => state.layout.bins);
  const bin = bins.find(b => b.id === binId);

  if (!bin) return null;

  return <BinContextMenu bin={bin} position={position} onClose={onClose} />;
}
