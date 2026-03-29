import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import type { WallPatternType } from '@/features/bin-designer/types';
import type { SnappingSliderOption } from '../../controls/SnappingSlider';
/** Minimum wall thickness for corrugated pattern (mm). Must match corrugatedPattern.ts. */
const CORRUGATED_MIN_WALL_THICKNESS = 1.6;

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

  const handleChange = useCallback(
    (v: number) => {
      setParam('wallThickness', v);
      // Auto-disable corrugated pattern if wall becomes too thin
      if (
        v < CORRUGATED_MIN_WALL_THICKNESS &&
        wallPattern.enabled &&
        wallPattern.pattern === 'corrugated'
      ) {
        updateWallPattern({ enabled: false });
      }
    },
    [setParam, wallPattern, updateWallPattern]
  );

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

  // Constraint-driven pattern availability
  const patternStatus = getFeatureStatus(params, 'wallPattern');
  const patternDisabledReason = patternStatus.reason ? t(patternStatus.reason) : undefined;

  // Patterns that are unavailable due to parameter constraints
  const disabledPatterns = useMemo(() => {
    const disabled = new Set<WallPatternType>();
    if (wallThickness < CORRUGATED_MIN_WALL_THICKNESS) {
      disabled.add('corrugated');
    }
    return disabled;
  }, [wallThickness]);

  // Partial note for UI hint when some (but not all) walls are slotted
  const someWallsSlotted = useMemo(() => {
    if (params.style !== 'slotted') return false;
    return params.slotConfig.x.enabled || params.slotConfig.y.enabled;
  }, [params.style, params.slotConfig.x.enabled, params.slotConfig.y.enabled]);

  const patternPartialNote = useMemo(() => {
    if (someWallsSlotted && patternStatus.available)
      return t('binDesigner.walls.pattern.someSlotted');
    return undefined;
  }, [someWallsSlotted, patternStatus.available, t]);

  return {
    state: {
      wallThickness,
      options,
      patternEnabled: wallPattern.enabled,
      pattern: wallPattern.pattern,
      patternDisabled: !patternStatus.available,
      patternDisabledReason,
      patternPartialNote,
      disabledPatterns,
    },
    handlers: { handleChange, handlePatternChange },
    t,
  };
}
