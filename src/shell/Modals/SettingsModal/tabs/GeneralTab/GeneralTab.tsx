import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { useTranslation, useLocale, SUPPORTED_LOCALES, detectBrowserLocale } from '@/i18n';
import { SettingSection } from '../../components/SettingSection/SettingSection';
import { SelectableCard } from '../../components/SelectableCard/SelectableCard';

export function GeneralTab() {
  const t = useTranslation();
  const { locale, setLocale } = useLocale();

  const { settingsLocale, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      settingsLocale: state.settings.locale,
      updateSetting: state.updateSetting,
    }))
  );

  const selectAuto = () => {
    updateSetting('locale', 'auto');
    setLocale(detectBrowserLocale());
  };

  return (
    <div className="space-y-8">
      <SettingSection
        id="language"
        title={t('settings.language')}
        hint={t('settings.languageHint')}
        onReset={selectAuto}
        resetDisabled={settingsLocale === 'auto'}
      >
        <div className="space-y-1" role="radiogroup" aria-label={t('settings.language')}>
          <SelectableCard
            compact
            selected={settingsLocale === 'auto'}
            onSelect={selectAuto}
            label={t('settings.autoDetect')}
          />
          {SUPPORTED_LOCALES.map((loc) => (
            <SelectableCard
              key={loc.code}
              compact
              selected={locale === loc.code && settingsLocale !== 'auto'}
              onSelect={() => {
                updateSetting('locale', loc.code);
                setLocale(loc.code);
              }}
              label={loc.nativeName}
              description={loc.code !== 'en' ? loc.englishName : undefined}
            />
          ))}
        </div>
      </SettingSection>
    </div>
  );
}
