import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { Switch } from '@/design-system';
import { useTranslation } from '@/i18n';
import { SettingSection } from '../../components/SettingSection/SettingSection';

export function AccessibilityTab() {
  const t = useTranslation();

  const { reduceMotion, highContrast, distinguishCategoriesByPattern, updateSetting } =
    useSettingsStore(
      useShallow((state) => ({
        reduceMotion: state.settings.reduceMotion,
        highContrast: state.settings.highContrast,
        distinguishCategoriesByPattern: state.settings.distinguishCategoriesByPattern,
        updateSetting: state.updateSetting,
      }))
    );

  return (
    <div className="space-y-8">
      <SettingSection id="motion" title={t('settings.reduceMotion')} resetKeys={['reduceMotion']}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-content-secondary">{t('settings.reduceMotionHint')}</span>
          <Switch
            checked={reduceMotion}
            onChange={(checked) => updateSetting('reduceMotion', checked)}
            aria-label={t('settings.reduceMotion')}
          />
        </div>
      </SettingSection>

      <SettingSection
        id="high-contrast"
        title={t('settings.highContrast')}
        resetKeys={['highContrast']}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-content-secondary">{t('settings.highContrastHint')}</span>
          <Switch
            checked={highContrast}
            onChange={(checked) => updateSetting('highContrast', checked)}
            aria-label={t('settings.highContrast')}
          />
        </div>
      </SettingSection>

      <SettingSection
        id="category-patterns"
        title={t('settings.categoryPatterns')}
        resetKeys={['distinguishCategoriesByPattern']}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-content-secondary">
            {t('settings.categoryPatternsHint')}
          </span>
          <Switch
            checked={distinguishCategoriesByPattern}
            onChange={(checked) => updateSetting('distinguishCategoriesByPattern', checked)}
            aria-label={t('settings.categoryPatterns')}
          />
        </div>
      </SettingSection>
    </div>
  );
}
