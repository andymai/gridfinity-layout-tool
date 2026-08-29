/**
 * Bin Designer page layout.
 *
 * Three responsive layouts:
 * - Desktop (>=900px): resizable rail-shell panel + full 3D preview
 * - Tablet (768-899px): stacked — 3D preview (50vh) + panel below
 * - Mobile (<768px): stacked — 3D preview (40vh) + panel below
 *
 * The useGeneration hook auto-generates mesh when parameters change.
 */

import { ExportDialog } from '@/features/bin-designer/components/ExportDialog';
import { VersionHistory } from '@/features/bin-designer/components/VersionHistory';
import { DesignListDialog } from '@/features/bin-designer/components/DesignListDialog';
import { useGeneration } from '@/features/bin-designer/hooks/useGeneration';
import { useSyncPhysicalUnits } from '@/features/bin-designer/hooks/useSyncPhysicalUnits';
import { useDesignerInit } from '@/features/bin-designer/hooks/useDesignerInit';
import { useCreateFromBin } from '@/features/bin-designer/hooks/useCreateFromBin';
import { useAutoSave } from '@/features/bin-designer/hooks/useAutoSave';
import { useImportedDesignAutoSave } from '@/features/bin-designer/hooks/useImportedDesignAutoSave';
import { useWorkshopAutoSave } from '@/features/bin-designer/hooks/useWorkshopAutoSave';
import { useToolRackMigration } from '@/features/bin-designer/hooks/useToolRackMigration';
import { useThumbnailCapture } from '@/features/bin-designer/hooks/useThumbnailCapture';
import { useDesignerUrlSync } from '@/features/bin-designer/hooks/useDesignerUrlSync';
import { useUnsavedWarning } from '@/features/bin-designer/hooks/useUnsavedWarning';
import { useBinDefaultCommandBridge } from '@/features/bin-designer/hooks/useBinDefaultCommandBridge';
import { useCommunityPublishLifecycle } from '@/features/bin-designer/hooks/useCommunityPublish';
import { useDesignerFirstRun } from '@/features/bin-designer/hooks/useDesignerFirstRun';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useEffect } from 'react';
import { DesignerHeader } from './DesignerHeader';
import { DesignerQuickstartCard } from './DesignerQuickstartCard';
import { DesignerMainContent } from './DesignerMainContent';
import { MobileTitleBar } from './MobileTitleBar';
import { ShareLoadingBanner } from './ShareLoadingBanner';
import { FractionalEdgeMismatchBanner } from './FractionalEdgeMismatchBanner';
import { RemixBanner } from './RemixBanner';
import { useDesignNameEditor } from './useDesignNameEditor';
import { useShareLoading } from './useShareLoading';
import { useFractionalEdgeMismatch } from './useFractionalEdgeMismatch';

/**
 * Designer page for creating, previewing, sharing, and exporting bin designs.
 *
 * Renders a responsive layout (desktop: side panel + preview; tablet/mobile: stacked preview + tabbed controls)
 * and the header actions and dialogs required to edit parameters, auto-generate meshes, autosave, share/load designs,
 * and open the export flow.
 */
export function DesignerPage() {
  // Initialize designer - ensures we always have an active design
  // Must be called before useAutoSave to set currentDesignId
  useDesignerInit();

  // Handle createFrom=bin URL params (must run after init, before generation)
  useCreateFromBin();

  // Sync physical units (gridUnitMm, heightUnitMm) from layout store into designer params
  useSyncPhysicalUnits();

  // Initialize generation bridge - auto-generates mesh when params change
  useGeneration();

  // Auto-save params to IndexedDB (debounced 1s)
  useAutoSave();

  // Auto-save for imported-mesh designs (footprint edits + one-time thumbnail)
  useImportedDesignAutoSave();
  useWorkshopAutoSave();
  useToolRackMigration();

  // Capture thumbnail after first mesh generation (for designs created from bins)
  useThumbnailCapture();

  // Sync URL <-> store (deep linking, back/forward navigation)
  useDesignerUrlSync();

  // Warn before closing tab with unsaved changes
  useUnsavedWarning();

  // Bridge command-palette "bin default" commands (window events) to actions
  useBinDefaultCommandBridge();

  // Community publish: recapture assets while the dialog waits, resume after OAuth
  useCommunityPublishLifecycle();

  const { isDesktop, isMobile, isLandscape } = useResponsive();
  // Resolved against the style for the same reason the interior card is: the
  // bin's cutouts are only built on a solid body, so an undo that walks the
  // style back while the workspace is open leaves the user drawing pockets
  // into a hollow bin that the generator will not cut. The lid's cutouts are a
  // separate array with no such dependency. The flag itself is left alone, so
  // redoing the style brings the workspace back.
  const cutoutEditorOpen = useDesignerStore(
    (s) => s.ui.cutoutEditorOpen && (s.ui.cutoutTarget === 'lid' || s.params.style === 'solid')
  );
  const bentoWorkspaceOpen = useDesignerStore((s) => s.ui.bentoWorkspaceOpen);
  const designListOpen = useDesignerStore((s) => s.ui.designListOpen);
  const versionsOpen = useDesignerStore((s) => s.ui.versionsOpen);
  const setVersionsOpen = useDesignerStore((s) => s.setVersionsOpen);
  const setDesignListOpen = useDesignerStore((s) => s.setDesignListOpen);

  const nameEditor = useDesignNameEditor();
  const shareLoading = useShareLoading();
  const fractionalEdge = useFractionalEdgeMismatch();

  const { shouldShowQuickstart, markQuickstartSeen } = useDesignerFirstRun();
  const hasEdited = useDesignerStore((s) => s.history.past.length > 0);

  // First edit is proof the user doesn't need orientation anymore. Mobile
  // never renders the card, so edits there must not consume the flag or
  // emit a dismissal for UI that was never shown.
  useEffect(() => {
    if (shouldShowQuickstart && hasEdited && !isMobile) {
      markQuickstartSeen('first_edit');
    }
  }, [shouldShowQuickstart, hasEdited, isMobile, markQuickstartSeen]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-surface">
      {!isDesktop && <MobileTitleBar />}

      {/* Header / Action bar */}
      <DesignerHeader isDesktop={isDesktop} nameEditor={nameEditor} />

      {shareLoading && <ShareLoadingBanner />}

      {/* Drawer edge-orientation mismatch warning */}
      {fractionalEdge.show && (
        <FractionalEdgeMismatchBanner
          onMatchDrawer={fractionalEdge.matchDrawer}
          blocksSeating={fractionalEdge.blocksSeating}
        />
      )}

      {/* Post-remix continuation banner (renders null unless the design has lineage) */}
      <RemixBanner />

      {/* Main content - responsive layout */}
      <DesignerMainContent
        isDesktop={isDesktop}
        isMobile={isMobile}
        isLandscape={isLandscape}
        cutoutEditorOpen={cutoutEditorOpen}
        bentoWorkspaceOpen={bentoWorkspaceOpen}
      />

      {/* First-run orientation card (desktop/tablet — mobile has no room for it) */}
      {shouldShowQuickstart && !isMobile && (
        <DesignerQuickstartCard onDismiss={markQuickstartSeen} />
      )}

      {/* Modals */}
      <ExportDialog />
      <DesignListDialog open={designListOpen} onClose={() => setDesignListOpen(false)} />
      <VersionHistory open={versionsOpen} onClose={() => setVersionsOpen(false)} />
    </div>
  );
}
