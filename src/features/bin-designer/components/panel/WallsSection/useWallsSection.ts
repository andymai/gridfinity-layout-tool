import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import type {
  TextMode,
  WallPatternType,
  WallTextVerticalAlign,
} from '@/features/bin-designer/types';
import { DEFAULT_PATTERN_SCALE, WALL_TEXT_SIDES } from '@/features/bin-designer/types';
import { isPartialMask } from '@/shared/utils/cellMask';
import type { SnappingSliderOption } from '../../controls/SnappingSlider';

export function useWallsSection() {
  const {
    wallThickness,
    wallPattern,
    params,
    setParam,
    updateWallPattern,
    setWallText,
    setWallTextAlign,
    setSurfaceTextStyle,
  } = useDesignerStore(
    useShallow((s) => ({
      wallThickness: s.params.wallThickness,
      wallPattern: s.params.wallPattern,
      params: s.params,
      setParam: s.setParam,
      updateWallPattern: s.updateWallPattern,
      setWallText: s.setWallText,
      setWallTextAlign: s.setWallTextAlign,
      setSurfaceTextStyle: s.setSurfaceTextStyle,
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

  // Pattern scale: stored normalized [0, 1]; the slider works in whole percent.
  const patternScalePercent = Math.round((wallPattern.scale ?? DEFAULT_PATTERN_SCALE) * 100);
  const handleScaleChange = useCallback(
    (percent: number) => updateWallPattern({ scale: Math.min(1, Math.max(0, percent / 100)) }),
    [updateWallPattern]
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

  // ── Wall surface text (#2695) ─────────────────────────────────────────
  // Mirrors the worker gates in `wallTextLayout.ts`: polygon and solid-mode
  // bins skip wall text entirely.
  const wallTexts = params.surfaceText?.walls ?? {};
  const wallTextAlign: WallTextVerticalAlign = params.surfaceText?.wallAlign ?? 'center';
  const wallTextMode: TextMode = params.surfaceText?.style?.mode ?? params.textDefaults.mode;
  const hasAnyWallText = Object.values(wallTexts).some(
    (text) => typeof text === 'string' && text.trim() !== ''
  );
  const wallTextDisabledReason = isPartialMask(params.cellMask)
    ? t('binDesigner.walls.text.disabledPolygon')
    : params.base.solid
      ? t('binDesigner.walls.text.disabledSolid')
      : undefined;

  // Adapter matching the deferred-commit input's (id, value) signature; the
  // id slot carries the wall side index into WALL_TEXT_SIDES.
  const commitWallTextAt = useCallback(
    (index: number, value: string) => setWallText(WALL_TEXT_SIDES[index], value),
    [setWallText]
  );

  const setTextMode = useCallback(
    (mode: TextMode) => {
      setSurfaceTextStyle({ ...params.surfaceText?.style, mode });
    },
    [params.surfaceText, setSurfaceTextStyle]
  );

  return {
    state: {
      wallThickness,
      options,
      patternEnabled: wallPattern.enabled,
      pattern: wallPattern.pattern,
      patternScalePercent,
      patternDisabled: !patternStatus.available,
      patternDisabledReason,
      patternPartialNote,
      wallTexts,
      wallTextAlign,
      wallTextMode,
      hasAnyWallText,
      wallTextDisabledReason,
    },
    handlers: {
      handleChange,
      handlePatternChange,
      handleScaleChange,
      commitWallTextAt,
      setWallTextAlign,
      setTextMode,
    },
    t,
  };
}
