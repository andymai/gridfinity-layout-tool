import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import type {
  TextMode,
  WallPatternType,
  TextAnchor,
  WallPatternSides,
} from '@/features/bin-designer/types';
import type { Side } from '../shared';
import {
  DEFAULT_PATTERN_SCALE,
  DEFAULT_PATTERN_WEB_THICKNESS,
  MAX_WALL_LABEL_SLOT_PITCH_CELLS,
  PATTERN_WEB_THICKNESS_MAX,
  PATTERN_WEB_THICKNESS_MIN,
  WALL_PATTERN_SIDES,
  WALL_TEXT_SIDES,
  isKumikoPattern,
} from '@/features/bin-designer/types';
import { isPartialMask } from '@/shared/utils/cellMask';
import {
  LABEL_PLATE_HEIGHT_MM,
  effectiveLabelSocketClearance,
} from '@/shared/constants/labelPlates';
import {
  WALL_LABEL_SLOT_FRAME_MIN_MM,
  WALL_LABEL_SLOT_SIDES,
  planWallLabelSlots,
  resolveWallLabelSlots,
} from '@/shared/utils/wallLabelSlotPlan';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { slottedWalls } from '@/shared/utils/slotMath';
import { resolveWallPatternSides } from '@/shared/utils/wallPatternSides';
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
    setSurfaceTextAnchor,
    setSurfaceTextStyle,
    updateWallLabelSlots,
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
      setSurfaceTextAnchor: s.setSurfaceTextAnchor,
      setSurfaceTextStyle: s.setSurfaceTextStyle,
      updateWallLabelSlots: s.updateWallLabelSlots,
      currentDesignId: s.currentDesignId,
    }))
  );
  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
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

  // Strut width between stamped elements (mm). Absent on older designs, which
  // read as the legacy 0.8; the geometry clamps too, this just keeps the
  // stored value honest.
  const patternWebThickness = wallPattern.webThickness ?? DEFAULT_PATTERN_WEB_THICKNESS;
  const handleWebThicknessChange = useCallback(
    (mm: number) =>
      updateWallPattern({
        webThickness: Math.min(PATTERN_WEB_THICKNESS_MAX, Math.max(PATTERN_WEB_THICKNESS_MIN, mm)),
      }),
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

  // ── Per-side selection ────────────────────────────────────────────
  // Mirrors the worker gate in `wallPatterns.getWallPatternDescriptors`: a wall
  // is patterned only when the user picked it AND it carries no divider slots.
  // Memoized on the store slice: the resolver returns a fresh object, which
  // would otherwise re-identify `togglePatternSide` on every render.
  const patternSides = useMemo(() => resolveWallPatternSides(wallPattern), [wallPattern]);
  const slotBlocked = useMemo(
    () =>
      params.style === 'slotted'
        ? slottedWalls(params.slotConfig)
        : { front: false, back: false, left: false, right: false },
    [params.style, params.slotConfig]
  );

  const togglePatternSide = useCallback(
    (side: Side) => updateWallPattern({ sides: { ...patternSides, [side]: !patternSides[side] } }),
    [updateWallPattern, patternSides]
  );

  const activePatternSideCount = WALL_PATTERN_SIDES.filter(
    (side) => patternSides[side] && !slotBlocked[side]
  ).length;

  // Kumiko wrapped lattices need a rectangular footprint with all four walls
  // slot-free — `buildKumikoWallPatterns` returns no cutters otherwise, and the
  // stamp path rejects kumiko calculators outright, so NOTHING is patterned.
  // Without this the side selector would sit there claiming four specific walls
  // are perforated while every one of them exports solid.
  const patternInertReason = useMemo(() => {
    if (!isKumikoPattern(wallPattern.pattern)) return undefined;
    if (isPartialMask(params.cellMask)) return t('binDesigner.walls.pattern.kumiko.notPolygon');
    const anySlotted =
      params.style === 'slotted' &&
      (slotBlocked.front || slotBlocked.back || slotBlocked.left || slotBlocked.right);
    if (anySlotted) return t('binDesigner.walls.pattern.kumiko.notSlotted');
    if (resolveWallLabelSlots(params).enabled)
      return t('binDesigner.walls.pattern.kumiko.notLabelSlots');
    return undefined;
  }, [wallPattern.pattern, params, slotBlocked, t]);

  // ── Divider walls ─────────────────────────────────────────────────
  // The same pattern and scale carried through the compartment dividers, so a
  // patterned bin doesn't read as hollow walls around solid dividers.
  const dividersEnabled = wallPattern.dividers === true;
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

  // Deselecting every outer wall is a legitimate "dividers only" config, so it
  // gets an explanatory note rather than a forced minimum selection — but say so
  // either way, since an all-off selector otherwise reads as a broken pattern.
  const patternSidesNote = useMemo(() => {
    if (activePatternSideCount > 0) return undefined;
    if (dividersAvailableReason !== undefined) {
      // Dividers can't carry the pattern on this bin, so pointing at that
      // checkbox would send the user to a control they can't turn on.
      return t('binDesigner.walls.pattern.sides.noneNoDividers');
    }
    return dividersEnabled
      ? t('binDesigner.walls.pattern.sides.dividersOnly')
      : t('binDesigner.walls.pattern.sides.none');
  }, [activePatternSideCount, dividersEnabled, dividersAvailableReason, t]);

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

  // ── Wall surface text ─────────────────────────────────────────
  // Mirrors the worker gate in `wallTextLayout.ts`: only polygon bins skip
  // wall text. A solid bin's outer face is the same wall as a hollow one's —
  // the glyphs land on it identically, whatever is behind them.
  const wallTexts = params.surfaceText?.walls ?? {};
  // Anchor and mode both resolve through the shared surface style over the
  // design defaults, the same layering the worker applies.
  const wallTextAnchor: TextAnchor =
    params.surfaceText?.style?.anchor ?? params.textDefaults.anchor;
  const wallTextMode: TextMode = params.surfaceText?.style?.mode ?? params.textDefaults.mode;
  const hasAnyWallText = Object.values(wallTexts).some(
    (text) => typeof text === 'string' && text.trim() !== ''
  );
  const wallTextDisabledReason = isPartialMask(params.cellMask)
    ? t('binDesigner.walls.text.disabledPolygon')
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
      // Off clears every wall (and its per-wall styles) so the geometry matches
      // the toggle, the same semantics as the other FeatureToggle sections.
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

  // ── Vertical label slots ──────────────────────────────────────────
  const labelSlots = useMemo(() => resolveWallLabelSlots(params), [params]);
  // Planned as if on, so the refusals that disable the toggle are known
  // before the user reaches for it. The worker plans the real config.
  const labelSlotPlan = useMemo(() => {
    const collarMm = params.base.tile === true ? 0 : Math.max(0, params.extraWallHeightMm ?? 0);
    return planWallLabelSlots(
      { ...params, wallLabelSlots: { ...labelSlots, enabled: true } },
      {
        wallHeightMm: binDimensions(params).wallHeight + collarMm,
        gridUnitMmX: params.gridUnitMm,
        gridUnitMmY: params.gridUnitMmY ?? params.gridUnitMm,
      },
      effectiveLabelSocketClearance(nozzleSizeMm, params.label.plateFitOffset)
    );
  }, [params, labelSlots, nozzleSizeMm]);

  const labelSlotsDisabledReason = useMemo(() => {
    switch (labelSlotPlan.refusal) {
      case 'polygon':
        return t('binDesigner.walls.labelSlots.disabledPolygon');
      case 'overhang':
        return t('binDesigner.walls.labelSlots.disabledOverhang');
      case 'tooShort':
        return t('binDesigner.walls.labelSlots.disabledTooShort', {
          height: LABEL_PLATE_HEIGHT_MM,
        });
      case 'cellTooNarrow':
      case null:
        return undefined;
    }
  }, [labelSlotPlan.refusal, t]);

  const labelSlotSideBlocked = useMemo<WallPatternSides>(() => {
    const fits = (pitch: number): boolean => labelSlotPlan.bossWidthMm <= pitch;
    const alongX = fits(params.gridUnitMm);
    const alongY = fits(params.gridUnitMmY ?? params.gridUnitMm);
    return { front: !alongX, back: !alongX, left: !alongY, right: !alongY };
  }, [labelSlotPlan.bossWidthMm, params.gridUnitMm, params.gridUnitMmY]);

  const labelSlotCount = labelSlots.enabled ? labelSlotPlan.slots.length : 0;

  const labelSlotSidesNote = useMemo(() => {
    if (!labelSlots.enabled || labelSlotCount > 0) return undefined;
    const anyPicked = WALL_LABEL_SLOT_SIDES.some((side) => labelSlots.sides[side]);
    return anyPicked
      ? t('binDesigner.walls.labelSlots.sides.noneFit')
      : t('binDesigner.walls.labelSlots.sides.none');
  }, [labelSlots, labelSlotCount, t]);

  const labelSlotNotes = useMemo(() => {
    if (!labelSlots.enabled || labelSlotCount === 0) return [];
    const notes: string[] = [];
    if (params.base.stackingLip) notes.push(t('binDesigner.walls.labelSlots.lipNote'));
    if (labelSlotPlan.bossDepthMm > 0) {
      notes.push(
        t('binDesigner.walls.labelSlots.bossNote', {
          depth: Number(labelSlotPlan.bossDepthMm.toFixed(1)),
        })
      );
    }
    if (labelSlotPlan.thinWall) {
      notes.push(t('binDesigner.walls.labelSlots.thinWall', { min: WALL_LABEL_SLOT_FRAME_MIN_MM }));
    }
    return notes;
  }, [labelSlots.enabled, labelSlotCount, labelSlotPlan, params.base.stackingLip, t]);

  const toggleLabelSlots = useCallback(
    () => updateWallLabelSlots({ enabled: !labelSlots.enabled }),
    [updateWallLabelSlots, labelSlots.enabled]
  );
  const toggleLabelSlotSide = useCallback(
    (side: Side) =>
      updateWallLabelSlots({ sides: { ...labelSlots.sides, [side]: !labelSlots.sides[side] } }),
    [updateWallLabelSlots, labelSlots.sides]
  );
  const stepLabelSlotEveryCells = useCallback(
    (delta: number) =>
      updateWallLabelSlots({
        everyCells: Math.min(
          MAX_WALL_LABEL_SLOT_PITCH_CELLS,
          Math.max(1, labelSlots.everyCells + delta)
        ),
      }),
    [updateWallLabelSlots, labelSlots.everyCells]
  );

  // The plate list and download live with the sockets when label tabs are in
  // socket mode; otherwise the slots are the only thing that needs plates.
  const labelSlotPlatesHere =
    !(params.label.enabled && params.label.mode === 'socket') && labelSlotCount > 0;

  return {
    state: {
      wallThickness,
      options,
      patternEnabled: wallPattern.enabled,
      pattern: wallPattern.pattern,
      patternScalePercent,
      patternWebThickness,
      patternDisabled: !patternStatus.available,
      patternDisabledReason,
      patternPartialNote,
      patternSides,
      patternSideBlocked: slotBlocked,
      patternSidesNote,
      patternInertReason,
      dividersEnabled,
      dividersAvailableReason,
      dividersNote,
      wallTexts,
      wallTextAnchor,
      wallTextMode,
      hasAnyWallText,
      wallTextDisabledReason,
      isWallTextOpen,
      labelSlotsEnabled: labelSlots.enabled,
      labelSlotSides: labelSlots.sides,
      labelSlotEveryCells: labelSlots.everyCells,
      labelSlotsDisabledReason,
      labelSlotSideBlocked,
      labelSlotSidesNote,
      labelSlotCount,
      labelSlotNotes,
      labelSlotPlatesHere,
    },
    handlers: {
      handleChange,
      handlePatternChange,
      handleScaleChange,
      handleWebThicknessChange,
      togglePatternSide,
      handleDividersChange,
      commitWallTextAt,
      setSurfaceTextAnchor,
      setTextMode,
      toggleWallText,
      toggleLabelSlots,
      toggleLabelSlotSide,
      stepLabelSlotEveryCells,
    },
    t,
  };
}
