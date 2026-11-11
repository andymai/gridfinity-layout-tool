import { useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { Button, Switch } from '@/design-system';
import { useTranslation, useLocale, SUPPORTED_LOCALES, detectBrowserLocale } from '@/i18n';
import { useInstallPrompt } from '@/shared/hooks/useInstallPrompt';
import {
  getDisplayMode,
  isInstalledDisplayMode,
  onDisplayModeChange,
} from '@/shared/pwa/displayMode';
import type { DisplayMode } from '@/shared/pwa/displayMode';
import { SpaceMouseSettings } from '@/shared/spacemouse/components/SpaceMouseSettings';
import { useSpaceMouseStore } from '@/shared/spacemouse/settingsStore';
import { SettingSection } from '../../components/SettingSection/SettingSection';
import { SelectableCard } from '../../components/SelectableCard/SelectableCard';

function InstallAppSection() {
  const t = useTranslation();
  const { canInstall, install } = useInstallPrompt('settings');
  const displayMode = useSyncExternalStore<DisplayMode>(
    onDisplayModeChange,
    getDisplayMode,
    () => 'browser'
  );
  const installed = isInstalledDisplayMode(displayMode);

  let body = (
    <p className="text-sm text-content-secondary">{t('settings.general.installAppManual')}</p>
  );
  if (installed) {
    body = (
      <p className="text-sm text-content-secondary">{t('settings.general.installAppInstalled')}</p>
    );
  } else if (canInstall) {
    body = (
      <Button variant="secondary" onClick={() => void install()}>
        {t('pwaInstall.install')}
      </Button>
    );
  }

  return (
    <SettingSection
      id="install-app"
      title={t('settings.general.installApp')}
      hint={t('settings.general.installAppHint')}
    >
      {body}
    </SettingSection>
  );
}

export function GeneralTab() {
  const t = useTranslation();
  const { locale, setLocale } = useLocale();

  const { settingsLocale, showUpdateSummaries, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      settingsLocale: state.settings.locale,
      showUpdateSummaries: state.settings.showUpdateSummaries,
      updateSetting: state.updateSetting,
    }))
  );

  const spaceMouseEnabled = useSpaceMouseStore((s) => s.enabled);
  const setSpaceMouseEnabled = useSpaceMouseStore((s) => s.setEnabled);

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

      <SettingSection
        id="update-summaries"
        title={t('settings.general.showUpdateSummaries')}
        resetKeys={['showUpdateSummaries']}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-content-secondary">
            {t('settings.general.showUpdateSummariesDesc')}
          </span>
          <Switch
            checked={showUpdateSummaries}
            onChange={(checked) => updateSetting('showUpdateSummaries', checked)}
            aria-label={t('settings.general.showUpdateSummaries')}
          />
        </div>
      </SettingSection>

      <InstallAppSection />

      <SettingSection
        id="spacemouse"
        title={t('settings.spacemouse')}
        hint={t('settings.spacemouseHint')}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-content-secondary">{t('settings.spacemouseEnable')}</span>
          <Switch
            checked={spaceMouseEnabled}
            onChange={setSpaceMouseEnabled}
            aria-label={t('settings.spacemouseEnable')}
          />
        </div>
        {spaceMouseEnabled && <SpaceMouseSettings />}
      </SettingSection>
    </div>
  );
}
