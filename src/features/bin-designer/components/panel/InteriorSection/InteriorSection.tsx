/**
 * Interior section: Mode selector + mode-specific content.
 *
 * Provides a segmented control to switch between Fixed (compartment grid),
 * Removable (divider slots), and Solid (cutouts) interior styles.
 * Each mode renders its own collapsible section with a dynamic title.
 */

import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { CompartmentEditor } from '../../CompartmentEditor';
import { SlotConfigurator } from '../../SlotConfigurator/SlotConfigurator';
import { CutoutsSection } from '../CutoutsSection';
import type { BinStyle } from '../../../types';
import { useInteriorSection } from './useInteriorSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useResponsive } from '@/shared/hooks/useResponsive';

const STYLE_OPTIONS: BinStyle[] = ['standard', 'slotted', 'solid'];

const STYLE_LABEL_KEYS: Record<BinStyle, string> = {
  standard: 'binDesigner.interiorFixed',
  slotted: 'binDesigner.interiorRemovable',
  solid: 'binDesigner.interiorSolid',
};

const SECTION_TITLE_KEYS: Record<BinStyle, string> = {
  standard: 'binDesigner.interior',
  slotted: 'binDesigner.interiorSlotTitle',
  solid: 'binDesigner.interiorCutoutsTitle',
};

export function InteriorSection() {
  const { state, handlers, meta, t } = useInteriorSection();
  const setCutoutEditorOpen = useDesignerStore((s) => s.setCutoutEditorOpen);
  const { isDesktop } = useResponsive();

  return (
    <div className="space-y-3">
      {/* Style selector */}
      <div className="flex gap-1">
        {STYLE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handlers.setStyle(option)}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              state.style === option
                ? 'bg-accent text-white'
                : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
            }`}
          >
            {t(STYLE_LABEL_KEYS[option])}
          </button>
        ))}
      </div>

      {/* Mode-specific collapsible section */}
      {state.style === 'standard' && (
        <CollapsibleSection
          title={t(SECTION_TITLE_KEYS.standard)}
          defaultExpanded
          summary={meta.summary}
        >
          <CompartmentEditor />
        </CollapsibleSection>
      )}

      {state.isSlotted && (
        <CollapsibleSection
          title={t(SECTION_TITLE_KEYS.slotted)}
          defaultExpanded
          summary={meta.summary}
        >
          <SlotConfigurator />
        </CollapsibleSection>
      )}

      {state.isSolid && (
        <CollapsibleSection
          title={t(SECTION_TITLE_KEYS.solid)}
          defaultExpanded
          summary={meta.summary}
        >
          {isDesktop ? (
            <button
              type="button"
              onClick={() => setCutoutEditorOpen(true)}
              className="w-full rounded border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
            >
              {t('binDesigner.editCutouts')}
            </button>
          ) : (
            <CutoutsSection />
          )}
        </CollapsibleSection>
      )}
    </div>
  );
}
