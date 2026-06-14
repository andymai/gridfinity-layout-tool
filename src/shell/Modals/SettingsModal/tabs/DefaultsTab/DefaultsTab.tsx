import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { CONSTRAINTS } from '@/core/constants';
import { PrintBedInput } from '@/shared/components/PrintBedInput';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useDrawerSettings } from '@/shared/hooks/useDrawerSettings';
import { Button, Stepper } from '@/design-system';
import { useTranslation } from '@/i18n';
import { SettingSection } from '../../components/SettingSection/SettingSection';
import type { UserSettings } from '@/core/store/settings';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const LAYOUT_DEFAULT_KEYS: (keyof UserSettings)[] = [
  'defaultDrawerWidth',
  'defaultDrawerDepth',
  'defaultDrawerHeight',
  'defaultLayerHeight',
  'defaultPrintBedSize',
  'defaultPrintBedDepth',
  'defaultGridUnitMm',
  'defaultHeightUnitMm',
];

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
  const { drawer, gridUnitMm, printBedSize, activeLayerHeight } = useDrawerSettings();

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
      <SettingSection
        id="layout-dimensions"
        title={t('settings.defaultPreferences')}
        hint={t('settings.defaultPreferencesHint')}
        resetKeys={LAYOUT_DEFAULT_KEYS}
      >
        <div className="space-y-3 text-xs text-content-secondary">
          {/* Width / Depth / Height in compact 3-column grid */}
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="mb-1 block text-content-tertiary">{t('common.width')}</label>
              <Stepper
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
                size="sm"
                aria-label={t('common.width')}
              />
            </div>
            <div>
              <label className="mb-1 block text-content-tertiary">{t('common.depth')}</label>
              <Stepper
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
                size="sm"
                aria-label={t('common.depth')}
              />
            </div>
            <div>
              <label className="mb-1 block text-content-tertiary">{t('common.height')}</label>
              <Stepper
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
                size="sm"
                aria-label={t('common.height')}
              />
            </div>
          </div>

          {/* Layer Height / Print Bed / Grid Unit as SettingsRow */}
          <SettingsRow label={t('settings.defaultLayerHeight')} unit="u">
            <Stepper
              size="sm"
              value={settings.defaultLayerHeight}
              min={CONSTRAINTS.MIN_LAYER_HEIGHT}
              max={CONSTRAINTS.GRID_MAX}
              onChange={(value) =>
                updateSetting(
                  'defaultLayerHeight',
                  clamp(value, CONSTRAINTS.MIN_LAYER_HEIGHT, CONSTRAINTS.GRID_MAX)
                )
              }
              onStep={(delta) =>
                updateSetting(
                  'defaultLayerHeight',
                  clamp(
                    settings.defaultLayerHeight + delta,
                    CONSTRAINTS.MIN_LAYER_HEIGHT,
                    CONSTRAINTS.GRID_MAX
                  )
                )
              }
              aria-label={t('settings.defaultLayerHeight')}
            />
          </SettingsRow>
          <SettingsRow
            label={t('settings.defaultPrintBedSize')}
            htmlFor="defaultPrintBed"
            unit="mm"
          >
            <PrintBedInput
              id="defaultPrintBed"
              width={settings.defaultPrintBedSize}
              depth={settings.defaultPrintBedDepth ?? settings.defaultPrintBedSize}
              onChange={(w, d) => {
                updateSetting('defaultPrintBedSize', Math.max(42, Math.min(500, w)));
                updateSetting(
                  'defaultPrintBedDepth',
                  d !== undefined ? Math.max(42, Math.min(500, d)) : undefined
                );
              }}
              variant="compact"
            />
          </SettingsRow>
          <div>
            <SettingsRow label={t('settings.defaultGridUnit')} unit="mm">
              <Stepper
                size="sm"
                value={settings.defaultGridUnitMm}
                min={CONSTRAINTS.GRID_UNIT_MM_MIN}
                max={CONSTRAINTS.GRID_UNIT_MM_MAX}
                onChange={(value) =>
                  updateSetting(
                    'defaultGridUnitMm',
                    clamp(value, CONSTRAINTS.GRID_UNIT_MM_MIN, CONSTRAINTS.GRID_UNIT_MM_MAX)
                  )
                }
                onStep={(delta) =>
                  updateSetting(
                    'defaultGridUnitMm',
                    clamp(
                      settings.defaultGridUnitMm + delta,
                      CONSTRAINTS.GRID_UNIT_MM_MIN,
                      CONSTRAINTS.GRID_UNIT_MM_MAX
                    )
                  )
                }
                aria-label={t('settings.defaultGridUnit')}
              />
            </SettingsRow>
            <p className="mt-0.5 text-[10px] text-content-tertiary">
              {t('settings.gridfinityStandardMm', {
                value: CONSTRAINTS.GRID_UNIT_MM_DEFAULT,
              })}
            </p>
          </div>
        </div>

        {/* Copy from current layout */}
        <Button
          variant="ghost"
          fullWidth
          onClick={() => setShowCopyConfirm(true)}
          className="mt-4 rounded-lg border border-stroke-subtle bg-surface-elevated px-3 py-2 text-sm text-content-secondary hover:bg-surface-hover hover:text-content"
        >
          {t('settings.copyFromCurrentLayout')}
        </Button>
      </SettingSection>

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
    </div>
  );
}
