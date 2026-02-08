import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { BinStyle } from '../../../types';

export function useInteriorSection() {
  const { style, setParam, updateBase, updateWallPattern } = useDesignerStore(
    useShallow((s) => ({
      style: s.params.style,
      setParam: s.setParam,
      updateBase: s.updateBase,
      updateWallPattern: s.updateWallPattern,
    }))
  );

  const setStyle = useCallback(
    (newStyle: BinStyle) => {
      setParam('style', newStyle);
      updateBase({ solid: newStyle === 'solid' });
      // Disable wall patterns when switching to cutout mode
      if (newStyle === 'solid') {
        updateWallPattern({ enabled: false });
      }
    },
    [setParam, updateBase, updateWallPattern]
  );

  const isSlotted = style === 'slotted';
  const isSolid = style === 'solid';

  return {
    state: { style, isSlotted, isSolid },
    handlers: { setStyle },
  };
}
