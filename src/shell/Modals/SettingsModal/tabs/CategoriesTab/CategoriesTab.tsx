import { useSettingsStore } from '@/core/store';
import { DEFAULT_CATEGORIES } from '@/core/constants';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useDrawerSettings } from '@/shared/hooks/useDrawerSettings';
import { useBinDefaults } from '@/features/bin-designer';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { SettingSection } from '../../components/SettingSection/SettingSection';

export function CategoriesTab() {
  const t = useTranslation();

  const settings = useSettingsStore((state) => state.settings);

  const {
    currentCategories,
    showSaveCategoriesConfirm,
    setShowSaveCategoriesConfirm,
    handleSaveCategoriesAsDefaults,
    hasCustomCategoryDefaults,
  } = useDrawerSettings();

  // Bin Designer "default for new bins" — status + reset only. Capturing the
  // current settings happens in the designer/command palette (live params).
  const { hasCustomDefault: hasCustomBinDefault, resetToFactory: resetBinDefault } =
    useBinDefaults();

  return (
    <div className="space-y-6">
      <SettingSection
        id="default-categories"
        title={t('settings.defaultCategories')}
        hint={t('settings.defaultCategoriesHint')}
        resetKeys={['defaultCategories']}
        resetDisabled={!hasCustomCategoryDefaults}
      >
        <div className="mb-4 rounded-lg border border-stroke-subtle bg-surface-elevated p-3 text-sm text-content-secondary">
          <div className="mb-2 text-xs text-content-tertiary">
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
                className="flex items-center gap-1.5 rounded bg-surface-hover px-2 py-1"
              >
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-sm shadow-sm"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="max-w-[80px] truncate text-xs text-content-secondary">
                  {cat.name}
                </span>
              </div>
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          fullWidth
          onClick={() => setShowSaveCategoriesConfirm(true)}
          className="rounded-lg border border-stroke-subtle bg-surface-elevated px-3 py-2 text-sm text-content-secondary hover:bg-surface-hover hover:text-content"
        >
          {t('settings.saveCategoriesAsDefaults')}
        </Button>
      </SettingSection>

      <hr className="border-stroke-subtle" />

      <SettingSection
        id="bin-defaults"
        title={t('settings.binDefaults.title')}
        hint={t('settings.binDefaults.hint')}
        onReset={resetBinDefault}
        resetDisabled={!hasCustomBinDefault}
      >
        <div className="rounded-lg border border-stroke-subtle bg-surface-elevated p-3 text-sm text-content-secondary">
          <div className="flex items-center gap-2 text-xs text-content-tertiary">
            {hasCustomBinDefault ? (
              <>
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-accent" />
                {t('binDesigner.customDefaultActive')}
              </>
            ) : (
              t('settings.binDefaults.usingFactory')
            )}
          </div>
        </div>
      </SettingSection>

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
