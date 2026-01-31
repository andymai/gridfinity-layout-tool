/**
 * Interior section: Style selector + compartment/slot configuration.
 *
 * Provides a segmented button to switch between Standard (compartment grid)
 * and Slotted (removable divider slots) interior styles.
 */

import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { CompartmentEditor } from '../../CompartmentEditor';
import { SlotConfigurator } from '../../SlotConfigurator/SlotConfigurator';
import type { BinStyle } from '../../../types';
import { useInteriorSection } from './useInteriorSection';

const STYLE_OPTIONS: BinStyle[] = ['standard', 'slotted'];

export function InteriorSection() {
  const { state, handlers, meta, t } = useInteriorSection();

  return (
    <CollapsibleSection
      title={t('binDesigner.interior')}
      defaultExpanded={true}
      summary={meta.summary}
    >
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
              {option === 'standard'
                ? t('binDesigner.interiorFixed')
                : t('binDesigner.interiorRemovable')}
            </button>
          ))}
        </div>

        {/* Conditional content */}
        {state.isSlotted ? <SlotConfigurator /> : <CompartmentEditor />}
      </div>
    </CollapsibleSection>
  );
}
