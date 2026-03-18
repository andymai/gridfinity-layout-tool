import { useEffect, useLayoutEffect, useState, useCallback, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
  useSnapshotAutoSave,
  useLocalStorageCleanup,
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
import { downloadLayoutAsFile, reconcileLibraryAsync } from '@/core/storage';
import { lazyWithRetry, namedExport } from './utils/lazyWithRetry';
import { Grid } from './features/grid-editor';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Staging } from './features/staging/components/Staging';
import { RightPanel } from './components/RightPanel';
import { DragPreview } from './components/DragPreview';
import { ToastContainer } from './shared/components/Toast';
import { LoadingFallback } from './shared/components/LoadingFallback';
import { PanelErrorBoundary } from './components/PanelErrorBoundary';
import { BinContextMenuWrapper } from './components/Mobile/BinContextMenuWrapper';
import { TabletPanelOverlay, TabletPanelTriggers } from './components/Tablet';
import { LiveRegion } from './components/LiveRegion';
import { LocalMutationsProvider } from './shared/contexts';
import { useTranslation } from '@/i18n';
import { useCommandPalette } from '@/features/command-palette';
import { useEngagementNudges } from '@/features/engagement';

const CommandPalette = lazyWithRetry(() =>
  import('@/features/command-palette/components/CommandPalette').then(namedExport('CommandPalette'))
);
import { useOnboarding } from '@/features/onboarding';
import { useThemeEffect } from '@/hooks/useThemeEffect';

const DesignLinkingDialogs = lazyWithRetry(() =>
  import('./features/design-linking/components/DesignLinkingDialogs').then(
    namedExport('DesignLinkingDialogs')
  )
);

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

const LabsDrawer = lazyWithRetry(() =>
  import('./features/labs/components/LabsDrawer').then(namedExport('LabsDrawer'))
);

const WelcomeModal = lazyWithRetry(() =>
  import('./components/Modals/WelcomeModal').then(namedExport('WelcomeModal'))
);

const DesignerPage = lazyWithRetry(() =>
  import('./features/bin-designer/components/DesignerPage').then(namedExport('DesignerPage'))
);
import { useDesignerRouting } from './hooks/useDesignerRouting';

const BaseplatePage = lazyWithRetry(() =>
  import('./features/baseplate').then(namedExport('BaseplatePage'))
);
import { useBaseplateRouting } from './hooks/useBaseplateRouting';
import { usePlaceBinFromURL } from './features/bin-designer/hooks/usePlaceBinInLayout';
import { SHORTCUTS } from './core/constants';

const HelpModal = lazyWithRetry(() =>
  import('./components/Modals/HelpModal').then(namedExport('HelpModal'))
);

const MobileLayout = lazyWithRetry(() =>
  import('./layouts/MobileLayout').then(namedExport('MobileLayout'))
);

const CollabProvider = lazyWithRetry(() =>
  import('./components/Collab/CollabProvider').then(namedExport('CollabProvider'))
);

let hasRenderedInitialLayout = false;

export default function App() {
  const t = useTranslation();
  useThemeEffect();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMobileHelpOpen, setIsMobileHelpOpen] = useState(false);

  const { isDesignerRoute, navigateToDesigner } = useDesignerRouting();
  const { isBaseplateRoute } = useBaseplateRouting();
  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen } = useCommandPalette({
    disabled: isDesignerRoute || isBaseplateRoute,
  });
  const { isMobile, isTablet } = useResponsive();

  const { shouldShowWelcome, shouldShowDrawTutorial, markWelcomeComplete } = useOnboarding();

  const contextMenu = useViewStore((state) => state.contextMenu);
  const hideContextMenu = useViewStore((state) => state.hideContextMenu);

  const { isCollaborative, shareId } = useCollabMode();
  const isLabsDrawerOpen = useLabsStore((state) => state.isDrawerOpen);
  const hasSharedLayoutPreview = useSharedPreviewStore((state) => state.sharedPreview !== null);

  const [hasShareUrl] = useState(() => {
    const hash = window.location.hash;
    const pathname = window.location.pathname;
    return hash.includes('share=') || /^\/l\/[a-zA-Z0-9]{12}$/.test(pathname);
  });

  usePlaceBinFromURL();
  useOwnedShareSync();

  useEffect(() => {
    return initLayoutAnalytics();
  }, []);

  useEffect(() => {
    const library = useLibraryStore.getState().library;
    void reconcileLibraryAsync(library)
      .then((cleaned) => {
        if (cleaned) {
          useLibraryStore.getState().setLibrary(cleaned);
        }
      })
      .catch(() => {});
  }, []);

  const {
    leftPanelOpen: tabletLeftPanelOpen,
    rightPanelOpen: tabletRightPanelOpen,
    openLeftPanel,
    closeLeftPanel,
    openRightPanel,
    closeRightPanel,
  } = useTabletPanels(isTablet);

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

  useLayoutEffect(() => {
    const layerExists = layers.some((l) => l.id === activeLayerId);
    if ((!activeLayerId || !layerExists) && layers.length > 0) {
      setActiveLayer(layers[0].id);
    }
    const categoryExists = categories.some((c) => c.id === activeCategoryId);
    if (!categoryExists && categories.length > 0) {
      setActiveCategory(categories[0].id);
    }
  }, [activeLayerId, activeCategoryId, layers, categories, setActiveLayer, setActiveCategory]);

  useKeyboard();
  const saveStatus = useAutoSave();
  useCrossTabSync();
  useLayoutRouting({ skip: isDesignerRoute || isBaseplateRoute });
  usePWAUpdate();
  useAnalytics();
  useEngagementNudges();
  useStorageMigration();
  useSnapshotAutoSave();
  useLocalStorageCleanup();
  usePrefetchChunks();

  const entranceClass = hasRenderedInitialLayout ? '' : 'animate-fade-in';
  useEffect(() => {
    hasRenderedInitialLayout = true;
  }, []);

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

  useEffect(() => {
    const handleOpenHelp = () => setIsHelpOpen(true);
    window.addEventListener('open-help-modal', handleOpenHelp);
    return () => window.removeEventListener('open-help-modal', handleOpenHelp);
  }, []);

  useEffect(() => {
    const handleSwitchToDesigner = () => navigateToDesigner();
    window.addEventListener('switch-to-designer', handleSwitchToDesigner);
    return () => window.removeEventListener('switch-to-designer', handleSwitchToDesigner);
  }, [navigateToDesigner]);

  useEffect(() => {
    const handleDownloadLayout = () => {
      const layout = useLayoutStore.getState().layout;
      const filename = `${layout.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
      void downloadLayoutAsFile(layout, filename);
    };
    window.addEventListener('download-layout', handleDownloadLayout);
    return () => window.removeEventListener('download-layout', handleDownloadLayout);
  }, []);

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

  const routeContent = (() => {
    if (isDesignerRoute) {
      return (
        <Suspense fallback={<LoadingFallback label={t('loading.designer')} />}>
          <DesignerPage />
        </Suspense>
      );
    }

    if (isBaseplateRoute) {
      return (
        <Suspense fallback={<LoadingFallback label={t('loading.baseplate')} />}>
          <BaseplatePage />
        </Suspense>
      );
    }

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

          <Header onHelpClick={() => setIsHelpOpen(true)} saveStatus={saveStatus} />

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

          <DragPreview />

          {/* Panel trigger buttons (FABs) - shown when panels are closed */}
          <TabletPanelTriggers
            leftPanelOpen={tabletLeftPanelOpen}
            rightPanelOpen={tabletRightPanelOpen}
            onOpenLeftPanel={openLeftPanel}
            onOpenRightPanel={openRightPanel}
          />

          {isHelpOpen && (
            <Suspense fallback={<LoadingFallback variant="overlay" label={t('loading.help')} />}>
              <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} isTablet />
            </Suspense>
          )}

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

          {hasShareUrl && (
            <Suspense fallback={null}>
              <SharedLayoutImporter />
            </Suspense>
          )}
        </div>
      );
    }

    return wrapWithMutations(
      <div
        className={`h-screen flex flex-col overflow-hidden bg-surface text-content ${entranceClass}`}
      >
        {/* Skip to content link for keyboard navigation */}
        <a href="#main-grid" className="skip-to-content">
          {t('app.skipToGridEditor')}
        </a>

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

        {/* Floating drag preview */}
        <DragPreview />

        {/* Modals */}
        {isHelpOpen && (
          <Suspense fallback={<LoadingFallback variant="overlay" label={t('loading.help')} />}>
            <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
          </Suspense>
        )}

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

  return (
    <>
      {routeContent}
      <ToastContainer />
      {!isMobile && commandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
        </Suspense>
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
