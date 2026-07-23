import { useCallback, useMemo, useState } from 'react';
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
    clearWallText,
    setWallTextAlign,
    setSurfaceTextStyle,
    currentDesignId,
  } = useDesignerStore(
    useShallow((s) => ({
      wallThickness: s.params.wallThickness,
      wallPattern: s.params.wallPattern,
      params: s.params,
      setParam: s.setParam,
      updateWallPattern: s.updateWallPattern,
      setWallText: s.setWallText,
      clearWallText: s.clearWallText,
      setWallTextAlign: s.setWallTextAlign,
      setSurfaceTextStyle: s.setSurfaceTextStyle,
      currentDesignId: s.currentDesignId,
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

  // Wall-text is gated behind a toggle (matching the sibling cutout/handle
  // sections). The open state is UI-only — deriving it as `local || hasText`
  // means a loaded design with saved wall text opens expanded without a
  // migration, and stays in sync when the active design switches (no remount).
  const [wallTextOpen, setWallTextOpen] = useState(false);
  // Reset the local open flag when the active design changes so an opened-but-
  // empty toggle on one design doesn't carry into the next (the panel hook
  // isn't remounted on design switch). React's "adjust state during render"
  // pattern — no effect. `local || hasText` still auto-opens a design that
  // ships with saved wall text.
  const [wallTextDesignId, setWallTextDesignId] = useState(currentDesignId);
  if (wallTextDesignId !== currentDesignId) {
    setWallTextDesignId(currentDesignId);
    setWallTextOpen(false);
  }
  const isWallTextOpen = wallTextOpen || hasAnyWallText;
  const toggleWallText = useCallback(() => {
    if (isWallTextOpen) {
      // Off clears every wall (and align) so the geometry matches the toggle —
      // same semantics as the other FeatureToggle-gated sections.
      clearWallText();
      setWallTextOpen(false);
    } else {
      setWallTextOpen(true);
    }
  }, [isWallTextOpen, clearWallText]);

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
      isWallTextOpen,
    },
    handlers: {
      handleChange,
      handlePatternChange,
      handleScaleChange,
      commitWallTextAt,
      setWallTextAlign,
      setTextMode,
      toggleWallText,
    },
    t,
  };
}
