/**
 * Interior section: Style selector + compartment/slot configuration.
 *
 * Provides a segmented button to switch between Standard (compartment grid)
 * and Slotted (removable divider slots) interior styles.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { CompartmentEditor } from '../../CompartmentEditor';
import { SlotConfigurator } from '../../SlotConfigurator/SlotConfigurator';
import { InteriorIcon } from '../SectionIllustrations';
import { getCompartmentCount } from '../../../utils/compartments';
import { useTranslation } from '@/i18n';
import type { BinStyle } from '../../../types';

const STYLE_OPTIONS: BinStyle[] = ['standard', 'slotted'];

export function InteriorSection() {
  const { compartments, style, setParam } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      style: s.params.style,
      setParam: s.setParam,
    }))
  );
  const t = useTranslation();

  const setStyle = useCallback(
    (newStyle: BinStyle) => {
      setParam('style', newStyle);
    },
    [setParam]
  );

  const isSlotted = style === 'slotted';
  const compartmentCount = getCompartmentCount(compartments);
  const summary = isSlotted
    ? t('binDesigner.slottedInteriorSummary')
    : t('binDesigner.interiorSummary', { count: compartmentCount });

  return (
    <CollapsibleSection
      title={t('binDesigner.interior')}
      defaultExpanded={true}
      illustration={<InteriorIcon />}
      summary={summary}
    >
      <div className="space-y-3">
        {/* Style selector */}
        <div className="flex gap-1">
          {STYLE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStyle(option)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                style === option
                  ? 'bg-accent text-white'
                  : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {option === 'standard'
                ? t('binDesigner.interiorFixed')
                : t('binDesigner.interiorRemovable')}
            </button>
          ))}
        </div>

        {/* Conditional content */}
        {isSlotted ? <SlotConfigurator /> : <CompartmentEditor />}
      </div>
    </CollapsibleSection>
  );
}
