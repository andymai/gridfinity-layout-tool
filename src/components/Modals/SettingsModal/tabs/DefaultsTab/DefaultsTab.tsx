import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { CONSTRAINTS, DEFAULT_CATEGORIES } from '@/core/constants';
import { PRINT_SETTINGS_CONSTRAINTS } from '@/shared/printSettings';
import type { PrintSettings } from '@/shared/printSettings';
import { StepperControl } from '@/shared/components/StepperControl';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useDrawerSettings } from '@/hooks/useDrawerSettings';
import { useTranslation } from '@/i18n';

export function DefaultsTab() {
  const t = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);

  const { settings, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      settings: state.settings,
      updateSetting: state.updateSetting,
    }))
  );

  // Read current layout values for "Copy from current" feature
  const {
    drawer,
    gridUnitMm,
    printBedSize,
    activeLayerHeight,
    currentCategories,
    showSaveCategoriesConfirm,
    setShowSaveCategoriesConfirm,
    handleSaveCategoriesAsDefaults,
    hasCustomCategoryDefaults,
  } = useDrawerSettings();

  const updatePrintSetting = useCallback(
    <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
      updateSetting('printSettings', { ...settings.printSettings, [key]: value });
    },
    [settings.printSettings, updateSetting]
  );

  const handleCopyFromLayout = () => {
    updateSetting('defaultDrawerWidth', drawer.width);
    updateSetting('defaultDrawerDepth', drawer.depth);
    updateSetting('defaultDrawerHeight', drawer.height);
    updateSetting('defaultLayerHeight', activeLayerHeight);
    updateSetting('defaultPrintBedSize', printBedSize);
    updateSetting('defaultGridUnitMm', gridUnitMm);
    setShowCopyConfirm(false);
    addToast(t('settings.copiedFromLayout'), 'success');
  };

  return (
    <div className="space-y-6">
      {/* Dimension Defaults */}
      <section>
        <h3 className="text-base font-semibold text-content mb-1">
          {t('settings.defaultPreferences')}
        </h3>
        <p className="text-xs text-content-tertiary mb-3">{t('settings.defaultPreferencesHint')}</p>

        <div className="text-xs text-content-secondary space-y-3">
          {/* Width / Depth / Height in compact 3-column grid */}
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="block text-content-tertiary mb-1">{t('common.width')}</label>
              <StepperControl
                value={settings.defaultDrawerWidth}
                onChange={(value) =>
                  updateSetting(
                    'defaultDrawerWidth',
                    Math.max(CONSTRAINTS.GRID_MIN, Math.min(CONSTRAINTS.GRID_MAX, value))
                  )
                }
                onStep={(delta) =>
                  updateSetting(
                    'defaultDrawerWidth',
                    Math.max(
                      CONSTRAINTS.GRID_MIN,
                      Math.min(CONSTRAINTS.GRID_MAX, settings.defaultDrawerWidth + delta * 0.5)
                    )
                  )
                }
                min={CONSTRAINTS.GRID_MIN}
                max={CONSTRAINTS.GRID_MAX}
                step={0.5}
                variant="compact"
                ariaLabel={t('common.width')}
              />
            </div>
            <div>
              <label className="block text-content-tertiary mb-1">{t('common.depth')}</label>
              <StepperControl
                value={settings.defaultDrawerDepth}
                onChange={(value) =>
                  updateSetting(
                    'defaultDrawerDepth',
                    Math.max(CONSTRAINTS.GRID_MIN, Math.min(CONSTRAINTS.GRID_MAX, value))
                  )
                }
                onStep={(delta) =>
                  updateSetting(
                    'defaultDrawerDepth',
                    Math.max(
                      CONSTRAINTS.GRID_MIN,
                      Math.min(CONSTRAINTS.GRID_MAX, settings.defaultDrawerDepth + delta * 0.5)
                    )
                  )
                }
                min={CONSTRAINTS.GRID_MIN}
                max={CONSTRAINTS.GRID_MAX}
                step={0.5}
                variant="compact"
                ariaLabel={t('common.depth')}
              />
            </div>
            <div>
              <label className="block text-content-tertiary mb-1">{t('common.height')}</label>
              <StepperControl
                value={settings.defaultDrawerHeight}
                onChange={(value) =>
                  updateSetting(
                    'defaultDrawerHeight',
                    Math.max(1, Math.min(CONSTRAINTS.GRID_MAX, value))
                  )
                }
                onStep={(delta) =>
                  updateSetting(
                    'defaultDrawerHeight',
                    Math.max(
                      1,
                      Math.min(CONSTRAINTS.GRID_MAX, settings.defaultDrawerHeight + delta)
                    )
                  )
                }
                min={1}
                max={CONSTRAINTS.GRID_MAX}
                variant="compact"
                ariaLabel={t('common.height')}
              />
            </div>
          </div>

          {/* Layer Height / Print Bed / Grid Unit as SettingsRow */}
          <SettingsRow
            label={t('settings.defaultLayerHeight')}
            htmlFor="defaultLayerHeight"
            unit="u"
          >
            <DeferredNumberInput
              id="defaultLayerHeight"
              value={settings.defaultLayerHeight}
              onChange={(value) =>
                updateSetting(
                  'defaultLayerHeight',
                  Math.max(CONSTRAINTS.MIN_LAYER_HEIGHT, Math.min(CONSTRAINTS.GRID_MAX, value))
                )
              }
              min={CONSTRAINTS.MIN_LAYER_HEIGHT}
              max={CONSTRAINTS.GRID_MAX}
              className="input w-14 py-0.5 px-1 text-xs text-right"
            />
          </SettingsRow>
          <SettingsRow
            label={t('settings.defaultPrintBedSize')}
            htmlFor="defaultPrintBed"
            unit="mm"
          >
            <DeferredNumberInput
              id="defaultPrintBed"
              value={settings.defaultPrintBedSize}
              onChange={(value) =>
                updateSetting('defaultPrintBedSize', Math.max(42, Math.min(500, value)))
              }
              min={42}
              max={500}
              step={10}
              className="input w-14 py-0.5 px-1 text-xs text-right"
            />
          </SettingsRow>
          <SettingsRow label={t('settings.defaultGridUnit')} htmlFor="defaultGridUnit" unit="mm">
            <DeferredNumberInput
              id="defaultGridUnit"
              value={settings.defaultGridUnitMm}
              onChange={(value) =>
                updateSetting('defaultGridUnitMm', Math.max(1, Math.min(200, value)))
              }
              min={1}
              max={200}
              className="input w-14 py-0.5 px-1 text-xs text-right"
            />
          </SettingsRow>
        </div>

        {/* Copy from current layout */}
        <button
          onClick={() => setShowCopyConfirm(true)}
          className="w-full mt-4 text-sm py-2 px-3 rounded-lg bg-surface-elevated hover:bg-surface-hover text-content-secondary hover:text-content border border-stroke-subtle transition-colors"
        >
          {t('settings.copyFromCurrentLayout')}
        </button>
      </section>

      {/* Divider */}
      <hr className="border-stroke-subtle" />

      {/* Print Estimates Section */}
      <section>
        <h3 className="text-base font-semibold text-content mb-1">
          {t('settings.printEstimates')}
        </h3>
        <p className="text-xs text-content-tertiary mb-3">{t('settings.printEstimatesHint')}</p>

        <div className="text-xs text-content-secondary space-y-3">
          <SettingsRow
            label={t('settings.filamentCostPerKg')}
            htmlFor="filamentCostPerKg"
            unit="$/kg"
          >
            <DeferredNumberInput
              id="filamentCostPerKg"
              value={settings.printSettings.filamentCostPerKg}
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
              className="input w-14 py-0.5 px-1 text-xs text-right"
            />
          </SettingsRow>
          <SettingsRow label={t('settings.printLayerHeight')} htmlFor="printLayerHeight" unit="mm">
            <DeferredNumberInput
              id="printLayerHeight"
              value={settings.printSettings.layerHeightMm}
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
              className="input w-14 py-0.5 px-1 text-xs text-right"
            />
          </SettingsRow>
          <SettingsRow label={t('settings.infillPercent')} htmlFor="infillPercent" unit="%">
            <DeferredNumberInput
              id="infillPercent"
              value={settings.printSettings.infillPercent}
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
              className="input w-14 py-0.5 px-1 text-xs text-right"
            />
          </SettingsRow>
          <SettingsRow label={t('settings.nozzleSize')} htmlFor="nozzleSize" unit="mm">
            <DeferredNumberInput
              id="nozzleSize"
              value={settings.printSettings.nozzleSizeMm}
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
              className="input w-14 py-0.5 px-1 text-xs text-right"
            />
          </SettingsRow>
        </div>
      </section>

      {/* Divider */}
      <hr className="border-stroke-subtle" />

      {/* Default Categories Section */}
      <section>
        <h3 className="text-base font-semibold text-content mb-1">
          {t('settings.defaultCategories')}
        </h3>
        <p className="text-xs text-content-tertiary mb-3">{t('settings.defaultCategoriesHint')}</p>
        <div className="text-sm text-content-secondary mb-4 p-3 rounded-lg bg-surface-elevated border border-stroke-subtle">
          <div className="text-xs text-content-tertiary mb-2">
            {hasCustomCategoryDefaults
              ? t('settings.usingCustomCategories', {
                  count: settings.defaultCategories?.length ?? 0,
                })
              : t('settings.usingBuiltInCategories', { count: DEFAULT_CATEGORIES.length })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(settings.defaultCategories ?? DEFAULT_CATEGORIES).map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-hover"
              >
                <span
                  className="w-3 h-3 rounded-sm shadow-sm flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs text-content-secondary truncate max-w-[80px]">
                  {cat.name}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSaveCategoriesConfirm(true)}
            className="flex-1 text-sm py-2 px-3 rounded-lg bg-surface-elevated hover:bg-surface-hover text-content-secondary hover:text-content border border-stroke-subtle transition-colors"
          >
            {t('settings.saveCategoriesAsDefaults')}
          </button>
          {hasCustomCategoryDefaults && (
            <button
              onClick={() => updateSetting('defaultCategories', null)}
              className="text-sm py-2 px-3 rounded-lg text-content-tertiary hover:text-content hover:bg-surface-hover border border-stroke-subtle transition-colors"
            >
              {t('settings.resetToBuiltIn')}
            </button>
          )}
        </div>
      </section>

      {/* Copy from current layout confirmation */}
      <ConfirmDialog
        isOpen={showCopyConfirm}
        title={t('settings.confirmCopyFromLayout.title')}
        message={t('settings.confirmCopyFromLayout.message', {
          width: drawer.width,
          depth: drawer.depth,
          height: drawer.height,
          layerHeight: activeLayerHeight,
          printBed: printBedSize,
          gridUnit: gridUnitMm,
        })}
        confirmText={t('settings.confirmCopyFromLayout.confirm')}
        onConfirm={handleCopyFromLayout}
        onCancel={() => setShowCopyConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showSaveCategoriesConfirm}
        title={t('settings.confirmSaveCategories.title')}
        message={`${t('settings.confirmSaveCategories.message', {
          count: currentCategories.length,
        })}\n\n${currentCategories.map((c) => c.name).join(', ')}`}
        confirmText={t('common.save')}
        onConfirm={handleSaveCategoriesAsDefaults}
        onCancel={() => setShowSaveCategoriesConfirm(false)}
      />
    </div>
  );
}
