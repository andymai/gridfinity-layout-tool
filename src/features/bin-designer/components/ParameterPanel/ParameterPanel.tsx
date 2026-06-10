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
import { ColorsSection } from '../panel/ColorsSection';
import { FeatureGate } from '../panel/FeatureGate';
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

export function ParameterPanel() {
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
  const customShapeReason = t('binDesigner.shape.custom.hint');

  // Group expansion state — controlled so help-modal deep-links can force a
  // section open before the dispatcher scrolls and pulses its target.
  const [shapeExpanded, setShapeExpanded] = useState(true);
  const [colorsExpanded, setColorsExpanded] = useState(true);
  const [interiorExpanded, setInteriorExpanded] = useState(true);
  const [baseExpanded, setBaseExpanded] = useState(true);

  useEffect(() => {
    const handlers: Record<string, () => void> = {
      [helpJumpEventName('binDesigner:shape')]: () => setShapeExpanded(true),
      [helpJumpEventName('binDesigner:colors')]: () => setColorsExpanded(true),
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
      <div className="flex-1 overflow-y-scroll scrollbar-thin">
        {/* Shape group */}
        <StickyGroupHeader
          title={t('binDesigner.group.shape')}
          expanded={shapeExpanded}
          onExpandedChange={setShapeExpanded}
          summary={shapeSummary}
        >
          <div
            data-help-target="bd-dimensions"
            className="px-4 py-4 border-b border-stroke-subtle/50"
          >
            <DimensionsSection />
          </div>
          <div
            data-help-target="bd-overhang"
            className="px-4 py-4 border-b border-stroke-subtle/50"
          >
            {/* Advanced drawer-fit control next to the dimensions; collapsed by
                default and gated off internally for custom-shape (mask) bins. */}
            <OverhangSection />
          </div>
          <div data-help-target="bd-shape" className="px-4 py-4 border-b border-stroke-subtle/50">
            <ShapeSection />
          </div>
          {needsSplit && (
            <div className="px-4 py-4 border-b border-stroke-subtle/50">
              {/* Splits work for any footprint — axis-aligned cut planes
                  intersect the polygon naturally. Pieces may be irregular
                  but each has positive volume; tested in the polygon
                  scenario suite. */}
              <SplitOptionsSection />
            </div>
          )}
          <div data-help-target="bd-walls" className="px-4 py-4 border-b border-stroke-subtle/50">
            {/* Wall thickness works for any footprint; pattern/cutouts/handle
                gate themselves inside WallsSection. */}
            <WallsSection />
          </div>
          <div data-help-target="bd-lid" className="px-4 py-4">
            {/* Lid is a companion piece auto-fit to the bin's lip. Internally
                gated when params.base.stackingLip is off (lid mates with lip). */}
            <LidSection />
          </div>
        </StickyGroupHeader>

        {/* Multi-Color group — between Shape and Interior */}
        <StickyGroupHeader
          title={t('binDesigner.group.colors')}
          expanded={colorsExpanded}
          onExpandedChange={setColorsExpanded}
          badge={t('binDesigner.multiColor.experimental')}
        >
          <div data-help-target="bd-colors" className="px-4 py-4">
            <ColorsSection />
          </div>
        </StickyGroupHeader>

        {/* Interior group */}
        <StickyGroupHeader
          title={t('binDesigner.group.interior')}
          expanded={interiorExpanded}
          onExpandedChange={setInteriorExpanded}
          summary={interiorSummary}
        >
          <div data-help-target="bd-interior" className="px-4 py-4">
            {/* Per-mode gating lives inside InteriorSection: Solid (cutouts) stays
                interactive on custom shapes; Standard/Slotted remain gated. */}
            <InteriorSection />
          </div>
          {showLabelTabs && (
            <div
              data-help-target="bd-label-tabs"
              className="px-4 py-4 border-t border-stroke-subtle/50"
            >
              <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
                <LabelTabsSection />
              </FeatureGate>
            </div>
          )}
          <div data-help-target="bd-scoop" className="px-4 py-4 border-t border-stroke-subtle/50">
            <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
              <ScoopSection />
            </FeatureGate>
          </div>
        </StickyGroupHeader>

        {/* Base group */}
        <StickyGroupHeader
          title={t('binDesigner.group.base')}
          expanded={baseExpanded}
          onExpandedChange={setBaseExpanded}
          summary={baseSummary}
        >
          <div data-help-target="bd-base" className="px-4 py-4 border-b border-stroke-subtle/50">
            <BaseSection />
          </div>
          <div data-help-target="bd-physical-units" className="px-4 py-4">
            <PhysicalUnitsSection />
          </div>
        </StickyGroupHeader>

        {/* Design Showcase entry — opens the bin-example gallery (below Physical Units) */}
        <div className="px-4 py-4 border-b border-stroke-subtle">
          <button
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
          </button>
        </div>

        <AttributionFooter />
      </div>
      {cloudSyncEnabled && <UserDock />}
    </div>
  );
}
