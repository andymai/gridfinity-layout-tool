import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { isPartialMask } from '@/shared/utils/cellMask';
import type { OverhangConfig } from '@/features/bin-designer/types';

const ZERO_OVERHANG: OverhangConfig = { left: 0, right: 0, front: 0, back: 0 };

export type OverhangSide = keyof OverhangConfig;

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

  const total = overhang.left + overhang.right + overhang.front + overhang.back;

  const summary = useMemo(() => {
    if (isCustomShape || total <= 0) return undefined;
    return t('binDesigner.overhang.summary', {
      left: String(overhang.left),
      right: String(overhang.right),
      front: String(overhang.front),
      back: String(overhang.back),
    });
  }, [isCustomShape, total, overhang, t]);

  // Overhang is suppressed for custom-shape (mask) bins in the generator, so
  // surface that as a disabled state rather than silently ignoring input.
  const disabledReason = isCustomShape ? t('binDesigner.shape.custom.hint') : undefined;

  return {
    state: { overhang, isCustomShape },
    handlers: { setSide },
    meta: { summary, disabledReason },
    t,
  };
}
