import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import type { SlantLayout } from '@/shared/utils/placedSlant';

/** The layout fields a placed bin's slant reads, stable while none of them change. */
export function useSlantLayout(): SlantLayout {
  return useLayoutStore(
    useShallow((s) => ({
      drawer: s.layout.drawer,
      baseplateParams: s.layout.baseplateParams,
      gridUnitMm: s.layout.gridUnitMm,
      gridUnitMmY: s.layout.gridUnitMmY,
      heightUnitMm: s.layout.heightUnitMm,
      lowProfileBase: s.layout.lowProfileBase,
    }))
  );
}
