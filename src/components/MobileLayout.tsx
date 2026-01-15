import { Suspense } from 'react';
import { useUIStore, useLayoutStore } from '../store';
import { lazyWithRetry, namedExport } from '../utils/lazyWithRetry';
import { Grid } from './Grid';
import { Staging } from './Staging';
import { DropZones } from './DropZones';
import { DragPreview } from './DragPreview';
import { ToastContainer } from './Toast';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { SharedLayoutImporter } from './SharedLayoutImporter';
import { SharedLayoutBanner } from './SharedLayoutBanner';
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
  MultiBinContextMenu,
} from './mobile';
import { LabsDrawer } from './labs';
import { PresenceAvatarList } from './collab';
import { usePresence } from '../hooks/usePresence';
import { useCollabMode } from '../hooks/useCollabMode';
import type { SaveStatus } from '../hooks/useAutoSave';

// Legacy context menu state for backwards compatibility
interface LegacyContextMenuState {
  binId?: string;
  position: { x: number; y: number };
}

// Lazy load mobile help modal (with retry for chunk load failures)
const MobileHelpModal = lazyWithRetry(() =>
  import('./mobile/MobileHelpModal').then(namedExport('MobileHelpModal'))
);

interface MobileLayoutProps {
  isMobileHelpOpen: boolean;
  setIsMobileHelpOpen: (open: boolean) => void;
  saveStatus: SaveStatus;
}

export function MobileLayout({ isMobileHelpOpen, setIsMobileHelpOpen, saveStatus }: MobileLayoutProps) {
  const activeMobilePanel = useUIStore(state => state.activeMobilePanel);
  const setActiveMobilePanel = useUIStore(state => state.setActiveMobilePanel);
  const contextMenu = useUIStore(state => state.contextMenu);
  const hideContextMenu = useUIStore(state => state.hideContextMenu);

  return (
    <div className="h-screen-safe flex flex-col overflow-hidden bg-surface text-content">
      {/* Shared layout banner (shown when viewing unsaved shared layout) */}
      <SharedLayoutBanner />

      {/* Mobile Header */}
      <MobileHeader onMenuClick={() => setActiveMobilePanel('settings')} onHelpClick={() => setIsMobileHelpOpen(true)} saveStatus={saveStatus} />

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
          // Backwards compatibility: support both old (binId) and new (binIds) formats
          binIds={contextMenu.binIds || ((contextMenu as unknown as LegacyContextMenuState).binId ? [(contextMenu as unknown as LegacyContextMenuState).binId] : [])}
          position={contextMenu.position}
          onClose={hideContextMenu}
          source={contextMenu.source}
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

      {/* Shared layout URL importer */}
      <SharedLayoutImporter />

      {/* Labs drawer */}
      <LabsDrawer />
    </div>
  );
}

/**
 * Participants panel content that safely calls usePresence().
 * Only mounted when in collaborative mode (inside RoomProvider).
 */
function ParticipantsPanel() {
  const { isCollaborative } = useCollabMode();
  const { participants } = usePresence();

  // Safety check - should not reach here if not collaborative,
  // but guard just in case
  if (!isCollaborative) {
    return (
      <div className="px-4 py-8 text-center text-content-secondary text-sm">
        Collaborative editing is not active
      </div>
    );
  }

  return <PresenceAvatarList participants={participants} className="px-2" />;
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
      case 'participants':
        return <ParticipantsPanel />;
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
    participants: 'Collaborators',
  };

  return (
    <PanelErrorBoundary panelName={panelNames[panel] || 'Panel'}>
      {content}
    </PanelErrorBoundary>
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
