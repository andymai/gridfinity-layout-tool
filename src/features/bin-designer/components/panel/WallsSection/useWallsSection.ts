import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { useTranslation } from '@/i18n';
import type { SnappingSliderOption } from '../../controls/SnappingSlider';
import type { SectionMeta } from '../types';

export function useWallsSection() {
  const { wallThickness, eco, params, setParam, updateHoneycombWall } = useDesignerStore(
    useShallow((s) => ({
      wallThickness: s.params.wallThickness,
      eco: s.params.eco,
      params: s.params,
      setParam: s.setParam,
      updateHoneycombWall: s.updateHoneycombWall,
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
    updateHoneycombWall({ enabled: !eco.honeycombWall.enabled });
  }, [eco.honeycombWall.enabled, updateHoneycombWall]);

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
    if (allWallsSlotted) return t('binDesigner.walls.honeycomb.allSlotted');
    return undefined;
  }, [allWallsSlotted, t]);

  const honeycombPartialNote = useMemo(() => {
    if (someWallsSlotted && !allWallsSlotted) return t('binDesigner.walls.honeycomb.someSlotted');
    return undefined;
  }, [someWallsSlotted, allWallsSlotted, t]);

  const meta: SectionMeta = useMemo(() => ({ summary: `${wallThickness}mm` }), [wallThickness]);

  return {
    state: {
      wallThickness,
      options,
      honeycombEnabled: eco.honeycombWall.enabled,
      honeycombDisabledReason,
      honeycombPartialNote,
    },
    handlers: { handleChange, toggleHoneycomb },
    meta,
    t,
  };
}
