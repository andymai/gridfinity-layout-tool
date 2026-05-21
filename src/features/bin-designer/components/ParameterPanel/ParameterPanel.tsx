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
import { AngledDividersSection } from '../panel/AngledDividersSection';
import { BaseSection } from '../panel/BaseSection';
import { LabelTabsSection } from '../panel/LabelTabsSection';
import { ScoopSection } from '../panel/ScoopSection';
import { WallsSection } from '../panel/WallsSection';
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
import { useSplitOptionsSection } from '../panel/SplitOptionsSection/useSplitOptionsSection';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { isPartialMask } from '@/shared/utils/cellMask';
import { UserDock } from '@/shared/components/UserDock';
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
          <div
            data-help-target="bd-angled-dividers"
            className="px-4 py-4 border-t border-stroke-subtle/50"
          >
            <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
              <AngledDividersSection />
            </FeatureGate>
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

        {/* Attribution */}
        <div className="px-4 py-4 text-content-disabled text-[10px] leading-relaxed">
          {t('sidebar.gridfinityBy')}{' '}
          <a
            href="https://www.youtube.com/c/ZackFreedman"
            target="_blank"
            rel="noopener noreferrer"
            className="text-content-tertiary hover:underline"
          >
            Zack Freedman
          </a>
          <br />
          {t('sidebar.toolBy')}{' '}
          <a
            href="https://www.linkedin.com/in/andyhmai/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-content-tertiary hover:underline"
          >
            Andy Aragon
          </a>{' '}
          ·{' '}
          <a
            href="https://ko-fi.com/andyaragon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            <svg
              className="w-3 h-3 inline-block align-text-bottom mr-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            {t('sidebar.tip')}
          </a>
        </div>
      </div>
      {cloudSyncEnabled && <UserDock />}
    </div>
  );
}
