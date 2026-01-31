import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { useTranslation } from '@/i18n';
import type { SnappingSliderOption } from '../../controls/SnappingSlider';
import type { SectionMeta } from '../types';

export function useWallsSection() {
  const { wallThickness, setParam } = useDesignerStore(
    useShallow((s) => ({
      wallThickness: s.params.wallThickness,
      setParam: s.setParam,
    }))
  );
  const t = useTranslation();

  const options: SnappingSliderOption[] = useMemo(
    () =>
      WALL_THICKNESS_OPTIONS.map((value) => ({
        value,
        description: t(`binDesigner.wallThickness.${value}` as Parameters<typeof t>[0]),
      })),
    [t]
  );

  const handleChange = useMemo(() => (v: number) => setParam('wallThickness', v), [setParam]);

  const meta: SectionMeta = useMemo(() => ({ summary: `${wallThickness}mm` }), [wallThickness]);

  return {
    state: { wallThickness, options },
    handlers: { handleChange },
    meta,
    t,
  };
}
