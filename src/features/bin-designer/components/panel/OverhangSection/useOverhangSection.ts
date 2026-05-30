import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { isPartialMask } from '@/shared/utils/cellMask';
import type { OverhangConfig } from '@/features/bin-designer/types';

const ZERO_OVERHANG: OverhangConfig = { left: 0, right: 0, front: 0, back: 0, feet: false };

export type OverhangSide = 'left' | 'right' | 'front' | 'back';

export function useOverhangSection() {
  const { overhang, updateOverhang, isCustomShape } = useDesignerStore(
    useShallow((s) => ({
      overhang: s.params.overhang ?? ZERO_OVERHANG,
      updateOverhang: s.updateOverhang,
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

  const total = overhang.left + overhang.right + overhang.front + overhang.back;

  const summary = useMemo(() => {
    if (isCustomShape || total <= 0) return undefined;
    // Compact axis-code chip (only non-zero sides), e.g. "L3 B2 mm". The codes
    // L/R/F/B + mm are glanceable, not translatable prose.
    const parts: string[] = [];
    if (overhang.left > 0) parts.push(`L${overhang.left}`);
    if (overhang.right > 0) parts.push(`R${overhang.right}`);
    if (overhang.front > 0) parts.push(`F${overhang.front}`);
    if (overhang.back > 0) parts.push(`B${overhang.back}`);
    return `${parts.join(' ')} mm`;
  }, [isCustomShape, total, overhang]);

  // Overhang is suppressed for custom-shape (mask) bins in the generator, so
  // surface that as a disabled state rather than silently ignoring input.
  const disabledReason = isCustomShape ? t('binDesigner.shape.custom.hint') : undefined;

  return {
    state: { overhang, isCustomShape, feet: overhang.feet ?? false, hasOverhang: total > 0 },
    handlers: { setSide, toggleFeet },
    meta: { summary, disabledReason },
    t,
  };
}
