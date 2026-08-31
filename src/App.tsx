import { useEffect, useLayoutEffect, useState, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { GlobalSettingsModal } from '@/shell/Modals/SettingsModal/GlobalSettingsModal';
import {
  useLayoutStore,
  useLibraryStore,
  useSelectionStore,
  useViewStore,
  useLabsStore,
} from '@/core/store';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import { useBinExampleGalleryStore } from '@/core/store/binExampleGallery';
import { useCommunityPublishStore } from '@/core/store/communityPublish';
import { initLayoutAnalytics } from '@/core/store/layoutAnalytics';
import {
  useAutoSave,
  useResponsive,
  useCrossTabSync,
  usePWAUpdate,
  usePrefetchChunks,
  useAnalytics,
  useStorageMigration,
  useSnapshotAutoSave,
  useLocalStorageCleanup,
  useTabletPanels,
  useKeyboard,
  useCollabMode,
} from '@/shared/hooks';
import { useLayoutRouting } from '@/features/layout-library';
import { useOwnedShareSync } from '@/features/cloud-share/hooks/useOwnedShareSync';
import { reconcileLibraryAsync } from '@/core/storage';
import {
  LazySyncSessionMount,
  CommandPalette,
  DesignLinkingDialogs,
  SharedLayoutImporter,
  SharedLayoutBanner,
  LabsDrawer,
  DesignerPage,
  BaseplatePage,
  BaseplateLibraryInitMount,
  SupportersPage,
  CommunityPage,
  DevThumbnailRoute,
  HelpModal,
  MobileLayout,
  CollabProvider,
  WhatsNewModal,
  DesignGalleryModal,
  CommunityPublishDialog,
} from './App.lazyComponents';
import { useRouteMeta } from '@/shared/hooks/useRouteMeta';
import { useAppWindowEvents } from '@/shared/hooks/useAppWindowEvents';
import { Grid } from '@/features/grid-editor';
import { Sidebar } from '@/shell/Sidebar';
import { Header } from '@/shell/Header';
import { Staging } from '@/features/staging/components/Staging';
import { RightPanel } from '@/shell/RightPanel';
import { DragPreview } from '@/shell/DragPreview';
import { ToastContainer } from '@/shared/components/Toast';
import { LoadingFallback } from '@/shared/components/LoadingFallback';
import { PanelErrorBoundary } from '@/shell/PanelErrorBoundary';
import { BackgroundMountBoundary } from '@/shell/BackgroundMountBoundary';
import { BinContextMenuWrapper } from '@/shell/Mobile/BinContextMenuWrapper';
import { TabletPanelOverlay, TabletPanelTriggers } from '@/shell/Tablet';
import { LiveRegion } from '@/shell/LiveRegion';
import { LocalMutationsProvider } from '@/shared/contexts';
import { DesignStoreRegistration } from '@/shared/storage/DesignStoreRegistration';
import { LinkedRiseRegistration } from '@/shared/storage/LinkedRiseRegistration';
import { useTranslation } from '@/i18n';
import { useCommandPalette } from '@/features/command-palette';
import { useEngagementNudges } from '@/features/engagement';
import { useOnboarding } from '@/features/onboarding';
import { useWhatsNewAutoOpen } from '@/features/whats-new';
import { useThemeEffect } from '@/shared/hooks/useThemeEffect';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { useBaseplateRouting } from '@/shared/hooks/useBaseplateRouting';
import { useSupportersRouting } from '@/shared/hooks/useSupportersRouting';
import { useCommunityRouting } from '@/shared/hooks/useCommunityRouting';
import {
  clearLocalPublishedId,
  editOriginalCommunityDesign,
  openPublishForActiveDesign,
  remixCommunityDesign,
} from '@/shell/Modals/DesignGalleryModal/communityDesignerBridge';
import { usePlaceBinFromURL } from '@/features/bin-designer/hooks/usePlaceBinInLayout';
import { useBackgroundThumbnailRegen } from '@/features/bin-designer';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useSpaceMouseDevice } from '@/shared/spacemouse/useSpaceMouseDevice';
import { useCommunityPublishReturn } from '@/shared/hooks/useCommunityPublishReturn';
import { useCommunityLikeReturn } from '@/shared/hooks/useCommunityLikeReturn';
import { useCommunityDigestCheck } from '@/shared/hooks/useCommunityDigestCheck';

let hasRenderedInitialLayout = false;

export default function App() {
  const t = useTranslation();
  useThemeEffect();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMobileHelpOpen, setIsMobileHelpOpen] = useState(false);

  const { isDesignerRoute, navigateToDesigner } = useDesignerRouting();
  const { isBaseplateRoute } = useBaseplateRouting();
  const { isSupportersRoute, navigateToSupporters } = useSupportersRouting();
  // False while the community_showcase flag is off (gated inside the hook),
  // so the /community URL falls through to the layout planner.
  const { isCommunityRoute, communityDesignIdFromUrl } = useCommunityRouting();
  // Dev-only thumbnail capture route. Suppresses layout/designer routing so
  // those hooks don't rewrite the URL and strip the query params we depend on.
  const isDevThumbnailRoute =
    import.meta.env.DEV && new URLSearchParams(window.location.search).get('devThumbnails') === '1';
  // Every route tree except the layout editor. Hooks that act on the layout
  // (its shortcuts, its URL slug) stand down here; add new routes to this one
  // expression rather than to each call site.
  const isNonLayoutRoute =
    isDesignerRoute ||
    isBaseplateRoute ||
    isSupportersRoute ||
    isCommunityRoute ||
    isDevThumbnailRoute;
  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen } = useCommandPalette({
    disabled: isNonLayoutRoute,
  });
  const binExampleGalleryOpen = useBinExampleGalleryStore((s) => s.isOpen);
  const closeBinExampleGallery = useBinExampleGalleryStore((s) => s.close);
  const communityPublishOpen = useCommunityPublishStore((s) => s.isOpen);
  const communityShowcaseEnabled = useFeatureFlag('community_showcase');
  const [commandPaletteInitialQuery, setCommandPaletteInitialQuery] = useState('');

  useRouteMeta({
    isDesignerRoute,
    isBaseplateRoute,
    isSupportersRoute,
    isCommunityRoute,
    communityDesignIdFromUrl,
  });
  const { isMobile, isTablet } = useResponsive();

  const { shouldShowDrawTutorial } = useOnboarding();

  const whatsNewOpen = useViewStore((state) => state.whatsNewOpen);
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
  useBackgroundThumbnailRegen();
  useCommunityPublishReturn();
  useCommunityLikeReturn();
  useCommunityDigestCheck();

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

  useKeyboard({ disabled: isNonLayoutRoute });
  useSpaceMouseDevice(useFeatureFlag('spacemouse'));
  const saveStatus = useAutoSave();
  useCrossTabSync();
  useLayoutRouting({ skip: isNonLayoutRoute });
  usePWAUpdate();
  useAnalytics();
  useEngagementNudges();

  // Suppressed on arrivals that came for something specific and while the
  // first-run tutorial is still up: the digest is for someone returning to
  // their own drawer, not for someone opening a shared link.
  useWhatsNewAutoOpen({
    allowed:
      !hasShareUrl &&
      !isCollaborative &&
      !isCommunityRoute &&
      !isSupportersRoute &&
      !hasSharedLayoutPreview &&
      !shouldShowDrawTutorial,
  });
  useStorageMigration();
  useSnapshotAutoSave();
  useLocalStorageCleanup();
  usePrefetchChunks();

  const entranceClass = hasRenderedInitialLayout ? '' : 'animate-fade-in';
  useEffect(() => {
    hasRenderedInitialLayout = true;
  }, []);

  useAppWindowEvents({
    setIsHelpOpen,
    setCommandPaletteOpen,
    setCommandPaletteInitialQuery,
    navigateToSupporters,
    navigateToDesigner,
  });

  const wrapWithMutations = (content: React.ReactNode) => {
    const dialogs = (
      <>
        <Suspense fallback={null}>
          <DesignLinkingDialogs />
        </Suspense>
        {/* Own Suspense so planner baseplate resolution isn't gated on the
            unrelated design-linking chunk loading, and its own boundary so a
            chunk that never arrives costs the margin resolution rather than
            the app. */}
        <BackgroundMountBoundary mountName="BaseplateLibraryInitMount">
          <Suspense fallback={null}>
            <BaseplateLibraryInitMount />
          </Suspense>
        </BackgroundMountBoundary>
      </>
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
    if (isDevThumbnailRoute) {
      return (
        <Suspense fallback={null}>
          <DevThumbnailRoute />
        </Suspense>
      );
    }

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

    if (isSupportersRoute) {
      return (
        <Suspense fallback={<LoadingFallback label={t('loading.supporters')} />}>
          <SupportersPage />
        </Suspense>
      );
    }

    if (isCommunityRoute) {
      return (
        <Suspense fallback={<LoadingFallback label={t('loading.community')} />}>
          <CommunityPage
            onRequestPublish={openPublishForActiveDesign}
            onRemixDesign={remixCommunityDesign}
            onEditOriginal={editOriginalCommunityDesign}
            onEditOwnDesign={editOriginalCommunityDesign}
            onOwnDesignUnpublished={clearLocalPublishedId}
          />
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

          <Header saveStatus={saveStatus} />

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

          {hasShareUrl && (
            <BackgroundMountBoundary mountName="SharedLayoutImporter">
              <Suspense fallback={null}>
                <SharedLayoutImporter />
              </Suspense>
            </BackgroundMountBoundary>
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

        <Header saveStatus={saveStatus} />

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
          <BackgroundMountBoundary mountName="SharedLayoutImporter">
            <Suspense fallback={null}>
              <SharedLayoutImporter />
            </Suspense>
          </BackgroundMountBoundary>
        )}
      </div>
    );
  })();

  return (
    <>
      {/* Visually hidden H1 so JS-rendered DOM has a top-level heading for
          crawlers and screen readers. The visible app shell doesn't carry an H1;
          the noscript fallback's H1 only renders when JS is disabled. The
          heading must mirror the route-aware title set above so Googlebot
          sees consistent <title> + <h1> signals and screen readers announce
          the correct page on /designer and /baseplate. */}
      <h1 className="sr-only">
        {isDesignerRoute
          ? t('seo.designer.title')
          : isBaseplateRoute
            ? t('seo.baseplate.title')
            : isSupportersRoute
              ? t('seo.supporters.title')
              : isCommunityRoute
                ? t('seo.community.title')
                : t('seo.h1')}
      </h1>
      <DesignStoreRegistration />
      <LinkedRiseRegistration />
      <BackgroundMountBoundary mountName="SyncSessionMount">
        <Suspense fallback={null}>
          <LazySyncSessionMount />
        </Suspense>
      </BackgroundMountBoundary>
      {routeContent}
      <ToastContainer />
      {binExampleGalleryOpen && (
        <Suspense fallback={null}>
          <DesignGalleryModal onClose={closeBinExampleGallery} />
        </Suspense>
      )}
      {whatsNewOpen && (
        <Suspense fallback={null}>
          <WhatsNewModal />
        </Suspense>
      )}
      {communityShowcaseEnabled && communityPublishOpen && (
        <Suspense fallback={null}>
          <CommunityPublishDialog />
        </Suspense>
      )}
      {!isMobile && commandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={(open: boolean) => {
              setCommandPaletteOpen(open);
              // Clear the initial query on close so the next ⌘K open
              // (which bypasses the event listener) doesn't see a stale value.
              if (!open) setCommandPaletteInitialQuery('');
            }}
            initialQuery={commandPaletteInitialQuery}
          />
        </Suspense>
      )}
      {isLabsDrawerOpen && (
        <Suspense fallback={null}>
          <LabsDrawer />
        </Suspense>
      )}
      {isHelpOpen && (
        <Suspense fallback={<LoadingFallback variant="overlay" label={t('loading.help')} />}>
          <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} isTablet={isTablet} />
        </Suspense>
      )}
      <GlobalSettingsModal />
    </>
  );
}
