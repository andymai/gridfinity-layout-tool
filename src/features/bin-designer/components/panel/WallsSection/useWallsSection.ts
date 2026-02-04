import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { useTranslation } from '@/i18n';
import type { WallPatternType } from '@/features/bin-designer/types';
import type { SnappingSliderOption } from '../../controls/SnappingSlider';
import type { SectionMeta } from '../types';

export function useWallsSection() {
  const { wallThickness, wallPattern, params, setParam, updateWallPattern } = useDesignerStore(
    useShallow((s) => ({
      wallThickness: s.params.wallThickness,
      wallPattern: s.params.wallPattern,
      params: s.params,
      setParam: s.setParam,
      updateWallPattern: s.updateWallPattern,
    }))
  );
  const t = useTranslation();

  const options: SnappingSliderOption[] = useMemo(
    () =>
      WALL_THICKNESS_OPTIONS.map((value) => ({
        value,
        description: t(`binDesigner.wallThickness.${value}`),
      })),
    [t]
  );

  const handleChange = useCallback((v: number) => setParam('wallThickness', v), [setParam]);

  // Pattern selection handler
  const handlePatternChange = useCallback(
    (pattern: WallPatternType | null) => {
      if (pattern === null) {
        updateWallPattern({ enabled: false });
      } else {
        updateWallPattern({ enabled: true, pattern });
      }
    },
    [updateWallPattern]
  );

  // Slot detection — patterns cannot be applied to slotted walls
  const allWallsSlotted = useMemo(() => {
    if (params.style !== 'slotted') return false;
    return params.slotConfig.x.enabled && params.slotConfig.y.enabled;
  }, [params.style, params.slotConfig.x.enabled, params.slotConfig.y.enabled]);

  const someWallsSlotted = useMemo(() => {
    if (params.style !== 'slotted') return false;
    return params.slotConfig.x.enabled || params.slotConfig.y.enabled;
  }, [params.style, params.slotConfig.x.enabled, params.slotConfig.y.enabled]);

  const patternDisabledReason = useMemo(() => {
    if (allWallsSlotted) return t('binDesigner.walls.pattern.allSlotted');
    return undefined;
  }, [allWallsSlotted, t]);

  const patternPartialNote = useMemo(() => {
    if (someWallsSlotted && !allWallsSlotted) return t('binDesigner.walls.pattern.someSlotted');
    return undefined;
  }, [someWallsSlotted, allWallsSlotted, t]);

  const meta: SectionMeta = useMemo(() => ({ summary: `${wallThickness}mm` }), [wallThickness]);

  return {
    state: {
      wallThickness,
      options,
      patternEnabled: wallPattern.enabled,
      pattern: wallPattern.pattern,
      allWallsSlotted,
      patternDisabledReason,
      patternPartialNote,
    },
    handlers: { handleChange, handlePatternChange },
    meta,
    t,
  };
}
