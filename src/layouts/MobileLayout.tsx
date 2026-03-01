import { Suspense } from 'react';
import { useMobileStore } from '@/core/store/mobile';
import { useViewStore } from '@/core/store/view';
import { lazyWithRetry, namedExport } from '@/utils/lazyWithRetry';
import { Grid } from '@/features/grid-editor';
import { Staging } from '@/features/staging/components/Staging';
import { DragPreview } from '@/components/DragPreview';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
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
} from '@/components/Mobile';
import { PresenceAvatarList } from '@/components/Collab';

// Lazy load design-linking dialogs
const DesignLinkingDialogs = lazyWithRetry(() =>
  import('@/features/design-linking/components/DesignLinkingDialogs').then(
    namedExport('DesignLinkingDialogs')
  )
);
import { usePresence } from '@/hooks/usePresence';
import { useCollabMode } from '@/hooks/useCollabMode';
import type { SaveStatus } from '@/shared/hooks';
import { useTranslation } from '@/i18n';
import { useOnboarding } from '@/features/onboarding';

// Lazy load mobile help modal (with retry for chunk load failures)
const MobileHelpModal = lazyWithRetry(() =>
  import('@/components/Mobile/MobileHelpModal').then(namedExport('MobileHelpModal'))
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
 * Participants panel content that safely calls usePresence().
 * Only mounted when in collaborative mode (inside RoomProvider).
 */
function ParticipantsPanel() {
  const t = useTranslation();
  const { isCollaborative } = useCollabMode();
  const { participants } = usePresence();

  // Safety check - should not reach here if not collaborative,
  // but guard just in case
  if (!isCollaborative) {
    return (
      <div className="px-4 py-8 text-center text-content-secondary text-sm">
        {t('layout.collaborativeEditingIsNotActive')}
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
    <PanelErrorBoundary panelName={panelNames[panel] || 'Panel'}>{content}</PanelErrorBoundary>
  );
}
