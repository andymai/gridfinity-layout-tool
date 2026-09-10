/**
 * Slot configuration controls for the slotted bin style.
 *
 * Combines direction/spacing controls with divider piece settings
 * (height, thickness, clearance) so all removable-divider configuration
 * lives in a single panel section.
 */

import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { Button, Stepper, Switch } from '@/design-system';
import { RulerIcon } from '@/design-system/Icon';
import {
  DIVIDER_FLOOR_GROOVE_DEPTH,
  MIN_DIVIDER_FOR_RECEPTACLES,
  MIN_DIVIDER_FOR_SNAP,
  MIN_WALL_FOR_SLOTS,
} from '@/shared/utils/slotMath';
import { CustomGridEditor } from './CustomGridEditor';
import { useSlotConfigurator } from './useSlotConfigurator';
import type { SlotAxis } from './useSlotConfigurator';

export function SlotConfigurator() {
  const {
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
  } = useSlotConfigurator();

  return (
    <div className="space-y-3">
      {wallTooThin && (
        <p className="rounded bg-warning/10 px-2 py-1.5 text-label text-warning">
          {t('binDesigner.slotWallTooThin', { min: MIN_WALL_FOR_SLOTS })}
        </p>
      )}

      {/* Layout: even spacing vs custom authored grid */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-content-tertiary">{t('binDesigner.slotLayout')}</span>
        <div className="flex gap-0.5">
          {layouts.map((l) => (
            <Button
              key={l}
              type="button"
              variant="ghost"
              onClick={() => setLayout(l)}
              className={`rounded px-2 py-0.5 text-label font-medium transition-colors ${
                layout === l
                  ? 'bg-accent text-on-accent hover:bg-accent'
                  : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {l === 'even' ? t('binDesigner.slotLayoutEven') : t('binDesigner.slotLayoutCustom')}
            </Button>
          ))}
        </div>
      </div>

      {layout === 'custom' && <CustomGridEditor />}

      {layout === 'even' && (
        <>
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
                  className={`rounded px-2 py-0.5 text-label font-medium transition-colors ${
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
                <span className="text-xs text-content-tertiary">
                  {t('binDesigner.slotCrossStyle')}
                </span>
                <div className="flex gap-0.5">
                  {crossStyles.map((style) => (
                    <Button
                      key={style}
                      type="button"
                      variant="ghost"
                      onClick={() => setCrossStyle(style)}
                      className={`rounded px-2 py-0.5 text-label font-medium transition-colors ${
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
                        className={`rounded px-2 py-0.5 text-label font-medium transition-colors ${
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
                <p className="rounded bg-warning/10 px-2 py-1.5 text-label text-warning">
                  {t('binDesigner.slotInsertTooThin', { min: MIN_DIVIDER_FOR_RECEPTACLES })}
                </p>
              )}

              {/* Partial-length pieces (interlocking cross dividers only) */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-content-tertiary">
                  {t('binDesigner.slotPartialStyle')}
                </span>
                <div className="flex gap-0.5">
                  {partialStyles.map((style) => {
                    const active = partialAvailable
                      ? requestedPartialStyle === style
                      : style === 'full';
                    return (
                      <Button
                        key={style}
                        type="button"
                        variant="ghost"
                        disabled={!partialAvailable}
                        onClick={() => setPartialStyle(style)}
                        className={`rounded px-2 py-0.5 text-label font-medium transition-colors ${
                          active
                            ? 'bg-accent text-on-accent hover:bg-accent'
                            : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                        } ${partialAvailable ? '' : 'opacity-40'}`}
                      >
                        {partialStyleLabel(style)}
                      </Button>
                    );
                  })}
                </div>
              </div>
              {!partialAvailable && (
                <p className="text-label text-content-tertiary">
                  {t('binDesigner.slotPartialNeedsLap')}
                </p>
              )}
              {snappableTooThin && (
                <p className="rounded bg-warning/10 px-2 py-1.5 text-label text-warning">
                  {t('binDesigner.slotSnapTooThin', { min: MIN_DIVIDER_FOR_SNAP })}
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
                      clampPitch(
                        slotConfig[axis].pitch + delta * DESIGNER_CONSTRAINTS.SLOT_PITCH_STEP
                      )
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
        </>
      )}

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

      {/* Floor groove */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-xs text-content-tertiary">
            {t('binDesigner.dividerFloorGroove')}
          </span>
          <p className="mt-0.5 text-xs text-content-tertiary">
            {t('binDesigner.dividerFloorGrooveHint', {
              depth: String(DIVIDER_FLOOR_GROOVE_DEPTH),
            })}
          </p>
        </div>
        <Switch
          checked={dividerPieces.floorGroove}
          onChange={(next) => updateDividerPieces({ floorGroove: next })}
          size="sm"
          aria-label={t('binDesigner.dividerFloorGroove')}
        />
      </div>

      {/* Calculated divider dimensions (parametric readout; custom shows its own) */}
      {layout === 'even' && (
        <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
          <RulerIcon size="xs" />
          <span className="tabular-nums">
            {partialSummary.length > 0
              ? partialSummary
                  .map(({ axis, count, dropped, min, max }) => {
                    const summary = t('binDesigner.slotPartialSummary', {
                      count,
                      min: String(Math.round(min * 10) / 10),
                      max: String(Math.round(max * 10) / 10),
                      height: String(Math.round(dividerHeight * 10) / 10),
                    });
                    const capped =
                      dropped > 0
                        ? ` (${t('binDesigner.slotPartialCapped', { count: dropped })})`
                        : '';
                    return `${axisLabel(axis)}: ${summary}${capped}`;
                  })
                  .join(' · ')
              : pieceLengths.length > 0
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
      )}
    </div>
  );
}
