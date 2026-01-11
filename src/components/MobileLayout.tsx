import { Suspense } from 'react';
import { useUIStore, useLayoutStore } from '../store';
import { lazyWithRetry, namedExport } from '../utils/lazyWithRetry';
import { Grid } from './Grid';
import { Staging } from './Staging';
import { DropZones } from './DropZones';
import { DragPreview } from './DragPreview';
import { ToastContainer } from './Toast';
import { PanelErrorBoundary } from './PanelErrorBoundary';
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
  MobileLayoutsPanel,
  BinContextMenu,
} from './mobile';

// Lazy load mobile help modal (with retry for chunk load failures)
const MobileHelpModal = lazyWithRetry(() =>
  import('./mobile/MobileHelpModal').then(namedExport('MobileHelpModal'))
);

interface MobileLayoutProps {
  isMobileHelpOpen: boolean;
  setIsMobileHelpOpen: (open: boolean) => void;
}

export function MobileLayout({ isMobileHelpOpen, setIsMobileHelpOpen }: MobileLayoutProps) {
  const activeMobilePanel = useUIStore(state => state.activeMobilePanel);
  const setActiveMobilePanel = useUIStore(state => state.setActiveMobilePanel);
  const contextMenu = useUIStore(state => state.contextMenu);
  const hideContextMenu = useUIStore(state => state.hideContextMenu);

  return (
    <div className="h-screen-safe flex flex-col overflow-hidden bg-surface text-content">
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
      {isMobileHelpOpen && (
        <Suspense fallback={null}>
          <MobileHelpModal isOpen={isMobileHelpOpen} onClose={() => setIsMobileHelpOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * Mobile panel content based on active panel type.
 */
function MobilePanelContent({ panel }: { panel: string }) {
  const content = (() => {
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
      case 'layouts':
        return <MobileLayoutsPanel />;
      default:
        return null;
    }
  })();

  if (!content) return null;

  const panelNames: Record<string, string> = {
    layers: 'Layers',
    inspector: 'Inspector',
    categories: 'Categories',
    print: 'Print List',
    settings: 'Settings',
    layouts: 'Layouts',
  };

  return (
    <PanelErrorBoundary panelName={panelNames[panel] || 'Panel'}>
      {content}
    </PanelErrorBoundary>
  );
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
