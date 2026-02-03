import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { useTranslation } from '@/i18n';
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

  const handleChange = useMemo(() => (v: number) => setParam('wallThickness', v), [setParam]);

  const toggleHoneycomb = useCallback(() => {
    updateWallPattern({ enabled: !wallPattern.enabled });
  }, [wallPattern.enabled, updateWallPattern]);

  // Slot detection
  const allWallsSlotted = useMemo(() => {
    if (params.style !== 'slotted') return false;
    return params.slotConfig.x.enabled && params.slotConfig.y.enabled;
  }, [params.style, params.slotConfig.x.enabled, params.slotConfig.y.enabled]);

  const someWallsSlotted = useMemo(() => {
    if (params.style !== 'slotted') return false;
    return params.slotConfig.x.enabled || params.slotConfig.y.enabled;
  }, [params.style, params.slotConfig.x.enabled, params.slotConfig.y.enabled]);

  const honeycombDisabledReason = useMemo(() => {
    if (allWallsSlotted) return t('binDesigner.walls.pattern.allSlotted');
    return undefined;
  }, [allWallsSlotted, t]);

  const honeycombPartialNote = useMemo(() => {
    if (someWallsSlotted && !allWallsSlotted) return t('binDesigner.walls.pattern.someSlotted');
    return undefined;
  }, [someWallsSlotted, allWallsSlotted, t]);

  const meta: SectionMeta = useMemo(() => ({ summary: `${wallThickness}mm` }), [wallThickness]);

  return {
    state: {
      wallThickness,
      options,
      honeycombEnabled: wallPattern.enabled,
      honeycombDisabledReason,
      honeycombPartialNote,
    },
    handlers: { handleChange, toggleHoneycomb },
    meta,
    t,
  };
}
