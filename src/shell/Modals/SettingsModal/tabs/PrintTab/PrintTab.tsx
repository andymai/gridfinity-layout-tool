import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { PRINT_SETTINGS_CONSTRAINTS } from '@/shared/printSettings';
import type { PrintSettings } from '@/shared/printSettings';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { Stepper } from '@/design-system';
import { clamp } from '@/shared/utils/math';
import { useTranslation } from '@/i18n';
import { SettingSection } from '../../components/SettingSection/SettingSection';

type NumericPrintKey = 'filamentCostPerKg' | 'layerHeightMm' | 'infillPercent' | 'nozzleSizeMm';

interface PrintFieldConfig {
  key: NumericPrintKey;
  labelKey: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
}

const PRINT_FIELDS: PrintFieldConfig[] = [
  {
    key: 'filamentCostPerKg',
    labelKey: 'settings.filamentCostPerKg',
    unit: '$/kg',
    min: PRINT_SETTINGS_CONSTRAINTS.COST_MIN,
    max: PRINT_SETTINGS_CONSTRAINTS.COST_MAX,
    step: PRINT_SETTINGS_CONSTRAINTS.COST_STEP,
    decimals: 0,
  },
  {
    key: 'layerHeightMm',
    labelKey: 'settings.printLayerHeight',
    unit: 'mm',
    min: PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_MIN,
    max: PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_MAX,
    step: PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_STEP,
    decimals: 2,
  },
  {
    key: 'infillPercent',
    labelKey: 'settings.infillPercent',
    unit: '%',
    min: PRINT_SETTINGS_CONSTRAINTS.INFILL_MIN,
    max: PRINT_SETTINGS_CONSTRAINTS.INFILL_MAX,
    step: PRINT_SETTINGS_CONSTRAINTS.INFILL_STEP,
    decimals: 0,
  },
  {
    key: 'nozzleSizeMm',
    labelKey: 'settings.nozzleSize',
    unit: 'mm',
    min: PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MIN,
    max: PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MAX,
    step: PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_STEP,
    decimals: 1,
  },
];

// Round to the field's precision before clamping so stepping fractional values
// (e.g. 0.08 + 0.04) doesn't accumulate floating-point drift.
const clampRound = (value: number, min: number, max: number, decimals: number): number => {
  const rounded = Number(value.toFixed(decimals));
  return clamp(rounded, min, max);
};

export function PrintTab() {
  const t = useTranslation();

  const { printSettings, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      printSettings: state.settings.printSettings,
      updateSetting: state.updateSetting,
    }))
  );

  const setPrintValue = (key: NumericPrintKey, value: PrintSettings[NumericPrintKey]) => {
    updateSetting('printSettings', { ...printSettings, [key]: value });
  };

  return (
    <div className="space-y-6">
      <SettingSection
        id="print-estimates"
        title={t('settings.printEstimates')}
        hint={t('settings.printEstimatesHint')}
        resetKeys={['printSettings']}
      >
        <div className="space-y-3 text-xs text-content-secondary">
          {PRINT_FIELDS.map((field) => {
            const value = printSettings[field.key];
            return (
              <SettingsRow key={field.key} label={t(field.labelKey)} unit={field.unit}>
                <Stepper
                  size="sm"
                  value={value}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  inputDecimals={field.decimals}
                  onChange={(next) =>
                    setPrintValue(field.key, clampRound(next, field.min, field.max, field.decimals))
                  }
                  onStep={(delta) =>
                    setPrintValue(
                      field.key,
                      clampRound(value + delta * field.step, field.min, field.max, field.decimals)
                    )
                  }
                  aria-label={t(field.labelKey)}
                />
              </SettingsRow>
            );
          })}
        </div>
      </SettingSection>
    </div>
  );
}
