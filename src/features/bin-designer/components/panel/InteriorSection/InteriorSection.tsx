/**
 * Interior section: Card-based mode selector.
 *
 * Three vertically-stacked cards for Fixed (compartment grid),
 * Removable (divider slots), and Cutout (custom shapes) interior styles.
 * Each card shows icon, title, description, and expands inline with controls.
 */

import { useDesignerStore } from '@/features/bin-designer/store';
import { isPartialMask } from '@/shared/utils/cellMask';
import { useTranslation } from '@/i18n';
import { InteriorModeCard } from './InteriorModeCard';
import { useInteriorSection } from './useInteriorSection';
import { FeatureGate } from '../FeatureGate';
import type { BinStyle } from '../../../types';

const MODES: BinStyle[] = ['standard', 'slotted', 'solid'];

/**
 * Standard (compartment grid) and Slotted (divider slots) assume a rectangular
 * interior; Solid (cutouts) is polygon-aware and stays interactive on custom shapes.
 */
const MODES_REQUIRING_RECTANGULAR_SHAPE: ReadonlySet<BinStyle> = new Set(['standard', 'slotted']);

export function InteriorSection() {
  const { state, handlers } = useInteriorSection();
  const t = useTranslation();
  const isCustomShape = useDesignerStore((s) => isPartialMask(s.params.cellMask));
  const customShapeReason = t('binDesigner.shape.custom.hint');

  return (
    <div className="space-y-2">
      {MODES.map((mode) => {
        const card = (
          <InteriorModeCard
            key={mode}
            mode={mode}
            isExpanded={state.style === mode}
            onSelect={() => handlers.setStyle(mode)}
          />
        );
        if (isCustomShape && MODES_REQUIRING_RECTANGULAR_SHAPE.has(mode)) {
          return (
            <FeatureGate key={mode} disabled reason={customShapeReason}>
              {card}
            </FeatureGate>
          );
        }
        return card;
      })}
    </div>
  );
}
