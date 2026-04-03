/**
 * Responsive main content area for the bin designer.
 *
 * Switches between four layouts:
 * - Desktop + cutout editor: CutoutWorkspace | ResizeDivider | PreviewCanvas
 * - Desktop: ParameterPanel (w-72) | PreviewCanvas
 * - Landscape tablet/mobile: PreviewCanvas | ParameterPanel (w-64)
 * - Portrait tablet/mobile: PreviewCanvas (40-50vh) / ParameterPanel
 */

import { useState } from 'react';
import { ParameterPanel } from '@/features/bin-designer/components/ParameterPanel';
import { PreviewCanvas } from '@/features/bin-designer/components/PreviewCanvas';
import { CutoutWorkspace } from '@/features/bin-designer/components/CutoutWorkspace';
import { ResizeDivider } from '@/features/bin-designer/components/CutoutWorkspace/ResizeDivider';
import { loadSplitRatio } from '@/features/bin-designer/components/CutoutWorkspace/splitRatioStorage';
import { CutoutDesktopOnlyBanner } from './CutoutDesktopOnlyBanner';
import { ExperimentalKernelBadge } from '@/shared/components/ExperimentalKernelBadge';

interface DesignerMainContentProps {
  isDesktop: boolean;
  isMobile: boolean;
  isLandscape: boolean;
  cutoutEditorOpen: boolean;
}

export function DesignerMainContent({
  isDesktop,
  isMobile,
  isLandscape,
  cutoutEditorOpen,
}: DesignerMainContentProps) {
  const [splitRatio, setSplitRatio] = useState(loadSplitRatio);

  if (isDesktop && cutoutEditorOpen) {
    /* Desktop: cutout workspace + resizable divider + 3D preview */
    return (
      <main className="flex flex-1 overflow-hidden">
        <div className="overflow-hidden" style={{ width: `${splitRatio * 100}%` }}>
          <CutoutWorkspace />
        </div>
        <ResizeDivider ratio={splitRatio} onRatioChange={setSplitRatio} />
        <div className="relative flex-1 overflow-hidden">
          <PreviewCanvas />
          <ExperimentalKernelBadge />
        </div>
      </main>
    );
  }

  if (isDesktop) {
    /* Desktop: side-by-side */
    return (
      <main className="flex flex-1 overflow-hidden">
        <div className="w-72 flex-shrink-0 overflow-hidden border-r border-stroke-subtle bg-surface-secondary">
          <ParameterPanel />
        </div>
        <div className="relative flex-1 overflow-hidden">
          <PreviewCanvas />
          <ExperimentalKernelBadge />
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
