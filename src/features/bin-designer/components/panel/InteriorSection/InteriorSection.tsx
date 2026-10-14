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
import { getFeatureStatus } from '@/shared/constraints';
import { Badge } from '@/design-system';
import { InteriorModeContent } from './InteriorModes';
import { INTERIOR_MODE_META } from './interiorModeMeta';
import { useInteriorSection } from './useInteriorSection';
import { ModeTiles } from '../shared';
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
  const customShapeReason = t('binDesigner.shape.custom.unavailable');
  // Only the base can make slot mode unreachable. The solid/slotted exclusion
  // also reports here, but selecting the card resolves that one, so gating on
  // it would strand a Solid bin with no way back to Removable.
  const slottedBlockedReason = useDesignerStore((s) => {
    const status = getFeatureStatus(s.params, 'style.slotted');
    return status.conflicts.includes('base.lid') ? status.reason : undefined;
  });
  // Slot mode uses divider slots, not the compartment grid — angled
  // dividers don't translate to slot-mode geometry yet. Gate the slotted
  // card while any override exists so the user gets an explanation
  // instead of silently losing their tilts.
  const slottedAngledReason = t('binDesigner.angledDividers.slotIncompatible');

  const disabledReason = (card: InteriorCard): string | undefined => {
    if (isCustomShape && CARDS_REQUIRING_RECTANGULAR_SHAPE.has(card)) return customShapeReason;
    if (card === 'slotted' && hasAngledDividers) return slottedAngledReason;
    if (card === 'slotted' && slottedBlockedReason) return t(slottedBlockedReason);
    return undefined;
  };

  return (
    <ModeTiles
      ariaLabel={t('binDesigner.group.interior')}
      value={state.card}
      onChange={handlers.selectCard}
      columns={2}
      options={INTERIOR_CARDS.map((card) => ({
        value: card,
        icon: INTERIOR_MODE_META[card].icon,
        label: t(INTERIOR_MODE_META[card].titleKey),
        caption: t(INTERIOR_MODE_META[card].descriptionKey),
        disabledReason: disabledReason(card),
        badge:
          card === 'bento' ? (
            <Badge tone="info" title={t('binDesigner.bento.experimentalHint')}>
              {t('common.experimental')}
            </Badge>
          ) : undefined,
      }))}
    >
      <InteriorModeContent card={state.card} />
    </ModeTiles>
  );
}
