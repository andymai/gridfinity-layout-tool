import { Suspense } from 'react';
import { useMobileStore } from '@/core/store/mobile';
import { useViewStore } from '@/core/store/view';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { Grid } from '@/features/grid-editor';
import { Staging } from '@/features/staging/components/Staging';
import { DragPreview } from '@/shell/DragPreview';
import { PanelErrorBoundary } from '@/shell/PanelErrorBoundary';
import { SharedLayoutImporter, SharedLayoutBanner } from '@/features/cloud-share/components';
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
  BinContextMenuWrapper,
  MobileAboutStrip,
} from '@/shell/Mobile';
import type { SaveStatus } from '@/shared/hooks';
import { useOnboarding } from '@/features/onboarding';

// Lazy load design-linking dialogs
const DesignLinkingDialogs = lazyWithRetry(() =>
  import('@/features/design-linking/components/DesignLinkingDialogs').then(
    namedExport('DesignLinkingDialogs')
  )
);
// Participants panel pulls the Liveblocks client (usePresence); collab is opt-in.
const ParticipantsPanel = lazyWithRetry(() =>
  import('@/shell/Collab/ParticipantsPanel').then(namedExport('ParticipantsPanel'))
);
// Lazy load mobile help modal (with retry for chunk load failures)
const MobileHelpModal = lazyWithRetry(() =>
  import('@/shell/Mobile/MobileHelpModal').then(namedExport('MobileHelpModal'))
);

export interface MobileLayoutProps {
  isMobileHelpOpen: boolean;
  setIsMobileHelpOpen: (open: boolean) => void;
  saveStatus: SaveStatus;
}

export function MobileLayout({
  isMobileHelpOpen,
  setIsMobileHelpOpen,
  saveStatus,
}: MobileLayoutProps) {
  const activeMobilePanel = useMobileStore((state) => state.activeMobilePanel);
  const setActiveMobilePanel = useMobileStore((state) => state.setActiveMobilePanel);
  const contextMenu = useViewStore((state) => state.contextMenu);
  const hideContextMenu = useViewStore((state) => state.hideContextMenu);
  const { shouldShowDrawTutorial } = useOnboarding();

  return (
    <div className="h-screen-safe flex flex-col overflow-hidden bg-surface text-content">
      {/* Shared layout banner (shown when viewing unsaved shared layout) */}
      <SharedLayoutBanner />

      {/* Mobile Header */}
      <MobileHeader onMenuClick={() => setActiveMobilePanel('settings')} saveStatus={saveStatus} />

      {/* Main content area - Grid takes full width */}
      <main className="flex-1 flex flex-col overflow-hidden bg-surface">
        <Grid shouldShowDrawTutorial={shouldShowDrawTutorial} />
        <Staging />
      </main>

      <MobileAboutStrip />

      {/* Bottom Navigation */}
      <BottomNavBar />

      {/* Bottom Sheet for panels */}
      {activeMobilePanel && (
        <BottomSheet title={getPanelTitle(activeMobilePanel)}>
          <MobilePanelContent panel={activeMobilePanel} />
        </BottomSheet>
      )}

      {/* Floating drag preview */}
      <DragPreview />

      {/* Context menu (long-press on bin) */}
      {contextMenu && (
        <BinContextMenuWrapper
          binIds={contextMenu.binIds}
          position={contextMenu.position}
          onClose={hideContextMenu}
          source={contextMenu.source}
        />
      )}

      {/* Design linking dialogs */}
      <Suspense fallback={null}>
        <DesignLinkingDialogs />
      </Suspense>

      {/* Mobile help modal (touch gestures guide) */}
      {isMobileHelpOpen && (
        <Suspense fallback={null}>
          <MobileHelpModal isOpen={isMobileHelpOpen} onClose={() => setIsMobileHelpOpen(false)} />
        </Suspense>
      )}

      {/* Shared layout URL importer */}
      <SharedLayoutImporter />
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
      case 'participants':
        return (
          <Suspense fallback={null}>
            <ParticipantsPanel />
          </Suspense>
        );
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
    <PanelErrorBoundary panelName={panelNames[panel] || 'Panel'}>{content}</PanelErrorBoundary>
  );
}
