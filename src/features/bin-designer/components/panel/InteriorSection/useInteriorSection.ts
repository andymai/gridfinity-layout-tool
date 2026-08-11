import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { resolveConstraints } from '@/shared/constraints';
import { cardToStyle } from '../../../types';
import type { BinStyle, InteriorCard } from '../../../types';

export function useInteriorSection() {
  const { style, params, setParams, card, setInteriorCard } = useDesignerStore(
    useShallow((s) => ({
      style: s.params.style,
      params: s.params,
      setParams: s.setParams,
      card: s.ui.interiorCard,
      setInteriorCard: s.setInteriorCard,
    }))
  );

  const setStyle = useCallback(
    (newStyle: BinStyle) => {
      // No-op when style is unchanged — prevents stale-closure overwrites
      // if clicks on interior controls bubble up to the mode card button.
      if (newStyle === style) return;

      // Determine which feature to enable based on the new style
      const featureToEnable =
        newStyle === 'slotted' ? 'style.slotted' : newStyle === 'solid' ? 'style.solid' : undefined;
      const featureToDisable =
        style === 'slotted' ? 'style.slotted' : style === 'solid' ? 'style.solid' : undefined;

      if (featureToEnable) {
        const { params: resolved } = resolveConstraints(params, {
          feature: featureToEnable,
          enabled: true,
        });
        setParams(resolved);
      } else if (featureToDisable) {
        // Switching back to standard — disable the current style
        const { params: resolved } = resolveConstraints(params, {
          feature: featureToDisable,
          enabled: false,
        });
        setParams(resolved);
      } else {
        // Standard → standard (no-op)
        setParams({ ...params, style: newStyle });
      }
    },
    [style, params, setParams]
  );

  /**
   * Selecting a card always records the card, then reconciles the style.
   * Bento and Grid Dividers both resolve to `'standard'`, so switching between
   * them is a pure UI move — `setStyle` no-ops and no params change, which is
   * what keeps toggling between the two from touching the design or the undo
   * stack.
   */
  const selectCard = useCallback(
    (next: InteriorCard) => {
      setInteriorCard(next);
      setStyle(cardToStyle(next));
    },
    [setInteriorCard, setStyle]
  );

  const isSlotted = style === 'slotted';
  const isSolid = style === 'solid';

  return {
    state: { style, card, isSlotted, isSolid },
    handlers: { setStyle, selectCard },
  };
}
