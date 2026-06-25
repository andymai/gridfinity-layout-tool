/**
 * Reuses the same zone helpers, transaction API, and shared recent-colors LRU
 * as the left ColorsSection rows, so the inspector's color editor never drifts
 * from the popover on labels, patches, or recent-color memory.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useRecentColorsStore } from '@/features/bin-designer/store/recentColorsStore';
import { useTranslation } from '@/i18n';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { computeActiveZones, parseLipCell } from '@/features/bin-designer/types/featureColors';
import type { ColorZone, LipCellZone } from '@/features/bin-designer/types/featureColors';
import {
  buildOtherColors,
  zoneColor,
  zoneColorPatch,
  zoneLabel,
} from '@/features/bin-designer/utils/zoneLabels';

export interface ColorZoneEditing {
  readonly zone: ColorZone;
  readonly zoneLabel: string;
  readonly color: string;
  readonly defaultColor: string;
  readonly otherColors: readonly string[];
  readonly bodyColor: string;
  readonly recentColors: readonly string[];
  readonly onChange: (hex: string) => void;
  readonly onGestureStart: () => void;
  readonly onGestureEnd: () => void;
}

export function useColorZoneEditing(zone: ColorZone): ColorZoneEditing {
  const t = useTranslation();
  const params = useDesignerStore(useShallow((s) => s.params));
  const updateFeatureColors = useDesignerStore((s) => s.updateFeatureColors);
  const startTransaction = useDesignerStore((s) => s.startTransaction);
  const commitTransaction = useDesignerStore((s) => s.commitTransaction);
  const recentColors = useRecentColorsStore((s) => s.recentColors);
  const remember = useRecentColorsStore((s) => s.remember);

  const featureColors = params.featureColors;

  const colorsByZone = useMemo(() => {
    const map = new Map<ColorZone, string>();
    for (const z of computeActiveZones(params)) map.set(z, zoneColor(featureColors, z));
    return map;
  }, [params, featureColors]);

  const onChange = useCallback(
    (hex: string) => {
      remember(hex);
      updateFeatureColors(zoneColorPatch(zone, hex));
    },
    [remember, updateFeatureColors, zone]
  );

  const defaultColor = parseLipCell(zone)
    ? DEFAULT_FEATURE_COLOR_CONFIG.body
    : DEFAULT_FEATURE_COLOR_CONFIG[zone as Exclude<ColorZone, LipCellZone>];

  return {
    zone,
    zoneLabel: zoneLabel(zone, t, featureColors.lip.bands),
    color: zoneColor(featureColors, zone),
    defaultColor,
    otherColors: buildOtherColors(zone, colorsByZone),
    bodyColor: featureColors.body,
    recentColors,
    onChange,
    onGestureStart: startTransaction,
    onGestureEnd: commitTransaction,
  };
}
