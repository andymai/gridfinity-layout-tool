import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { effectiveGridUnitMmY } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { buildFullParams } from '../utils/buildFullParams';

export interface StoredGenerationInput {
  readonly params: ResolvedBaseplateParams;
  readonly bedWidthMm: number;
  readonly bedDepthMm: number;
}

/** The open layout's plate and print bed, resolved from the stores right now. */
export function storedGenerationInput(): StoredGenerationInput {
  const { layout } = useLayoutStore.getState();
  const bedWidthMm = layout.printBedSize;
  const bedDepthMm = layout.printBedDepth ?? layout.printBedSize;
  const params = buildFullParams(
    layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    layout.drawer.width,
    layout.drawer.depth,
    layout.gridUnitMm,
    layout.drawer.fractionalEdgeX ?? 'end',
    layout.drawer.fractionalEdgeY ?? 'end',
    useSettingsStore.getState().settings.printSettings.nozzleSizeMm,
    layout.drawer.outline,
    layout.magnetAnchor,
    effectiveGridUnitMmY(layout),
    layout.drawer.gridShiftX ?? 0,
    layout.drawer.gridShiftY ?? 0,
    layout.lowProfileBase,
    { widthMm: bedWidthMm, depthMm: bedDepthMm }
  );
  return { params, bedWidthMm, bedDepthMm };
}
