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
import { assessDividerPatternFit } from '@/features/bin-designer/utils/dividerPatternFit';
import { getCompartmentCount } from '@/features/bin-designer/utils/compartments';
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

  // ── Divider walls (#2811) ─────────────────────────────────────────────────
  // The same pattern and scale carried through the compartment dividers, so a
  // patterned bin doesn't read as hollow walls around solid dividers.
  const handleDividersChange = useCallback(
    (dividers: boolean) => updateWallPattern({ dividers }),
    [updateWallPattern]
  );

  const dividersAvailableReason = useMemo(() => {
    // Solid first: `base.solid` and `style === 'solid'` are kept in lockstep by
    // IMPLICATION_RULES, so a solid bin would otherwise fall through to the
    // slotted copy and be told its dividers print as separate pieces.
    if (params.style === 'solid' || params.base.solid)
      return t('binDesigner.walls.pattern.dividers.notSolid');
    if (isPartialMask(params.cellMask)) return t('binDesigner.walls.pattern.dividers.notPolygon');
    // Slotted bins pattern their removable pieces instead of in-bin walls, so
    // the gate is "are there any slots" rather than "are there compartments".
    if (params.style === 'slotted') {
      // Slotted bins have no compartments, so the compartment copy would be
      // nonsense — point at the slots that actually produce the pieces.
      if (params.dividerPieces.thickness <= 0)
        return t('binDesigner.walls.pattern.dividers.noSlots');
      return params.slotConfig.x.enabled || params.slotConfig.y.enabled
        ? undefined
        : t('binDesigner.walls.pattern.dividers.noSlots');
    }
    // Zero thickness means compartment IDs with no wall between them — nothing
    // to pattern, and the worker gate rejects it too.
    if (getCompartmentCount(params.compartments) <= 1 || params.compartments.thickness <= 0)
      return t('binDesigner.walls.pattern.dividers.noDividers');
    return undefined;
  }, [
    params.style,
    params.base.solid,
    params.cellMask,
    params.compartments,
    params.dividerPieces.thickness,
    params.slotConfig.x.enabled,
    params.slotConfig.y.enabled,
    t,
  ]);

  const dividersFit = useMemo(() => assessDividerPatternFit(params), [params]);
  const dividersNote = useMemo(() => {
    if (dividersAvailableReason !== undefined) return undefined;
    if (dividersFit === 'none') return t('binDesigner.walls.pattern.dividers.tooSmall');
    if (dividersFit === 'partial') return t('binDesigner.walls.pattern.dividers.someTooSmall');
    // The removable-piece ghosts in the preview are plain boxes with no CSG, so
    // they can't show the perforation — say where it does show up.
    if (params.style === 'slotted') return t('binDesigner.walls.pattern.dividers.piecesNote');
    return undefined;
  }, [dividersAvailableReason, dividersFit, params.style, t]);

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
      dividersEnabled: wallPattern.dividers === true,
      dividersAvailableReason,
      dividersNote,
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
      handleDividersChange,
      commitWallTextAt,
      setWallTextAlign,
      setTextMode,
      toggleWallText,
    },
    t,
  };
}
