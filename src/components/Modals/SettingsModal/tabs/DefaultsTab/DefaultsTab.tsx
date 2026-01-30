import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useSettingsStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { DEFAULT_SETTINGS } from '@/core/store/settings';
import { CONSTRAINTS, DEFAULT_CATEGORIES } from '@/core/constants';
import { StepperControl } from '@/shared/components/StepperControl';
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

  const handleCopyFromLayout = () => {
    updateSetting('defaultDrawerWidth', drawer.width);
    updateSetting('defaultDrawerDepth', drawer.depth);
    updateSetting('defaultDrawerHeight', drawer.height);
    updateSetting('defaultLayerHeight', activeLayerHeight);
    updateSetting('defaultPrintBedSize', printBedSize);
    updateSetting('defaultGridUnitMm', gridUnitMm);
    setShowCopyConfirm(false);
    addToast(t('settings.resetDefaults'), 'success');
  };

  const handleReset = () => {
    updateSetting('defaultDrawerWidth', DEFAULT_SETTINGS.defaultDrawerWidth);
    updateSetting('defaultDrawerDepth', DEFAULT_SETTINGS.defaultDrawerDepth);
    updateSetting('defaultDrawerHeight', DEFAULT_SETTINGS.defaultDrawerHeight);
    updateSetting('defaultLayerHeight', DEFAULT_SETTINGS.defaultLayerHeight);
    updateSetting('defaultPrintBedSize', DEFAULT_SETTINGS.defaultPrintBedSize);
    updateSetting('defaultGridUnitMm', DEFAULT_SETTINGS.defaultGridUnitMm);
    updateSetting('defaultCategories', null);
    addToast(t('settings.resetDefaults'), 'info');
  };

  return (
    <div className="space-y-8">
      {/* Dimension Defaults */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">
          {t('settings.defaultPreferences')}
        </h3>
        <p className="text-sm text-content-tertiary mb-4">{t('settings.defaultPreferencesHint')}</p>

        <div className="space-y-4">
          {/* Width */}
          <div>
            <label className="block text-sm text-content-secondary mb-1">
              {t('settings.defaultDrawerWidth')}
            </label>
            <StepperControl
              value={settings.defaultDrawerWidth}
              onStep={(delta) =>
                updateSetting(
                  'defaultDrawerWidth',
                  Math.max(
                    CONSTRAINTS.GRID_MIN,
                    Math.min(CONSTRAINTS.GRID_MAX, settings.defaultDrawerWidth + delta * 0.5)
                  )
                )
              }
              onChange={(value) =>
                updateSetting(
                  'defaultDrawerWidth',
                  Math.max(CONSTRAINTS.GRID_MIN, Math.min(CONSTRAINTS.GRID_MAX, value))
                )
              }
              min={CONSTRAINTS.GRID_MIN}
              max={CONSTRAINTS.GRID_MAX}
              step={0.5}
              variant="desktop"
              ariaLabel={t('settings.defaultDrawerWidth')}
              displayValue={`${settings.defaultDrawerWidth}u`}
            />
          </div>

          {/* Depth */}
          <div>
            <label className="block text-sm text-content-secondary mb-1">
              {t('settings.defaultDrawerDepth')}
            </label>
            <StepperControl
              value={settings.defaultDrawerDepth}
              onStep={(delta) =>
                updateSetting(
                  'defaultDrawerDepth',
                  Math.max(
                    CONSTRAINTS.GRID_MIN,
                    Math.min(CONSTRAINTS.GRID_MAX, settings.defaultDrawerDepth + delta * 0.5)
                  )
                )
              }
              onChange={(value) =>
                updateSetting(
                  'defaultDrawerDepth',
                  Math.max(CONSTRAINTS.GRID_MIN, Math.min(CONSTRAINTS.GRID_MAX, value))
                )
              }
              min={CONSTRAINTS.GRID_MIN}
              max={CONSTRAINTS.GRID_MAX}
              step={0.5}
              variant="desktop"
              ariaLabel={t('settings.defaultDrawerDepth')}
              displayValue={`${settings.defaultDrawerDepth}u`}
            />
          </div>

          {/* Height */}
          <div>
            <label className="block text-sm text-content-secondary mb-1">
              {t('settings.defaultDrawerHeight')}
            </label>
            <StepperControl
              value={settings.defaultDrawerHeight}
              onStep={(delta) =>
                updateSetting(
                  'defaultDrawerHeight',
                  Math.max(1, Math.min(CONSTRAINTS.GRID_MAX, settings.defaultDrawerHeight + delta))
                )
              }
              min={1}
              max={CONSTRAINTS.GRID_MAX}
              variant="desktop"
              ariaLabel={t('settings.defaultDrawerHeight')}
              displayValue={`${settings.defaultDrawerHeight}u`}
            />
          </div>

          {/* Layer Height */}
          <div>
            <label className="block text-sm text-content-secondary mb-1">
              {t('settings.defaultLayerHeight')}
            </label>
            <StepperControl
              value={settings.defaultLayerHeight}
              onStep={(delta) =>
                updateSetting(
                  'defaultLayerHeight',
                  Math.max(1, Math.min(CONSTRAINTS.GRID_MAX, settings.defaultLayerHeight + delta))
                )
              }
              min={1}
              max={CONSTRAINTS.GRID_MAX}
              variant="desktop"
              ariaLabel={t('settings.defaultLayerHeight')}
              displayValue={`${settings.defaultLayerHeight}u`}
            />
          </div>

          {/* Print Bed */}
          <div>
            <label className="block text-sm text-content-secondary mb-1">
              {t('settings.defaultPrintBedSize')}
            </label>
            <StepperControl
              value={settings.defaultPrintBedSize}
              onStep={(delta) =>
                updateSetting(
                  'defaultPrintBedSize',
                  Math.max(42, Math.min(500, settings.defaultPrintBedSize + delta * 10))
                )
              }
              min={42}
              max={500}
              step={10}
              variant="desktop"
              ariaLabel={t('settings.defaultPrintBedSize')}
              displayValue={`${settings.defaultPrintBedSize}mm`}
            />
          </div>

          {/* Grid Unit */}
          <div>
            <label className="block text-sm text-content-secondary mb-1">
              {t('settings.defaultGridUnit')}
            </label>
            <StepperControl
              value={settings.defaultGridUnitMm}
              onStep={(delta) =>
                updateSetting(
                  'defaultGridUnitMm',
                  Math.max(1, Math.min(200, settings.defaultGridUnitMm + delta))
                )
              }
              min={1}
              max={200}
              variant="desktop"
              ariaLabel={t('settings.defaultGridUnit')}
              displayValue={`${settings.defaultGridUnitMm}mm`}
            />
          </div>
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

      {/* Default Categories Section */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">
          {t('settings.defaultCategories')}
        </h3>
        <p className="text-sm text-content-tertiary mb-3">{t('settings.defaultCategoriesHint')}</p>
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

      {/* Reset to defaults */}
      <div className="pt-6 border-t border-stroke-subtle mt-6">
        <button
          onClick={handleReset}
          className="text-sm text-content-tertiary hover:text-content transition-colors"
          aria-label={t('settings.resetTabDefaults') + ' — ' + t('settings.tabs.defaults')}
        >
          {t('settings.resetTabDefaults')}
        </button>
      </div>

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
        confirmText={t('settings.confirmSaveCategories.confirm')}
        onConfirm={handleSaveCategoriesAsDefaults}
        onCancel={() => setShowSaveCategoriesConfirm(false)}
      />
    </div>
  );
}
