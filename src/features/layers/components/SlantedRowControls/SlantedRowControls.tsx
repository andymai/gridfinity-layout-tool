/**
 * Slanted row mode for the size brush: a paint drag fills its area with rows
 * that lean one way, each ending on an end support, every bin linked to one
 * design. Shown with the `slant` labs flag on, or while the mode is set, so
 * it can be turned off.
 */

import { useShallow } from 'zustand/react/shallow';
import { useInteractionStore } from '@/core/store';
import { SLANT_MAX_DEG } from '@/core/types';
import type { SlantSide } from '@/core/types';
import { CheckboxRow, SegmentedControl, Stepper } from '@/design-system';
import type { SegmentedControlOption } from '@/design-system';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useTranslation } from '@/i18n';

const SIDES: readonly SlantSide[] = ['back', 'front', 'left', 'right'];
const DEFAULT_ANGLE_DEG = 45;
const MIN_ANGLE_DEG = 1;
const ANGLE_STEP_DEG = 5;

export function SlantedRowControls({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const t = useTranslation();
  const labsOn = useFeatureFlag('slant');
  const { paintSlant, setPaintSlant } = useInteractionStore(
    useShallow((s) => ({ paintSlant: s.paintSlant, setPaintSlant: s.setPaintSlant }))
  );
  if (!labsOn && !paintSlant) return null;

  const setAngle = (deg: number): void => {
    if (!paintSlant || !Number.isFinite(deg)) return;
    const angleDeg = Math.min(SLANT_MAX_DEG, Math.max(MIN_ANGLE_DEG, Math.round(deg)));
    setPaintSlant({ ...paintSlant, angleDeg });
  };
  const sides: SegmentedControlOption<SlantSide>[] = SIDES.map((side) => ({
    value: side,
    label: t(`binDesigner.overhang.side.${side}`),
  }));

  return (
    <div data-testid="slanted-row-controls">
      <CheckboxRow
        label={t('layers.slantedRow.title')}
        checked={paintSlant !== null}
        onChange={(on) => setPaintSlant(on ? { angleDeg: DEFAULT_ANGLE_DEG, side: 'back' } : null)}
      />
      <p className="mt-1 px-2 text-micro leading-snug text-content-disabled">
        {t('layers.slantedRow.hint')}
      </p>
      {paintSlant && (
        <div className="mt-2 flex flex-col gap-2 px-2">
          <Stepper
            value={paintSlant.angleDeg}
            onChange={setAngle}
            onStep={(delta) => setAngle(paintSlant.angleDeg + delta * ANGLE_STEP_DEG)}
            min={MIN_ANGLE_DEG}
            max={SLANT_MAX_DEG}
            step={1}
            size={size}
            fullWidth
            aria-label={t('binDesigner.slant.angleAria')}
          />
          <SegmentedControl
            options={sides}
            value={paintSlant.side}
            onChange={(side) => setPaintSlant({ ...paintSlant, side })}
            aria-label={t('binDesigner.slant.side')}
            size="sm"
            fullWidth
          />
        </div>
      )}
    </div>
  );
}
