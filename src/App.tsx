import { useEffect, useLayoutEffect, useState, useCallback, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
import { downloadLayoutAsFile, reconcileLibraryAsync } from '@/core/storage';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
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
import { useCommunityPublishReturn } from '@/shared/hooks/useCommunityPublishReturn';
import { useCommunityLikeReturn } from '@/shared/hooks/useCommunityLikeReturn';
import { useCommunityDigestCheck } from '@/shared/hooks/useCommunityDigestCheck';
import { SHORTCUTS } from '@/core/constants';

// Lazy-loaded so the sync chunk stays off the first-paint path.
const LazySyncSessionMount = lazyWithRetry(() =>
  import('@/shared/sync/SyncSessionMount').then(namedExport('SyncSessionMount'))
);

const CommandPalette = lazyWithRetry(() =>
  import('@/features/command-palette/components/CommandPalette').then(namedExport('CommandPalette'))
);
const DesignLinkingDialogs = lazyWithRetry(() =>
  import('@/features/design-linking/components/DesignLinkingDialogs').then(
    namedExport('DesignLinkingDialogs')
  )
);
const SharedLayoutImporter = lazyWithRetry(() =>
  import('@/features/cloud-share/components/SharedLayoutImporter').then(
    namedExport('SharedLayoutImporter')
  )
);
const SharedLayoutBanner = lazyWithRetry(() =>
  import('@/features/cloud-share/components/SharedLayoutBanner').then(
    namedExport('SharedLayoutBanner')
  )
);
const LabsDrawer = lazyWithRetry(() =>
  import('@/features/labs/components/LabsDrawer').then(namedExport('LabsDrawer'))
);
const DesignerPage = lazyWithRetry(() =>
  import('@/features/bin-designer/components/DesignerPage').then(namedExport('DesignerPage'))
);
const BaseplatePage = lazyWithRetry(() =>
  import('@/features/baseplate').then(namedExport('BaseplatePage'))
);
const BaseplateLibraryInitMount = lazyWithRetry(() =>
  import('@/features/baseplate/components/BaseplateLibraryInitMount').then(
    namedExport('BaseplateLibraryInitMount')
  )
);
const SupportersPage = lazyWithRetry(() =>
  import('@/features/supporters').then(namedExport('SupportersPage'))
);
const CommunityPage = lazyWithRetry(() =>
  import('@/features/community').then(namedExport('CommunityPage'))
);
// Dev-only: pre-renders one gallery example for the thumbnail generator.
// Inert in production via the `import.meta.env.DEV` gate at the route below.
const DevThumbnailRoute = lazyWithRetry(() =>
  import('@/features/bin-designer/components/DevThumbnailRoute').then(
    namedExport('DevThumbnailRoute')
  )
);
const HelpModal = lazyWithRetry(() =>
  import('@/shell/Modals/HelpModal').then(namedExport('HelpModal'))
);
const MobileLayout = lazyWithRetry(() =>
  import('@/shell/layouts/MobileLayout').then(namedExport('MobileLayout'))
);
const CollabProvider = lazyWithRetry(() =>
  import('@/shell/Collab/CollabProvider').then(namedExport('CollabProvider'))
);
const WhatsNewModal = lazyWithRetry(() =>
  import('@/shell/Modals/WhatsNewModal').then(namedExport('WhatsNewModal'))
);
const DesignGalleryModal = lazyWithRetry(() =>
  import('@/shell/Modals/DesignGalleryModal').then(namedExport('DesignGalleryModal'))
);
const CommunityPublishDialog = lazyWithRetry(() =>
  import('@/features/community/components/PublishDialog').then(namedExport('PublishDialog'))
);

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

  // Allow external surfaces (e.g. HelpModal's empty-state fall-through) to open
  // the command palette pre-filled with a query via a window event — matches
  // the existing `open-settings-modal` / `switch-to-designer` dispatch pattern.
  useEffect(() => {
    const handler = (e: CustomEvent<{ query?: string }>) => {
      setCommandPaletteInitialQuery(e.detail.query ?? '');
      setCommandPaletteOpen(true);
    };
    window.addEventListener('open-command-palette', handler as EventListener);
    return () => window.removeEventListener('open-command-palette', handler as EventListener);
  }, [setCommandPaletteOpen]);

  // Navigate to the /supporters page from the command palette (matches the
  // `switch-to-designer` window-event pattern for cross-tree navigation).
  useEffect(() => {
    const handler = () => navigateToSupporters();
    window.addEventListener('view-supporters', handler);
    return () => window.removeEventListener('view-supporters', handler);
  }, [navigateToSupporters]);

  // Route-aware SEO meta. Owns title/description across SPA navigation: the
  // i18n context only re-fires on locale change, so without this an in-app
  // jump from /designer back to / would leave the generator title up. We
  // always resolve to *some* route-appropriate value (homepage, designer, or
  // baseplate) — no early return — so back-navigation restores the homepage
  // meta. Depends on `t` so it re-applies when locale flips mid-session.
  useEffect(() => {
    // On /community/d/<id> the meta in the document is the design's own, served
    // by api/community/page.ts. Overwriting it with the gallery's generic title
    // would give every design page the same title in the rendered DOM, which is
    // what Google indexes — so the route could not be indexed at all. The server
    // value is authoritative here; leave it alone.
    //
    // Gated on isCommunityRoute as well: the design id comes straight off the
    // URL and is not flag-aware, so with community_showcase off this route falls
    // through to the planner, and skipping the swap would leave a design's title
    // over the planner UI.
    if (isCommunityRoute && communityDesignIdFromUrl !== null) return;
    const titleKey = isDesignerRoute
      ? 'seo.designer.title'
      : isBaseplateRoute
        ? 'seo.baseplate.title'
        : isSupportersRoute
          ? 'seo.supporters.title'
          : isCommunityRoute
            ? 'seo.community.title'
            : 'seo.title';
    const descKey = isDesignerRoute
      ? 'seo.designer.description'
      : isBaseplateRoute
        ? 'seo.baseplate.description'
        : isSupportersRoute
          ? 'seo.supporters.description'
          : isCommunityRoute
            ? 'seo.community.description'
            : 'seo.description';
    const title = t(titleKey);
    const desc = t(descKey);
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', desc);
  }, [
    isDesignerRoute,
    isBaseplateRoute,
    isSupportersRoute,
    isCommunityRoute,
    communityDesignIdFromUrl,
    t,
  ]);
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
    </>
  );
}
