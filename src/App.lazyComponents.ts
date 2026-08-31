import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';

// Route-, modal- and mount-level components App loads lazily so their chunks
// stay off the first-paint path.
export const LazySyncSessionMount = lazyWithRetry(() =>
  import('@/shared/sync/SyncSessionMount').then(namedExport('SyncSessionMount'))
);

export const CommandPalette = lazyWithRetry(() =>
  import('@/features/command-palette/components/CommandPalette').then(namedExport('CommandPalette'))
);
export const DesignLinkingDialogs = lazyWithRetry(() =>
  import('@/features/design-linking/components/DesignLinkingDialogs').then(
    namedExport('DesignLinkingDialogs')
  )
);
export const SharedLayoutImporter = lazyWithRetry(() =>
  import('@/features/cloud-share/components/SharedLayoutImporter').then(
    namedExport('SharedLayoutImporter')
  )
);
export const SharedLayoutBanner = lazyWithRetry(() =>
  import('@/features/cloud-share/components/SharedLayoutBanner').then(
    namedExport('SharedLayoutBanner')
  )
);
export const LabsDrawer = lazyWithRetry(() =>
  import('@/features/labs/components/LabsDrawer').then(namedExport('LabsDrawer'))
);
export const DesignerPage = lazyWithRetry(() =>
  import('@/features/bin-designer/components/DesignerPage').then(namedExport('DesignerPage'))
);
export const BaseplatePage = lazyWithRetry(() =>
  import('@/features/baseplate').then(namedExport('BaseplatePage'))
);
export const BaseplateLibraryInitMount = lazyWithRetry(() =>
  import('@/features/baseplate/components/BaseplateLibraryInitMount').then(
    namedExport('BaseplateLibraryInitMount')
  )
);
export const SupportersPage = lazyWithRetry(() =>
  import('@/features/supporters').then(namedExport('SupportersPage'))
);
export const CommunityPage = lazyWithRetry(() =>
  import('@/features/community').then(namedExport('CommunityPage'))
);
// Dev-only: pre-renders one gallery example for the thumbnail generator.
// Inert in production via the `import.meta.env.DEV` gate at the route below.
export const DevThumbnailRoute = lazyWithRetry(() =>
  import('@/features/bin-designer/components/DevThumbnailRoute').then(
    namedExport('DevThumbnailRoute')
  )
);
export const HelpModal = lazyWithRetry(() =>
  import('@/shell/Modals/HelpModal').then(namedExport('HelpModal'))
);
export const MobileLayout = lazyWithRetry(() =>
  import('@/shell/layouts/MobileLayout').then(namedExport('MobileLayout'))
);
export const CollabProvider = lazyWithRetry(() =>
  import('@/shell/Collab/CollabProvider').then(namedExport('CollabProvider'))
);
export const WhatsNewModal = lazyWithRetry(() =>
  import('@/shell/Modals/WhatsNewModal').then(namedExport('WhatsNewModal'))
);
export const DesignGalleryModal = lazyWithRetry(() =>
  import('@/shell/Modals/DesignGalleryModal').then(namedExport('DesignGalleryModal'))
);
export const CommunityPublishDialog = lazyWithRetry(() =>
  import('@/features/community/components/PublishDialog').then(namedExport('PublishDialog'))
);
