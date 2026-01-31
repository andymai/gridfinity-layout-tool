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
import { StepperControl } from '@/shared/components/StepperControl';
import {
  calculateSlotPositions,
  calculateDividerLength,
  calculateDividerHeight,
} from '@/shared/utils/slotMath';
import { useTranslation } from '@/i18n';
import type { DividerPieceConfig } from '../../types';

type SlotDirection = 'vertical' | 'horizontal';

export function SlotConfigurator() {
  const { slotConfig, dividerPieces, width, depth, height, wallThickness, stackingLip, setParam } =
    useDesignerStore(
      useShallow((s) => ({
        slotConfig: s.params.slotConfig,
        dividerPieces: s.params.dividerPieces,
        width: s.params.width,
        depth: s.params.depth,
        height: s.params.height,
        wallThickness: s.params.wallThickness,
        stackingLip: s.params.base.stackingLip,
        setParam: s.setParam,
      }))
    );
  const t = useTranslation();

  // ── Dimension calculations ──────────────────────────────────────────
  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const wallHeight = totalH - GRIDFINITY.SOCKET_HEIGHT;

  const lipTaperWidth = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;
  const lipOverhang = stackingLip ? Math.max(0, lipTaperWidth - wallThickness) : 0;

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

  const clampPitch = useCallback((value: number) => {
    return Math.min(
      DESIGNER_CONSTRAINTS.MAX_SLOT_PITCH,
      Math.max(DESIGNER_CONSTRAINTS.MIN_SLOT_PITCH, value)
    );
  }, []);

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

  const effectiveSlotDepth = Math.min(1.5, Math.max(0.5, wallThickness * 0.5));

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

  return (
    <div className="space-y-3">
      {/* Direction toggle (compact inline) */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-content-tertiary">{t('binDesigner.slotDirection')}</span>
        <div className="flex gap-0.5">
          {directions.map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => setDirection(direction)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                activeDirection === direction
                  ? 'bg-accent text-white'
                  : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {direction === 'vertical'
                ? t('binDesigner.slotVertical')
                : t('binDesigner.slotHorizontal')}
            </button>
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
        <StepperControl
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
          variant="desktop"
          ariaLabel={t('binDesigner.slotSpacing')}
        />
      </div>

      {/* ── Divider piece settings ─────────────────────────────────── */}

      {/* Height */}
      <div>
        <span className="mb-1 block text-xs text-content-tertiary">
          {t('binDesigner.dividerHeight')}
        </span>
        <StepperControl
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
          variant="desktop"
          ariaLabel={t('binDesigner.dividerHeight')}
        />
      </div>

      {/* Thickness */}
      <div>
        <span className="mb-1 block text-xs text-content-tertiary">
          {t('binDesigner.dividerThickness')}
        </span>
        <StepperControl
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
          variant="desktop"
          ariaLabel={t('binDesigner.dividerThickness')}
        />
      </div>

      {/* Fit tolerance */}
      <div>
        <span className="mb-1 block text-xs text-content-tertiary">
          {t('binDesigner.dividerClearance')}
        </span>
        <StepperControl
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
          variant="desktop"
          ariaLabel={t('binDesigner.dividerClearance')}
        />
      </div>

      {/* Calculated divider dimensions */}
      <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
        <svg
          className="h-3.5 w-3.5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 12h16M4 12v-2M8 12v-1M12 12v-2M16 12v-1M20 12v-2"
          />
        </svg>
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
