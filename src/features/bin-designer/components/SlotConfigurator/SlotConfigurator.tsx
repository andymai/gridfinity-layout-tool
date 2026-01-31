/**
 * Slot configuration controls for the slotted bin style.
 *
 * Provides a Vertical / Horizontal toggle (mutually exclusive)
 * and spacing control for the active direction.
 *
 * Slot opening width is derived from divider thickness + fit tolerance
 * (configured in DividersSection), so it is not shown here.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS, GRIDFINITY } from '@/features/bin-designer/constants';
import { StepperControl } from '@/shared/components/StepperControl';
import { useTranslation } from '@/i18n';

type SlotDirection = 'vertical' | 'horizontal';

export function SlotConfigurator() {
  const { slotConfig, width, depth, wallThickness, setParam } = useDesignerStore(
    useShallow((s) => ({
      slotConfig: s.params.slotConfig,
      width: s.params.width,
      depth: s.params.depth,
      wallThickness: s.params.wallThickness,
      setParam: s.setParam,
    }))
  );
  const t = useTranslation();

  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;

  // Derive active direction from enabled state
  const activeDirection: SlotDirection = slotConfig.y.enabled ? 'horizontal' : 'vertical';
  const activeAxis = activeDirection === 'vertical' ? 'x' : 'y';
  const activePitch = slotConfig[activeAxis].pitch;
  const activeInnerDim = activeAxis === 'x' ? innerD : innerW;

  const slotCount = useMemo(() => {
    return Math.floor(activeInnerDim / activePitch);
  }, [activeInnerDim, activePitch]);

  const setDirection = useCallback(
    (direction: SlotDirection) => {
      if (direction === 'vertical') {
        setParam('slotConfig', {
          ...slotConfig,
          x: { ...slotConfig.x, enabled: true },
          y: { ...slotConfig.y, enabled: false },
        });
      } else {
        setParam('slotConfig', {
          ...slotConfig,
          x: { ...slotConfig.x, enabled: false },
          y: { ...slotConfig.y, enabled: true },
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

  const directions: SlotDirection[] = ['vertical', 'horizontal'];

  return (
    <div className="space-y-3">
      {/* Direction toggle */}
      <div className="flex gap-1">
        {directions.map((direction) => (
          <button
            key={direction}
            type="button"
            onClick={() => setDirection(direction)}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
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

      {/* Slot count summary */}
      <div className="text-xs text-content-tertiary">
        {t('binDesigner.slotCount', { count: slotCount })}
      </div>

      {/* Spacing */}
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
          ariaLabel="Divider spacing"
        />
      </div>
    </div>
  );
}
