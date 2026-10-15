/** The lid's height: extra millimetres, or whole height units that keep it level with a taller bin. */

import { useShallow } from 'zustand/react/shallow';
import { SegmentedControl } from '@/design-system';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_EXTRA_HEIGHT_STEP_MM,
} from '@/features/bin-designer/types/lid';
import { lidHeightUnitRange, lidUnitsCovering } from '@/features/bin-designer/utils/lidHeightUnits';
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
  const mode: HeightMode = heightUnits !== undefined && range ? 'u' : 'mm';

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

  const setUnits = (units: number): void => {
    if (!range) return;
    const next = clamp(Math.round(units), range.min, range.max);
    if (next !== heightUnits) updateLid({ heightUnits: next });
  };

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-2">
        {mode === 'u' && range && heightUnits !== undefined ? (
          <StepperField
            label={t('binDesigner.lid.heightUnits')}
            unit="u"
            value={heightUnits}
            onChange={setUnits}
            onStep={(delta) => setUnits(heightUnits + delta)}
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
      {mode === 'u' && heightUnits !== undefined && (
        <Hint>{t('binDesigner.lid.heightUnitsHint', { units: heightUnits })}</Hint>
      )}
    </div>
  );
}
