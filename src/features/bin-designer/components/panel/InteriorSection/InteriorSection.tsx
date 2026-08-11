/**
 * Interior section: Card-based mode selector.
 *
 * Four vertically-stacked cards for Grid Dividers (uniform compartment grid),
 * Bento (compartments sized freely), Removable (divider slots), and Cutout
 * (custom shapes). Each card shows icon, title, description, and expands
 * inline with controls or a workspace launcher.
 */

import { useDesignerStore } from '@/features/bin-designer/store';
import { isPartialMask } from '@/shared/utils/cellMask';
import { useTranslation } from '@/i18n';
import { InteriorModeCard } from './InteriorModeCard';
import { useInteriorSection } from './useInteriorSection';
import { FeatureGate } from '../FeatureGate';
import { INTERIOR_CARDS } from '../../../types';
import type { InteriorCard } from '../../../types';

/**
 * Grid Dividers, Bento (compartment grids) and Slotted (divider slots) assume a
 * rectangular interior; Solid (cutouts) is polygon-aware and stays interactive
 * on custom shapes.
 */
const CARDS_REQUIRING_RECTANGULAR_SHAPE: ReadonlySet<InteriorCard> = new Set([
  'standard',
  'bento',
  'slotted',
]);

export function InteriorSection() {
  const { state, handlers } = useInteriorSection();
  const t = useTranslation();
  const isCustomShape = useDesignerStore((s) => isPartialMask(s.params.cellMask));
  const hasAngledDividers = useDesignerStore(
    (s) => (s.params.compartments.dividerOverrides?.length ?? 0) > 0
  );
  const customShapeReason = t('binDesigner.shape.custom.hint');
  // Slot mode uses divider slots, not the compartment grid — angled
  // dividers don't translate to slot-mode geometry yet. Gate the slotted
  // card while any override exists so the user gets an explanation
  // instead of silently losing their tilts.
  const slottedAngledReason = t('binDesigner.angledDividers.slotIncompatible');

  return (
    <div className="space-y-2">
      {INTERIOR_CARDS.map((card) => {
        const element = (
          <InteriorModeCard
            key={card}
            card={card}
            isExpanded={state.card === card}
            onSelect={() => handlers.selectCard(card)}
          />
        );
        if (isCustomShape && CARDS_REQUIRING_RECTANGULAR_SHAPE.has(card)) {
          return (
            <FeatureGate key={card} disabled reason={customShapeReason}>
              {element}
            </FeatureGate>
          );
        }
        if (card === 'slotted' && hasAngledDividers) {
          return (
            <FeatureGate key={card} disabled reason={slottedAngledReason}>
              {element}
            </FeatureGate>
          );
        }
        return element;
      })}
    </div>
  );
}
