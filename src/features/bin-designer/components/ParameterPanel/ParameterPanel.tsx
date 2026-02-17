/**
 * Parameter panel for the bin designer.
 *
 * Scrollable container composing collapsible sections for all bin parameters,
 * organized into three groups: Shape, Interior, and Base.
 *
 * Groups:
 * - Shape: Dimensions, Walls
 * - Interior: Interior Dividers, Label Tabs, Finger Scoop
 * - Base: Base attachments, Physical Units
 */

import { useShallow } from 'zustand/react/shallow';
import { DimensionsSection } from '../panel/DimensionsSection';
import { InteriorSection } from '../panel/InteriorSection';
import { BaseSection } from '../panel/BaseSection';
import { LabelTabsSection } from '../panel/LabelTabsSection';
import { ScoopSection } from '../panel/ScoopSection';
import { WallsSection } from '../panel/WallsSection';
import { PhysicalUnitsSection } from '../panel/PhysicalUnitsSection';
import { StickyGroupHeader } from '../panel/StickyGroupHeader';
import { useShapeGroupSummary } from './useShapeGroupSummary';
import { useInteriorGroupSummary } from './useInteriorGroupSummary';
import { useBaseGroupSummary } from './useBaseGroupSummary';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';

export function ParameterPanel() {
  const t = useTranslation();
  const shapeSummary = useShapeGroupSummary();
  const interiorSummary = useInteriorGroupSummary();
  const baseSummary = useBaseGroupSummary();
  const showLabelTabs = useDesignerStore(useShallow((s) => s.params.style === 'standard'));
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-scroll scrollbar-thin">
        {/* Shape group */}
        <StickyGroupHeader
          title={t('binDesigner.group.shape')}
          defaultExpanded
          summary={shapeSummary}
        >
          <div className="px-4 py-4 border-b border-stroke-subtle/50">
            <DimensionsSection />
          </div>
          <div className="px-4 py-4">
            <WallsSection />
          </div>
        </StickyGroupHeader>

        {/* Interior group */}
        <StickyGroupHeader
          title={t('binDesigner.group.interior')}
          defaultExpanded
          summary={interiorSummary}
        >
          <div className="px-4 py-4">
            <InteriorSection />
          </div>
          {showLabelTabs && (
            <div className="px-4 py-4 border-t border-stroke-subtle/50">
              <LabelTabsSection />
            </div>
          )}
          <div className="px-4 py-4 border-t border-stroke-subtle/50">
            <ScoopSection />
          </div>
        </StickyGroupHeader>

        {/* Base group */}
        <StickyGroupHeader
          title={t('binDesigner.group.base')}
          defaultExpanded
          summary={baseSummary}
        >
          <div className="px-4 py-4 border-b border-stroke-subtle/50">
            <BaseSection />
          </div>
          <div className="px-4 py-4">
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
    </div>
  );
}
