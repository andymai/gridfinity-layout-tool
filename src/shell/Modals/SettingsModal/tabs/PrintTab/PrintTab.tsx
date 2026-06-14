import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { PRINT_SETTINGS_CONSTRAINTS } from '@/shared/printSettings';
import type { PrintSettings } from '@/shared/printSettings';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { useTranslation } from '@/i18n';
import { SettingSection } from '../../components/SettingSection/SettingSection';

export function PrintTab() {
  const t = useTranslation();

  const { printSettings, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      printSettings: state.settings.printSettings,
      updateSetting: state.updateSetting,
    }))
  );

  const updatePrintSetting = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
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
          <SettingsRow
            label={t('settings.filamentCostPerKg')}
            htmlFor="filamentCostPerKg"
            unit="$/kg"
          >
            <DeferredNumberInput
              id="filamentCostPerKg"
              value={printSettings.filamentCostPerKg}
              onChange={(value) =>
                updatePrintSetting(
                  'filamentCostPerKg',
                  Math.max(
                    PRINT_SETTINGS_CONSTRAINTS.COST_MIN,
                    Math.min(PRINT_SETTINGS_CONSTRAINTS.COST_MAX, value)
                  )
                )
              }
              min={PRINT_SETTINGS_CONSTRAINTS.COST_MIN}
              max={PRINT_SETTINGS_CONSTRAINTS.COST_MAX}
              step={PRINT_SETTINGS_CONSTRAINTS.COST_STEP}
              className="input w-14 px-1 py-0.5 text-right text-xs"
            />
          </SettingsRow>
          <SettingsRow label={t('settings.printLayerHeight')} htmlFor="printLayerHeight" unit="mm">
            <DeferredNumberInput
              id="printLayerHeight"
              value={printSettings.layerHeightMm}
              onChange={(value) =>
                updatePrintSetting(
                  'layerHeightMm',
                  Math.max(
                    PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_MIN,
                    Math.min(PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_MAX, value)
                  )
                )
              }
              min={PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_MIN}
              max={PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_MAX}
              step={PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_STEP}
              className="input w-14 px-1 py-0.5 text-right text-xs"
            />
          </SettingsRow>
          <SettingsRow label={t('settings.infillPercent')} htmlFor="infillPercent" unit="%">
            <DeferredNumberInput
              id="infillPercent"
              value={printSettings.infillPercent}
              onChange={(value) =>
                updatePrintSetting(
                  'infillPercent',
                  Math.max(
                    PRINT_SETTINGS_CONSTRAINTS.INFILL_MIN,
                    Math.min(PRINT_SETTINGS_CONSTRAINTS.INFILL_MAX, value)
                  )
                )
              }
              min={PRINT_SETTINGS_CONSTRAINTS.INFILL_MIN}
              max={PRINT_SETTINGS_CONSTRAINTS.INFILL_MAX}
              step={PRINT_SETTINGS_CONSTRAINTS.INFILL_STEP}
              className="input w-14 px-1 py-0.5 text-right text-xs"
            />
          </SettingsRow>
          <SettingsRow label={t('settings.nozzleSize')} htmlFor="nozzleSize" unit="mm">
            <DeferredNumberInput
              id="nozzleSize"
              value={printSettings.nozzleSizeMm}
              onChange={(value) =>
                updatePrintSetting(
                  'nozzleSizeMm',
                  Math.max(
                    PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MIN,
                    Math.min(PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MAX, value)
                  )
                )
              }
              min={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MIN}
              max={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MAX}
              step={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_STEP}
              className="input w-14 px-1 py-0.5 text-right text-xs"
            />
          </SettingsRow>
        </div>
      </SettingSection>
    </div>
  );
}
