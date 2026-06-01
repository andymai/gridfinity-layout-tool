/**
 * Bin Designer page layout.
 *
 * Three responsive layouts:
 * - Desktop (>=900px): Side panel (288px) + full 3D preview
 * - Tablet (768-899px): Stacked - 3D preview (50vh) + tabbed controls below
 * - Mobile (<768px): Stacked - 3D preview (40vh) + tabbed controls
 *
 * The useGeneration hook auto-generates mesh when parameters change.
 */

import { ExportDialog } from '@/features/bin-designer/components/ExportDialog';
import { DesignListDialog } from '@/features/bin-designer/components/DesignListDialog';
import { useGeneration } from '@/features/bin-designer/hooks/useGeneration';
import { useSyncPhysicalUnits } from '@/features/bin-designer/hooks/useSyncPhysicalUnits';
import { useDesignerInit } from '@/features/bin-designer/hooks/useDesignerInit';
import { useCreateFromBin } from '@/features/bin-designer/hooks/useCreateFromBin';
import { useAutoSave } from '@/features/bin-designer/hooks/useAutoSave';
import { useThumbnailCapture } from '@/features/bin-designer/hooks/useThumbnailCapture';
import { useDesignerUrlSync } from '@/features/bin-designer/hooks/useDesignerUrlSync';
import { useUnsavedWarning } from '@/features/bin-designer/hooks/useUnsavedWarning';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { DesignerHeader } from './DesignerHeader';
import { DesignerMainContent } from './DesignerMainContent';
import { MobileTitleBar } from './MobileTitleBar';
import { ShareLoadingBanner } from './ShareLoadingBanner';
import { useDesignNameEditor } from './useDesignNameEditor';
import { useShareLoading } from './useShareLoading';

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

  // Capture thumbnail after first mesh generation (for designs created from bins)
  useThumbnailCapture();

  // Sync URL <-> store (deep linking, back/forward navigation)
  useDesignerUrlSync();

  // Warn before closing tab with unsaved changes
  useUnsavedWarning();

  const { isDesktop, isMobile, isLandscape } = useResponsive();
  const cutoutEditorOpen = useDesignerStore((s) => s.ui.cutoutEditorOpen);
  const designListOpen = useDesignerStore((s) => s.ui.designListOpen);
  const setDesignListOpen = useDesignerStore((s) => s.setDesignListOpen);

  const nameEditor = useDesignNameEditor();
  const shareLoading = useShareLoading();

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Mobile title bar */}
      {!isDesktop && <MobileTitleBar />}

      {/* Header / Action bar */}
      <DesignerHeader isDesktop={isDesktop} nameEditor={nameEditor} />

      {/* Share loading banner */}
      {shareLoading && <ShareLoadingBanner />}

      {/* Main content - responsive layout */}
      <DesignerMainContent
        isDesktop={isDesktop}
        isMobile={isMobile}
        isLandscape={isLandscape}
        cutoutEditorOpen={cutoutEditorOpen}
      />

      {/* Modals */}
      <ExportDialog />
      <DesignListDialog open={designListOpen} onClose={() => setDesignListOpen(false)} />
    </div>
  );
}
