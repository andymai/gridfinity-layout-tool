/**
 * Parameter panel for the bin designer.
 *
 * Scrollable container composing collapsible sections for all bin parameters,
 * organized into three groups: Shape, Interior, and Base.
 *
 * Groups:
 * - Shape: Dimensions, Split Options (conditional), Walls
 * - Interior: Interior Dividers, Label Tabs, Finger Scoop
 * - Base: Base attachments, Physical Units
 */

import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/design-system';
import { DimensionsSection } from '../panel/DimensionsSection';
import { ShapeSection } from '../panel/ShapeSection';
import { InteriorSection } from '../panel/InteriorSection';
import { BaseSection } from '../panel/BaseSection';
import { LabelTabsSection } from '../panel/LabelTabsSection';
import { ScoopSection } from '../panel/ScoopSection';
import { WallsSection } from '../panel/WallsSection';
import { OverhangSection } from '../panel/OverhangSection';
import { LidSection } from '../panel/LidSection';
import { PhysicalUnitsSection } from '../panel/PhysicalUnitsSection';
import { SplitOptionsSection } from '../panel/SplitOptionsSection';
import { StickyGroupHeader } from '../panel/StickyGroupHeader';
import { PanelSection } from '../panel/PanelSection';
import { ColorsSection } from '../panel/ColorsSection';
import { FeatureGate } from '../panel/FeatureGate';
import { SetDefaultFooter } from '../panel/SetDefaultFooter';
import { useShapeGroupSummary } from './useShapeGroupSummary';
import { useInteriorGroupSummary } from './useInteriorGroupSummary';
import { useBaseGroupSummary } from './useBaseGroupSummary';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useBinExampleGalleryStore } from '@/core/store/binExampleGallery';
import { useSplitOptionsSection } from '../panel/SplitOptionsSection/useSplitOptionsSection';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { isPartialMask } from '@/shared/utils/cellMask';
import { UserDock } from '@/shared/components/UserDock';
import { AttributionFooter } from '@/shared/components/AttributionFooter';
import { helpJumpEventName } from '@/shared/help/helpJumpDispatcher';
import { ToolRackParameterPanel } from '../panel/ToolRackSection/ToolRackParameterPanel';
import { ImportedMeshPanel } from '../panel/ImportedMeshSection/ImportedMeshPanel';

export function ParameterPanel() {
  const itemKind = useDesignerStore((s) => s.itemKind);
  if (itemKind === 'toolRack') return <ToolRackParameterPanel />;
  if (itemKind === 'importedMesh') return <ImportedMeshPanel />;
  return <BinParameterPanel />;
}

function BinParameterPanel() {
  const t = useTranslation();
  const shapeSummary = useShapeGroupSummary();
  const interiorSummary = useInteriorGroupSummary();
  const baseSummary = useBaseGroupSummary();
  const { showLabelTabs, isCustomShape } = useDesignerStore(
    useShallow((s) => ({
      showLabelTabs: s.params.style === 'standard',
      isCustomShape: isPartialMask(s.params.cellMask),
    }))
  );
  const { needsSplit } = useSplitOptionsSection();
  const openExampleGallery = useBinExampleGalleryStore((s) => s.open);
  const cloudSyncEnabled = useFeatureFlag('cloud_sync');
  const itemKindsEnabled = useFeatureFlag('item_kinds');
  const newDesign = useDesignerStore((s) => s.newDesign);
  const customShapeReason = t('binDesigner.shape.custom.hint');

  // Group expansion state — controlled so help-modal deep-links can force a
  // section open before the dispatcher scrolls and pulses its target.
  const [shapeExpanded, setShapeExpanded] = useState(true);
  const [interiorExpanded, setInteriorExpanded] = useState(true);
  const [baseExpanded, setBaseExpanded] = useState(true);

  useEffect(() => {
    const handlers: Record<string, () => void> = {
      [helpJumpEventName('binDesigner:shape')]: () => setShapeExpanded(true),
      [helpJumpEventName('binDesigner:interior')]: () => setInteriorExpanded(true),
      [helpJumpEventName('binDesigner:base')]: () => setBaseExpanded(true),
    };
    for (const [name, fn] of Object.entries(handlers)) {
      window.addEventListener(name, fn);
    }
    return () => {
      for (const [name, fn] of Object.entries(handlers)) {
        window.removeEventListener(name, fn);
      }
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* `relative` makes this the containing block for `sr-only` (position:absolute)
          toggle inputs inside; without it their CB is the ICB, so their static
          position deep in the scroll area extends the document and lets the whole
          page scroll into blank space below the panel. */}
      <div className="relative flex-1 overflow-y-scroll scrollbar-thin">
        {/* Shape group */}
        <StickyGroupHeader
          title={t('binDesigner.group.shape')}
          expanded={shapeExpanded}
          onExpandedChange={setShapeExpanded}
          summary={shapeSummary}
        >
          <div className="divide-y divide-stroke-subtle/50">
            <PanelSection helpTarget="bd-dimensions">
              <DimensionsSection />
            </PanelSection>
            <PanelSection helpTarget="bd-overhang">
              {/* Advanced drawer-fit control next to the dimensions; collapsed by
                  default and gated off internally for custom-shape (mask) bins. */}
              <OverhangSection />
            </PanelSection>
            <PanelSection helpTarget="bd-shape">
              <ShapeSection />
            </PanelSection>
            {needsSplit && (
              <PanelSection>
                {/* Splits work for any footprint — axis-aligned cut planes
                    intersect the polygon naturally. Pieces may be irregular
                    but each has positive volume; tested in the polygon
                    scenario suite. */}
                <SplitOptionsSection />
              </PanelSection>
            )}
            <PanelSection helpTarget="bd-walls">
              <WallsSection />
              <div data-help-target="bd-lid" className="mt-4">
                <LidSection />
              </div>
            </PanelSection>
          </div>
        </StickyGroupHeader>

        {/* Interior group */}
        <StickyGroupHeader
          title={t('binDesigner.group.interior')}
          expanded={interiorExpanded}
          onExpandedChange={setInteriorExpanded}
          summary={interiorSummary}
        >
          <div className="divide-y divide-stroke-subtle/50">
            <PanelSection helpTarget="bd-interior">
              {/* Per-mode gating lives inside InteriorSection: Solid (cutouts) stays
                  interactive on custom shapes; Standard/Slotted remain gated. */}
              <InteriorSection />
            </PanelSection>
            {showLabelTabs && (
              <PanelSection helpTarget="bd-label-tabs">
                <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
                  <LabelTabsSection />
                </FeatureGate>
              </PanelSection>
            )}
            <PanelSection helpTarget="bd-scoop">
              <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
                <ScoopSection />
              </FeatureGate>
            </PanelSection>
          </div>
        </StickyGroupHeader>

        {/* Base group */}
        <StickyGroupHeader
          title={t('binDesigner.group.base')}
          expanded={baseExpanded}
          onExpandedChange={setBaseExpanded}
          summary={baseSummary}
        >
          <div className="divide-y divide-stroke-subtle/50">
            <PanelSection helpTarget="bd-base">
              <BaseSection />
            </PanelSection>
            <PanelSection helpTarget="bd-colors">
              <ColorsSection />
            </PanelSection>
            <PanelSection helpTarget="bd-physical-units">
              <PhysicalUnitsSection />
            </PanelSection>
          </div>
        </StickyGroupHeader>

        {/* Design Showcase entry — opens the bin-example gallery (below Physical Units) */}
        <div className="px-4 py-3 border-b border-stroke-subtle">
          <Button
            variant="ghost"
            onClick={openExampleGallery}
            className="w-full flex items-center gap-3 text-left p-3 rounded-lg bg-gradient-to-r from-accent/10 to-info/10 hover:from-accent/20 hover:to-info/20 border border-accent/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <svg
                className="w-5 h-5 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-content">
                {t('binExamples.sidebarEntry')}
              </div>
              <div className="text-xs text-content-tertiary">{t('binExamples.sidebarHint')}</div>
            </div>
            <svg
              className="w-4 h-4 text-content-tertiary group-hover:translate-x-0.5 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>

        {itemKindsEnabled && (
          <div className="px-4 py-3 border-b border-stroke-subtle">
            <Button variant="secondary" onClick={() => newDesign('toolRack')} className="w-full">
              {t('binDesigner.newToolRack')}
            </Button>
          </div>
        )}

        {/* Capture the current settings as the default for new bins, right
            where the user has been editing them. */}
        <SetDefaultFooter />

        <AttributionFooter />
      </div>
      {cloudSyncEnabled && <UserDock />}
    </div>
  );
}
