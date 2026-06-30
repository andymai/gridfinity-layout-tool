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
  getEffectiveSlotDimensions,
  MIN_WALL_FOR_SLOTS,
} from '@/shared/utils/slotMath';
import { clamp } from '@/shared/utils/math';
import { useTranslation } from '@/i18n';
import type { DividerPieceConfig } from '../../types';

type SlotDirection = 'vertical' | 'horizontal';

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
  const activeDirection: SlotDirection = slotConfig.y.enabled ? 'vertical' : 'horizontal';
  const activeAxis = activeDirection === 'vertical' ? 'y' : 'x';
  const activePitch = slotConfig[activeAxis].pitch;
  const activeInnerDim = activeAxis === 'x' ? innerD : innerW;

  const slotCount = useMemo(() => {
    return calculateSlotPositions(activeInnerDim, activePitch, lipOverhang).length;
  }, [activeInnerDim, activePitch, lipOverhang]);

  const setDirection = useCallback(
    (direction: SlotDirection) => {
      if (direction === 'vertical') {
        setParam('slotConfig', {
          ...slotConfig,
          x: { ...slotConfig.x, enabled: false },
          y: { ...slotConfig.y, enabled: true },
        });
      } else {
        setParam('slotConfig', {
          ...slotConfig,
          x: { ...slotConfig.x, enabled: true },
          y: { ...slotConfig.y, enabled: false },
        });
      }
    },
    [slotConfig, setParam]
  );

  const updateActivePitch = useCallback(
    (pitch: number) => {
      setParam('slotConfig', {
        ...slotConfig,
        [activeAxis]: { ...slotConfig[activeAxis], pitch },
      });
    },
    [slotConfig, setParam, activeAxis]
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

  const dividerLength = useMemo(() => {
    if (!slotConfig.x.enabled && !slotConfig.y.enabled) return null;
    const dim = slotConfig.y.enabled ? innerD : innerW;
    return calculateDividerLength(dim, effectiveSlotDepth, dividerPieces.clearance);
  }, [
    slotConfig.x.enabled,
    slotConfig.y.enabled,
    innerW,
    innerD,
    effectiveSlotDepth,
    dividerPieces.clearance,
  ]);

  const directions: SlotDirection[] = ['vertical', 'horizontal'];
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
              {direction === 'vertical'
                ? t('binDesigner.slotVertical')
                : t('binDesigner.slotHorizontal')}
            </Button>
          ))}
        </div>
      </div>

      {/* Slot count summary */}
      <div className="text-xs text-content-tertiary">
        {t('binDesigner.slotCount', { count: slotCount })}
      </div>

      {/* Compartment width */}
      <div>
        <span className="mb-1 block text-xs text-content-tertiary">
          {t('binDesigner.slotSpacing')}
        </span>
        <Stepper
          value={activePitch}
          onChange={(v) => updateActivePitch(clampPitch(v))}
          onStep={(delta) =>
            updateActivePitch(
              clampPitch(activePitch + delta * DESIGNER_CONSTRAINTS.SLOT_PITCH_STEP)
            )
          }
          min={DESIGNER_CONSTRAINTS.MIN_SLOT_PITCH}
          max={DESIGNER_CONSTRAINTS.MAX_SLOT_PITCH}
          step={DESIGNER_CONSTRAINTS.SLOT_PITCH_STEP}
          size="md"
          fullWidth
          aria-label={t('binDesigner.slotSpacing')}
        />
      </div>

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
          {dividerLength !== null
            ? t('binDesigner.dividerDimensions', {
                length: String(Math.round(dividerLength * 10) / 10),
                height: String(Math.round(dividerHeight * 10) / 10),
              })
            : t('binDesigner.dividerHeightOnly', {
                height: String(Math.round(dividerHeight * 10) / 10),
              })}
        </span>
      </div>
    </div>
  );
}
