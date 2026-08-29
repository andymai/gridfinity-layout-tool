/**
 * Responsive main content area for the bin designer.
 *
 * Switches between four layouts:
 * - Desktop + cutout editor: CutoutWorkspace | ResizeDivider | PreviewCanvas
 * - Desktop: ParameterPanel (resizable dock) | PreviewCanvas
 * - Landscape tablet/mobile: PreviewCanvas | ParameterPanel (w-64)
 * - Portrait tablet/mobile: PreviewCanvas (40-50vh) / ParameterPanel
 */

import { useState } from 'react';
import { ParameterPanel } from '@/features/bin-designer/components/ParameterPanel';
import { PreviewCanvas } from '@/features/bin-designer/components/PreviewCanvas';
import { CutoutWorkspace } from '@/features/bin-designer/components/CutoutWorkspace';
import { BentoWorkspace } from '@/features/bin-designer/components/BentoWorkspace';
import { ResizeDivider } from '@/features/bin-designer/components/CutoutWorkspace/ResizeDivider';
import { loadSplitRatio } from '@/features/bin-designer/components/CutoutWorkspace/splitRatioStorage';
import { CutoutDesktopOnlyBanner } from './CutoutDesktopOnlyBanner';
import { ExperimentalKernelBadge } from '@/shared/components/ExperimentalKernelBadge';
import { PerfOverlay } from '@/features/bin-designer/components/PerfOverlay';
import { VariantLock } from '@/features/bin-designer/components/panel/VariantSection/VariantLock';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useVariantContext } from '@/features/bin-designer/hooks/useVariantContext';
import { openParentDesign } from '@/features/bin-designer/utils/openParentDesign';

interface DesignerMainContentProps {
  isDesktop: boolean;
  isMobile: boolean;
  isLandscape: boolean;
  cutoutEditorOpen: boolean;
  bentoWorkspaceOpen: boolean;
}

export function DesignerMainContent({
  isDesktop,
  isMobile,
  isLandscape,
  cutoutEditorOpen,
  bentoWorkspaceOpen,
}: DesignerMainContentProps) {
  const [splitRatio, setSplitRatio] = useState(loadSplitRatio);
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const variant = useVariantContext(currentDesignId);

  // Both workspaces replace the sidebar and share the split ratio, so they
  // render through one branch. The store keeps the two flags mutually
  // exclusive; this only has to pick which one to draw.
  //
  // Locked for a variant for the same reason the parameter panel is: these
  // edit the same `params`, which the next propagation rewrites. Guarding only
  // the panel left the whole cutout and bento surface free to make edits that
  // were then discarded without a word.
  const workspace = cutoutEditorOpen ? (
    <VariantLock
      locked={variant.isVariant || variant.isLoading}
      parentName={variant.parentName}
      onOpenParent={variant.parentId ? () => void openParentDesign(variant.parentId) : undefined}
      fill
    >
      <CutoutWorkspace />
    </VariantLock>
  ) : bentoWorkspaceOpen ? (
    <VariantLock
      locked={variant.isVariant || variant.isLoading}
      parentName={variant.parentName}
      onOpenParent={variant.parentId ? () => void openParentDesign(variant.parentId) : undefined}
      fill
    >
      <BentoWorkspace />
    </VariantLock>
  ) : null;

  if (isDesktop && workspace) {
    /* Desktop: workspace + resizable divider + 3D preview */
    return (
      <main className="flex flex-1 overflow-hidden">
        <div className="overflow-hidden" style={{ width: `${splitRatio * 100}%` }}>
          {workspace}
        </div>
        <ResizeDivider ratio={splitRatio} onRatioChange={setSplitRatio} />
        <div className="relative flex-1 overflow-hidden">
          <PreviewCanvas />
          <ExperimentalKernelBadge />
          <PerfOverlay />
        </div>
      </main>
    );
  }

  if (isDesktop) {
    /* Desktop: side-by-side */
    return (
      <main className="flex flex-1 overflow-hidden">
        <ParameterPanel frame="docked" />
        <div className="relative flex-1 overflow-hidden">
          <PreviewCanvas />
          <ExperimentalKernelBadge />
          <PerfOverlay />
        </div>
      </main>
    );
  }

  if (isLandscape) {
    /* Landscape tablet/mobile: side-by-side */
    return (
      <main className="flex flex-1 flex-col overflow-hidden">
        {cutoutEditorOpen && <CutoutDesktopOnlyBanner />}
        <div className="flex flex-1 overflow-hidden">
          <div className="relative flex-1">
            <PreviewCanvas />
            <ExperimentalKernelBadge />
          </div>
          <div className="w-64 flex-shrink-0 overflow-hidden border-l border-stroke-subtle bg-surface-secondary">
            <ParameterPanel />
          </div>
        </div>
      </main>
    );
  }

  /* Tablet/Mobile: stacked */
  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      {cutoutEditorOpen && <CutoutDesktopOnlyBanner />}

      {/* 3D preview area - taller on tablet, shorter on mobile */}
      <div
        className="relative flex-shrink-0 border-b border-stroke-subtle"
        style={{ height: isMobile ? '40vh' : '50vh' }}
      >
        <PreviewCanvas />
        <ExperimentalKernelBadge />
      </div>

      {/* Parameter panel */}
      <div className="flex-1 overflow-hidden bg-surface-secondary">
        <ParameterPanel />
      </div>
    </main>
  );
}
