/**
 * Slot configuration controls for the slotted bin style.
 *
 * Combines direction/spacing controls with divider piece settings
 * (height, thickness, clearance) so all removable-divider configuration
 * lives in a single panel section.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS, GRIDFINITY } from '@/features/bin-designer/constants';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { Button, Stepper } from '@/design-system';
import { RulerIcon } from '@/design-system/Icon';
import {
  calculateSlotPositions,
  calculateDividerLength,
  calculateDividerHeight,
  calculateShortDividerLengths,
  calculateShortDividerSpans,
  getEffectiveSlotDimensions,
  getReceptacleDepth,
  resolveCrossDividerMode,
  MIN_DIVIDER_FOR_RECEPTACLES,
  MIN_WALL_FOR_SLOTS,
} from '@/shared/utils/slotMath';
import { clamp } from '@/shared/utils/math';
import { useTranslation } from '@/i18n';
import type { CrossDividerStyle, DividerPieceConfig } from '../../types';

type SlotDirection = 'vertical' | 'horizontal' | 'both';
type SlotAxis = 'x' | 'y';

export function SlotConfigurator() {
  const { params, setParam } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      setParam: s.setParam,
    }))
  );
  const { slotConfig, dividerPieces } = params;
  const stackingLip = params.base.stackingLip;
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
    () => calculateDividerHeight(dividerPieces, wallHeight, stackingLip),
    [dividerPieces, wallHeight, stackingLip]
  );

  // Maximum height when set to 'auto' — used for the stepper max bound
  // so the up button stays enabled when height is below auto.
  const maxDividerHeight = useMemo(
    () => calculateDividerHeight({ height: 'auto' }, wallHeight, stackingLip),
    [wallHeight, stackingLip]
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

  const directions: SlotDirection[] = ['vertical', 'horizontal', 'both'];
  const crossStyles: CrossDividerStyle[] = ['lap', 'insert'];
  const longAxisOptions: SlotAxis[] = ['y', 'x'];
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

  return (
    <div className="space-y-3">
      {wallTooThin && (
        <p className="rounded bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
          {t('binDesigner.slotWallTooThin', { min: MIN_WALL_FOR_SLOTS })}
        </p>
      )}
      {/* Direction toggle (compact inline) */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-content-tertiary">{t('binDesigner.slotDirection')}</span>
        <div className="flex gap-0.5">
          {directions.map((direction) => (
            <Button
              key={direction}
              type="button"
              variant="ghost"
              onClick={() => setDirection(direction)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                activeDirection === direction
                  ? 'bg-accent text-on-accent hover:bg-accent'
                  : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {directionLabel(direction)}
            </Button>
          ))}
        </div>
      </div>

      {/* Cross divider style (both directions only) */}
      {activeDirection === 'both' && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-content-tertiary">{t('binDesigner.slotCrossStyle')}</span>
            <div className="flex gap-0.5">
              {crossStyles.map((style) => (
                <Button
                  key={style}
                  type="button"
                  variant="ghost"
                  onClick={() => setCrossStyle(style)}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    requestedCrossStyle === style
                      ? 'bg-accent text-on-accent hover:bg-accent'
                      : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                  }`}
                >
                  {style === 'lap'
                    ? t('binDesigner.slotCrossLap')
                    : t('binDesigner.slotCrossInsert')}
                </Button>
              ))}
            </div>
          </div>
          {requestedCrossStyle === 'insert' && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-content-tertiary">
                {t('binDesigner.slotLongDirection')}
              </span>
              <div className="flex gap-0.5">
                {longAxisOptions.map((axis) => (
                  <Button
                    key={axis}
                    type="button"
                    variant="ghost"
                    onClick={() => setLongAxis(axis)}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      longAxis === axis
                        ? 'bg-accent text-on-accent hover:bg-accent'
                        : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {axisLabel(axis)}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {insertTooThin && (
            <p className="rounded bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
              {t('binDesigner.slotInsertTooThin', { min: MIN_DIVIDER_FOR_RECEPTACLES })}
            </p>
          )}
        </>
      )}

      {/* Slot count summary */}
      <div className="text-xs text-content-tertiary">
        {t('binDesigner.slotCount', { count: slotCount })}
      </div>

      {/* Compartment width (one control per enabled direction) */}
      {enabledAxes.map((axis) => {
        const label =
          enabledAxes.length > 1
            ? `${t('binDesigner.slotSpacing')} — ${axisLabel(axis)}`
            : t('binDesigner.slotSpacing');
        return (
          <div key={axis}>
            <span className="mb-1 block text-xs text-content-tertiary">{label}</span>
            <Stepper
              value={slotConfig[axis].pitch}
              onChange={(v) => updateAxisPitch(axis, clampPitch(v))}
              onStep={(delta) =>
                updateAxisPitch(
                  axis,
                  clampPitch(slotConfig[axis].pitch + delta * DESIGNER_CONSTRAINTS.SLOT_PITCH_STEP)
                )
              }
              min={DESIGNER_CONSTRAINTS.MIN_SLOT_PITCH}
              max={DESIGNER_CONSTRAINTS.MAX_SLOT_PITCH}
              step={DESIGNER_CONSTRAINTS.SLOT_PITCH_STEP}
              size="md"
              fullWidth
              aria-label={label}
            />
          </div>
        );
      })}

      {/* ── Divider piece settings ─────────────────────────────────── */}

      {/* Height */}
      <div>
        <span className="mb-1 block text-xs text-content-tertiary">
          {t('binDesigner.dividerHeight')}
        </span>
        <Stepper
          value={dividerPieces.height === 'auto' ? maxDividerHeight : dividerPieces.height}
          displayValue={
            dividerPieces.height === 'auto'
              ? `${t('binDesigner.dividerAutoHeight')} (${maxHeightRounded}mm)`
              : undefined
          }
          onChange={(v) => {
            const rounded = Math.round(v * 10) / 10;
            if (rounded >= maxHeightRounded) {
              updateDividerPieces({ height: 'auto' });
            } else {
              updateDividerPieces({ height: Math.max(5, rounded) });
            }
          }}
          onStep={(delta) => {
            if (dividerPieces.height === 'auto') {
              if (delta < 0) {
                updateDividerPieces({
                  height: Math.round((maxDividerHeight + delta) * 10) / 10,
                });
              }
            } else {
              const next = Math.round((dividerPieces.height + delta) * 10) / 10;
              if (next >= maxHeightRounded) {
                updateDividerPieces({ height: 'auto' });
              } else {
                updateDividerPieces({ height: Math.max(5, next) });
              }
            }
          }}
          min={5}
          max={maxHeightRounded}
          step={1}
          size="md"
          fullWidth
          aria-label={t('binDesigner.dividerHeight')}
        />
      </div>

      {/* Thickness + Fit tolerance side by side */}
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.dividerThickness')}
          </span>
          <Stepper
            value={dividerPieces.thickness}
            onChange={(v) =>
              updateDividerPieces({
                thickness: Math.min(
                  DESIGNER_CONSTRAINTS.MAX_DIVIDER_THICKNESS,
                  Math.max(DESIGNER_CONSTRAINTS.MIN_DIVIDER_THICKNESS, v)
                ),
              })
            }
            onStep={(delta) =>
              updateDividerPieces({
                thickness: Math.min(
                  DESIGNER_CONSTRAINTS.MAX_DIVIDER_THICKNESS,
                  Math.max(
                    DESIGNER_CONSTRAINTS.MIN_DIVIDER_THICKNESS,
                    Math.round(
                      (dividerPieces.thickness +
                        delta * DESIGNER_CONSTRAINTS.DIVIDER_THICKNESS_STEP) *
                        10
                    ) / 10
                  )
                ),
              })
            }
            min={DESIGNER_CONSTRAINTS.MIN_DIVIDER_THICKNESS}
            max={DESIGNER_CONSTRAINTS.MAX_DIVIDER_THICKNESS}
            step={DESIGNER_CONSTRAINTS.DIVIDER_THICKNESS_STEP}
            size="md"
            aria-label={t('binDesigner.dividerThickness')}
          />
        </div>
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.dividerClearance')}
          </span>
          <Stepper
            value={dividerPieces.clearance}
            onChange={(v) =>
              updateDividerPieces({
                clearance: Math.min(
                  DESIGNER_CONSTRAINTS.MAX_DIVIDER_CLEARANCE,
                  Math.max(DESIGNER_CONSTRAINTS.MIN_DIVIDER_CLEARANCE, v)
                ),
              })
            }
            onStep={(delta) =>
              updateDividerPieces({
                clearance: Math.min(
                  DESIGNER_CONSTRAINTS.MAX_DIVIDER_CLEARANCE,
                  Math.max(
                    DESIGNER_CONSTRAINTS.MIN_DIVIDER_CLEARANCE,
                    Math.round(
                      (dividerPieces.clearance +
                        delta * DESIGNER_CONSTRAINTS.DIVIDER_CLEARANCE_STEP) *
                        100
                    ) / 100
                  )
                ),
              })
            }
            min={DESIGNER_CONSTRAINTS.MIN_DIVIDER_CLEARANCE}
            max={DESIGNER_CONSTRAINTS.MAX_DIVIDER_CLEARANCE}
            step={DESIGNER_CONSTRAINTS.DIVIDER_CLEARANCE_STEP}
            size="md"
            aria-label={t('binDesigner.dividerClearance')}
          />
        </div>
      </div>

      {/* Calculated divider dimensions */}
      <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
        <RulerIcon size="xs" />
        <span className="tabular-nums">
          {pieceLengths.length > 0
            ? pieceLengths
                .map(({ key, length }) => {
                  const dims = t('binDesigner.dividerDimensions', {
                    length: String(Math.round(length * 10) / 10),
                    height: String(Math.round(dividerHeight * 10) / 10),
                  });
                  if (pieceLengths.length === 1) return dims;
                  const label =
                    key === 'short-interior'
                      ? t('binDesigner.dividerShortInterior')
                      : key === 'short-edge'
                        ? t('binDesigner.dividerShortEdge')
                        : axisLabel(key as SlotAxis);
                  return `${label}: ${dims}`;
                })
                .join(' · ')
            : t('binDesigner.dividerHeightOnly', {
                height: String(Math.round(dividerHeight * 10) / 10),
              })}
        </span>
      </div>
    </div>
  );
}
