/** The lid's height: extra millimetres, or whole height units that keep it level with a taller bin. */

import { useShallow } from 'zustand/react/shallow';
import { SegmentedControl } from '@/design-system';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_EXTRA_HEIGHT_STEP_MM,
} from '@/features/bin-designer/types/lid';
import {
  lidHeightUnitRange,
  lidUnitsCovering,
  syncedLidHeight,
} from '@/features/bin-designer/utils/lidHeightUnits';
import { useTranslation } from '@/i18n';
import { StepperField } from '../shared/StepperField';
import { Hint } from '../shared';

type HeightMode = 'mm' | 'u';

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export function LidHeightField() {
  const t = useTranslation();
  const { params, updateLid } = useDesignerStore(
    useShallow((s) => ({ params: s.params, updateLid: s.updateLid }))
  );
  const { extraHeightMm, heightUnits } = params.lid;
  const range = lidHeightUnitRange(params);
  const units = syncedLidHeight(params)?.effectiveUnits;
  const mode: HeightMode = units !== undefined && range ? 'u' : 'mm';

  const setMode = (next: HeightMode): void => {
    if (next === 'mm') {
      updateLid({ heightUnits: undefined });
      return;
    }
    const covering = lidUnitsCovering(params);
    if (covering !== null) updateLid({ heightUnits: covering });
  };

  // Clears the units too: the field also shows while units are stored but no
  // lid seats, and those units would otherwise overwrite this edit once one does.
  const setExtraHeight = (mm: number): void =>
    updateLid({
      heightUnits: undefined,
      extraHeightMm: clamp(mm, LID_EXTRA_HEIGHT_MIN_MM, LID_EXTRA_HEIGHT_MAX_MM),
    });

  const setUnits = (next: number): void => {
    if (!range) return;
    const clamped = clamp(Math.round(next), range.min, range.max);
    if (clamped !== heightUnits) updateLid({ heightUnits: clamped });
  };

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-2">
        {mode === 'u' && range && units !== undefined ? (
          <StepperField
            label={t('binDesigner.lid.heightUnits')}
            unit="u"
            value={units}
            onChange={setUnits}
            onStep={(delta) => setUnits(units + delta)}
            min={range.min}
            max={range.max}
            step={1}
            inputDecimals={0}
            size="md"
            aria-label={t('binDesigner.lid.heightUnitsAria')}
            commitMode="deferred"
            info={t('binDesigner.lid.heightUnitsDetail')}
          />
        ) : (
          <StepperField
            label={t('binDesigner.lid.extraHeight')}
            unit="mm"
            value={extraHeightMm}
            onChange={setExtraHeight}
            onStep={(delta) => setExtraHeight(extraHeightMm + delta * LID_EXTRA_HEIGHT_STEP_MM)}
            min={LID_EXTRA_HEIGHT_MIN_MM}
            max={LID_EXTRA_HEIGHT_MAX_MM}
            step={LID_EXTRA_HEIGHT_STEP_MM}
            size="md"
            aria-label={t('binDesigner.lid.extraHeightAria')}
            commitMode="deferred"
            info={t('binDesigner.lid.extraHeightHint')}
          />
        )}
        {range && (
          <div className="flex h-8 items-center">
            <SegmentedControl
              size="sm"
              aria-label={t('binDesigner.lid.heightUnitToggle')}
              options={[
                { value: 'mm', label: 'mm' },
                { value: 'u', label: 'u' },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
        )}
      </div>
      {mode === 'u' && units !== undefined && (
        <Hint>{t('binDesigner.lid.heightUnitsHint', { units })}</Hint>
      )}
    </div>
  );
}
