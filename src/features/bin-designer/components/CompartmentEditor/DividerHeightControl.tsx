/**
 * Global height control for interior compartment dividers.
 *
 * Mirrors the slotted-piece height control: a single stepper that toggles
 * between 'auto' (full interior height) and a numeric millimeter value.
 * A numeric value produces partial-height dividers that rise from the floor
 * and stop short of the rim. Effect is visible in the live 3D preview only
 * (the 2D grid editor is top-down).
 *
 * Uses `commitMode="deferred"` so holding/clicking the stepper batches into a
 * single regeneration — a partial height forces the heavier additive
 * divider-wall path, so per-tick regen would be costly.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { Stepper } from '@/design-system';
import {
  calculateDividerHeight,
  resolveCompartmentDividerHeight,
  MIN_COMPARTMENT_DIVIDER_HEIGHT,
} from '@/shared/utils/slotMath';
import { useTranslation } from '@/i18n';
import { useResponsive } from '@/shared/hooks/useResponsive';

export function DividerHeightControl() {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const stepperSize = isMobile ? 'lg' : 'md';

  const { params, setCompartmentDividerHeight } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      setCompartmentDividerHeight: s.setCompartmentDividerHeight,
    }))
  );

  const { wallHeight } = binDimensions(params);
  const stackingLip = params.base.stackingLip;
  const dividerHeight = params.compartments.dividerHeight;

  // Full interior height — the 'auto' value and the numeric upper bound.
  const maxHeight = useMemo(
    () => calculateDividerHeight({ height: 'auto' }, wallHeight, stackingLip),
    [wallHeight, stackingLip]
  );
  const maxRounded = Math.round(maxHeight * 10) / 10;

  const isAuto = dividerHeight === undefined || dividerHeight === 'auto';
  const currentValue = resolveCompartmentDividerHeight(dividerHeight, maxHeight);

  return (
    <div>
      <span className="mb-1 block text-xs text-content-tertiary">
        {t('binDesigner.dividerHeight')}
      </span>
      <Stepper
        value={currentValue}
        displayValue={
          isAuto ? `${t('binDesigner.dividerAutoHeight')} (${maxRounded}mm)` : undefined
        }
        onChange={(v) => {
          const rounded = Math.round(v * 10) / 10;
          if (rounded >= maxRounded) {
            setCompartmentDividerHeight('auto');
          } else {
            setCompartmentDividerHeight(Math.max(MIN_COMPARTMENT_DIVIDER_HEIGHT, rounded));
          }
        }}
        onStep={(delta) => {
          // From 'auto', only a downward step is meaningful (already at max).
          const base = isAuto ? maxHeight : currentValue;
          if (isAuto && delta > 0) return;
          const next = Math.round((base + delta) * 10) / 10;
          if (next >= maxRounded) {
            setCompartmentDividerHeight('auto');
          } else {
            setCompartmentDividerHeight(Math.max(MIN_COMPARTMENT_DIVIDER_HEIGHT, next));
          }
        }}
        min={MIN_COMPARTMENT_DIVIDER_HEIGHT}
        max={maxRounded}
        step={1}
        size={stepperSize}
        commitMode="deferred"
        fullWidth
        aria-label={t('binDesigner.dividerHeight')}
      />
    </div>
  );
}
