import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { resolveConstraints } from '@/shared/constraints';
import type { BinStyle } from '../../../types';

export function useInteriorSection() {
  const { style, params, setParams } = useDesignerStore(
    useShallow((s) => ({
      style: s.params.style,
      params: s.params,
      setParams: s.setParams,
    }))
  );

  const setStyle = useCallback(
    (newStyle: BinStyle) => {
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

  const isSlotted = style === 'slotted';
  const isSolid = style === 'solid';

  return {
    state: { style, isSlotted, isSolid },
    handlers: { setStyle },
  };
}
