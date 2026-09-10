/** Slot axis derivations and setters behind the slot configurator; the component keeps the markup. */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS, GRIDFINITY } from '@/features/bin-designer/constants';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import {
  calculateSlotPositions,
  calculateDividerLength,
  calculateDividerPieceHeight,
  calculateLapPartialSegments,
  calculateShortDividerLengths,
  calculateShortDividerSpans,
  dividerGrooveDepth,
  dividerSeatZ,
  getEffectiveSlotDimensions,
  getReceptacleDepth,
  resolveCrossDividerMode,
  resolvePartialStyle,
  MIN_DIVIDER_FOR_RECEPTACLES,
  MIN_DIVIDER_FOR_SNAP,
  MIN_WALL_FOR_SLOTS,
} from '@/shared/utils/slotMath';
import { clamp } from '@/shared/utils/math';
import { useTranslation } from '@/i18n';
import type {
  CrossDividerStyle,
  DividerPieceConfig,
  PartialDividerStyle,
  SlotLayout,
} from '../../types';

export type SlotDirection = 'vertical' | 'horizontal' | 'both';

export type SlotAxis = 'x' | 'y';

export function useSlotConfigurator() {
  const { params, setParam } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      setParam: s.setParam,
    }))
  );
  const { slotConfig, dividerPieces } = params;
  const stackingLip = params.base.stackingLip;
  const grooveDepth = dividerGrooveDepth(params);
  const seatZ = dividerSeatZ(params.wallThickness, grooveDepth);
  const t = useTranslation();

  // ── Dimension calculations ──────────────────────────────────────────
  const { innerW, innerD, wallHeight } = binDimensions(params);

  const lipTaperWidth = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;
  const lipOverhang = stackingLip ? Math.max(0, lipTaperWidth - params.wallThickness) : 0;

  // ── Slot direction / count ──────────────────────────────────────────
  const activeDirection: SlotDirection =
    slotConfig.x.enabled && slotConfig.y.enabled
      ? 'both'
      : slotConfig.y.enabled
        ? 'vertical'
        : 'horizontal';
  const enabledAxes = useMemo<SlotAxis[]>(
    () =>
      activeDirection === 'both' ? ['y', 'x'] : activeDirection === 'vertical' ? ['y'] : ['x'],
    [activeDirection]
  );

  // X-axis slots sit on the left/right walls, spaced along the depth;
  // Y-axis slots sit on the front/back walls, spaced along the width.
  const axisInnerDim = useCallback(
    (axis: SlotAxis) => (axis === 'x' ? innerD : innerW),
    [innerD, innerW]
  );

  const slotCount = useMemo(() => {
    const axisCount = (axis: SlotAxis): number =>
      calculateSlotPositions(axisInnerDim(axis), slotConfig[axis].pitch, lipOverhang).length;

    // Insert mode: one axis holds long dividers; the other's rows hold one
    // short divider PER COMPARTMENT, so count rows × (longCount + 1).
    const mode = resolveCrossDividerMode(slotConfig, dividerPieces.thickness);
    if (activeDirection === 'both' && mode.style === 'insert') {
      const shortAxis: SlotAxis = mode.longAxis === 'y' ? 'x' : 'y';
      const longCount = axisCount(mode.longAxis);
      if (longCount > 0) return longCount + axisCount(shortAxis) * (longCount + 1);
    }

    return enabledAxes.reduce((sum, axis) => sum + axisCount(axis), 0);
  }, [
    enabledAxes,
    slotConfig,
    axisInnerDim,
    lipOverhang,
    activeDirection,
    dividerPieces.thickness,
  ]);

  const setDirection = useCallback(
    (direction: SlotDirection) => {
      setParam('slotConfig', {
        ...slotConfig,
        x: { ...slotConfig.x, enabled: direction !== 'vertical' },
        y: { ...slotConfig.y, enabled: direction !== 'horizontal' },
      });
    },
    [slotConfig, setParam]
  );

  const updateAxisPitch = useCallback(
    (axis: SlotAxis, pitch: number) => {
      setParam('slotConfig', {
        ...slotConfig,
        [axis]: { ...slotConfig[axis], pitch },
      });
    },
    [slotConfig, setParam]
  );

  const clampPitch = useCallback(
    (value: number) =>
      clamp(value, DESIGNER_CONSTRAINTS.MIN_SLOT_PITCH, DESIGNER_CONSTRAINTS.MAX_SLOT_PITCH),
    []
  );

  // ── Divider piece calculations ──────────────────────────────────────
  const updateDividerPieces = useCallback(
    (updates: Partial<DividerPieceConfig>) => {
      setParam('dividerPieces', { ...dividerPieces, ...updates });
    },
    [dividerPieces, setParam]
  );

  const dividerHeight = useMemo(
    () => calculateDividerPieceHeight(dividerPieces, wallHeight, stackingLip, seatZ),
    [dividerPieces, wallHeight, stackingLip, seatZ]
  );

  // Maximum height when set to 'auto' — used for the stepper max bound
  // so the up button stays enabled when height is below auto.
  const maxDividerHeight = useMemo(
    () => calculateDividerPieceHeight({ height: 'auto' }, wallHeight, stackingLip, seatZ),
    [wallHeight, stackingLip, seatZ]
  );
  const maxHeightRounded = Math.round(maxDividerHeight * 10) / 10;

  const effectiveSlotDepth = getEffectiveSlotDimensions(
    params.wallThickness,
    dividerPieces.thickness,
    dividerPieces.clearance
  ).slotDepth;

  // ── Cross divider mode (both-axes only) ─────────────────────────────
  const requestedCrossStyle: CrossDividerStyle = slotConfig.crossStyle ?? 'lap';
  const longAxis: SlotAxis = slotConfig.longAxis === 'x' ? 'x' : 'y';
  const effectiveCrossMode = resolveCrossDividerMode(slotConfig, dividerPieces.thickness);
  const insertTooThin =
    activeDirection === 'both' &&
    requestedCrossStyle === 'insert' &&
    dividerPieces.thickness < MIN_DIVIDER_FOR_RECEPTACLES;

  const setCrossStyle = useCallback(
    (crossStyle: CrossDividerStyle) => {
      setParam('slotConfig', { ...slotConfig, crossStyle });
    },
    [slotConfig, setParam]
  );

  const setLongAxis = useCallback(
    (axis: SlotAxis) => {
      setParam('slotConfig', { ...slotConfig, longAxis: axis });
    },
    [slotConfig, setParam]
  );

  // ── Partial-length pieces (lap topology only) ───────────────────────
  // ── Layout strategy (even parametric vs custom authored grid) ───────
  const layout: SlotLayout = slotConfig.layout ?? 'even';
  const layouts: SlotLayout[] = ['even', 'custom'];
  const setLayout = useCallback(
    (next: SlotLayout) => {
      const customGrid = slotConfig.customGrid ?? { cols: 2, rows: 2, cells: [0, 1, 2, 3] };
      setParam('slotConfig', {
        ...slotConfig,
        layout: next,
        ...(next === 'custom' ? { customGrid } : {}),
      });
    },
    [slotConfig, setParam]
  );

  const requestedPartialStyle: PartialDividerStyle = slotConfig.partialStyle ?? 'full';
  const effectivePartialStyle = resolvePartialStyle(slotConfig, dividerPieces.thickness);
  // Partial pieces need interlocking cross dividers — a spanning piece rides
  // over crossings via notches, which insert's continuous long dividers lack.
  const partialAvailable = activeDirection === 'both' && effectiveCrossMode.style === 'lap';
  // Snappable needs a printable web; below the floor it degrades to full.
  const snappableTooThin =
    partialAvailable &&
    requestedPartialStyle === 'snappable' &&
    dividerPieces.thickness < MIN_DIVIDER_FOR_SNAP;

  const setPartialStyle = useCallback(
    (partialStyle: PartialDividerStyle) => {
      setParam('slotConfig', { ...slotConfig, partialStyle });
    },
    [slotConfig, setParam]
  );

  // Piece dimension readout entries, per effective mode. Lap/single-axis
  // bins list one full-length piece per enabled axis; insert mode lists
  // the grooved long piece plus the short compartment pieces.
  const pieceLengths = useMemo(() => {
    const fullLength = (axis: SlotAxis): number =>
      calculateDividerLength(
        axis === 'x' ? innerW : innerD,
        effectiveSlotDepth,
        dividerPieces.clearance
      );
    const fullLengthEntries = (): { key: string; length: number }[] =>
      enabledAxes.map((axis) => ({ key: axis, length: fullLength(axis) }));

    if (activeDirection !== 'both' || effectiveCrossMode.style !== 'insert') {
      return fullLengthEntries();
    }

    const effectiveLongAxis = effectiveCrossMode.longAxis;
    const shortAxis: SlotAxis = effectiveLongAxis === 'y' ? 'x' : 'y';
    const shortSpanDim = shortAxis === 'x' ? innerW : innerD;
    const longPositions = calculateSlotPositions(
      shortSpanDim,
      slotConfig[effectiveLongAxis].pitch,
      lipOverhang
    );
    if (longPositions.length === 0) {
      return fullLengthEntries();
    }
    const entries: { key: string; length: number }[] = [
      { key: effectiveLongAxis, length: fullLength(effectiveLongAxis) },
    ];
    // Short pieces only exist where the short axis has rows to seat them
    const rows = calculateSlotPositions(
      effectiveLongAxis === 'y' ? innerD : innerW,
      slotConfig[shortAxis].pitch,
      lipOverhang
    );
    if (rows.length === 0) return entries;

    const spans = calculateShortDividerSpans(longPositions, shortSpanDim, dividerPieces.thickness);
    const lengths = calculateShortDividerLengths(
      spans,
      effectiveSlotDepth,
      getReceptacleDepth(dividerPieces.thickness),
      dividerPieces.clearance
    );
    if (lengths.interior !== null && lengths.interior > 0) {
      entries.push({ key: 'short-interior', length: lengths.interior });
    }
    if (lengths.edge !== null && lengths.edge > 0) {
      entries.push({ key: 'short-edge', length: lengths.edge });
    }
    return entries;
  }, [
    activeDirection,
    effectiveCrossMode,
    enabledAxes,
    slotConfig,
    innerW,
    innerD,
    effectiveSlotDepth,
    dividerPieces.thickness,
    dividerPieces.clearance,
    lipOverhang,
  ]);

  // Length-set piece family summary per axis, for the calculated-dimensions
  // readout. Empty unless the effective partial style is 'lengthSet'.
  const partialSummary = useMemo(() => {
    if (effectivePartialStyle !== 'lengthSet') return [];
    const axes: { axis: SlotAxis; innerDim: number; crossings: number[] }[] = [
      {
        axis: 'x',
        innerDim: innerW,
        crossings: calculateSlotPositions(innerW, slotConfig.y.pitch, lipOverhang),
      },
      {
        axis: 'y',
        innerDim: innerD,
        crossings: calculateSlotPositions(innerD, slotConfig.x.pitch, lipOverhang),
      },
    ];
    return axes.flatMap(({ axis, innerDim, crossings }) => {
      const { segments, dropped } = calculateLapPartialSegments(
        crossings,
        innerDim,
        dividerPieces.thickness,
        effectiveSlotDepth,
        dividerPieces.clearance
      );
      if (segments.length === 0) return [];
      const lengths = segments.map((s) => s.length);
      return [
        {
          axis,
          count: segments.length,
          dropped,
          min: Math.min(...lengths),
          max: Math.max(...lengths),
        },
      ];
    });
  }, [
    effectivePartialStyle,
    innerW,
    innerD,
    slotConfig,
    lipOverhang,
    dividerPieces.thickness,
    dividerPieces.clearance,
    effectiveSlotDepth,
  ]);

  const directions: SlotDirection[] = ['vertical', 'horizontal', 'both'];
  const crossStyles: CrossDividerStyle[] = ['lap', 'insert'];
  const partialStyles: PartialDividerStyle[] = ['full', 'snappable', 'lengthSet'];
  const longAxisOptions: SlotAxis[] = ['y', 'x'];
  const partialStyleLabel = useCallback(
    (style: PartialDividerStyle) =>
      style === 'full'
        ? t('binDesigner.slotPartialFull')
        : style === 'snappable'
          ? t('binDesigner.slotPartialSnappable')
          : t('binDesigner.slotPartialLengthSet'),
    [t]
  );
  const directionLabel = useCallback(
    (direction: SlotDirection) =>
      direction === 'vertical'
        ? t('binDesigner.slotVertical')
        : direction === 'horizontal'
          ? t('binDesigner.slotHorizontal')
          : t('binDesigner.slotBoth'),
    [t]
  );
  const axisLabel = useCallback(
    (axis: SlotAxis) =>
      axis === 'y' ? t('binDesigner.slotVertical') : t('binDesigner.slotHorizontal'),
    [t]
  );
  const wallTooThin = params.wallThickness < MIN_WALL_FOR_SLOTS;

  return {
    slotConfig,
    dividerPieces,
    t,
    activeDirection,
    enabledAxes,
    slotCount,
    setDirection,
    updateAxisPitch,
    clampPitch,
    updateDividerPieces,
    dividerHeight,
    maxDividerHeight,
    maxHeightRounded,
    requestedCrossStyle,
    longAxis,
    insertTooThin,
    setCrossStyle,
    setLongAxis,
    layout,
    layouts,
    setLayout,
    requestedPartialStyle,
    partialAvailable,
    snappableTooThin,
    setPartialStyle,
    pieceLengths,
    partialSummary,
    directions,
    crossStyles,
    partialStyles,
    longAxisOptions,
    partialStyleLabel,
    directionLabel,
    axisLabel,
    wallTooThin,
  };
}
