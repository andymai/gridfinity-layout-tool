import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { isPartialMask } from '@/shared/utils/cellMask';
import type { OverhangConfig } from '@/features/bin-designer/types';

const ZERO_OVERHANG: OverhangConfig = { left: 0, right: 0, front: 0, back: 0, feet: false };

export type OverhangSide = 'left' | 'right' | 'front' | 'back';

export function useOverhangSection() {
  const { overhang, updateOverhang, setHoveredOverhangSide, isCustomShape } = useDesignerStore(
    useShallow((s) => ({
      overhang: s.params.overhang ?? ZERO_OVERHANG,
      updateOverhang: s.updateOverhang,
      setHoveredOverhangSide: s.setHoveredOverhangSide,
      isCustomShape: isPartialMask(s.params.cellMask),
    }))
  );
  const t = useTranslation();

  const setSide = useCallback(
    (side: OverhangSide, value: number) => {
      updateOverhang({ [side]: value });
    },
    [updateOverhang]
  );

  const toggleFeet = useCallback(() => {
    updateOverhang({ feet: !(overhang.feet ?? false) });
  }, [overhang.feet, updateOverhang]);

  const setHovered = useCallback(
    (side: OverhangSide | 'feet' | null) => {
      setHoveredOverhangSide(side);
    },
    [setHoveredOverhangSide]
  );

  // Leave/blur handlers can't fire if the section unmounts or gets disabled
  // (inert custom-shape) mid-hover, which would strand the preview overlay.
  // Clear the transient highlight on unmount and whenever the section disables.
  useEffect(() => {
    if (isCustomShape) setHoveredOverhangSide(null);
    return () => setHoveredOverhangSide(null);
  }, [isCustomShape, setHoveredOverhangSide]);

  const total = overhang.left + overhang.right + overhang.front + overhang.back;
  const hasOverhang = total > 0;
  const enabled = overhang.enabled ?? hasOverhang;

  const toggle = useCallback(() => {
    updateOverhang({ enabled: !enabled });
  }, [enabled, updateOverhang]);

  // Overhang is suppressed for custom-shape (mask) bins in the generator, so
  // surface that as a disabled state rather than silently ignoring input.
  const disabledReason = isCustomShape ? t('binDesigner.shape.custom.hint') : undefined;

  return {
    state: { overhang, isCustomShape, feet: overhang.feet ?? false, hasOverhang, enabled },
    handlers: { setSide, toggleFeet, setHovered, toggle },
    meta: { disabledReason },
    t,
  };
}
