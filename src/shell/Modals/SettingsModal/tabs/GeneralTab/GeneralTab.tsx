import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
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
import { LENGTH_UNITS } from '@/shared/utils/lengthUnit';
import type { LengthUnit } from '@/shared/utils/lengthUnit';

const MEASURE_UNIT_LABELS = {
  mm: 'settings.measureUnit.mm',
  cm: 'settings.measureUnit.cm',
  in: 'settings.measureUnit.in',
} as const satisfies Record<LengthUnit, string>;

function InstallAppSection() {
  const t = useTranslation();
  const { canInstall, wasInstalled, install } = useInstallPrompt('settings');
  const displayMode = useSyncExternalStore<DisplayMode>(
    onDisplayModeChange,
    getDisplayMode,
    () => 'browser'
  );
  const installed = isInstalledDisplayMode(displayMode);

  let body: ReactNode;
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
  } else if (wasInstalled) {
    body = (
      <p className="text-sm text-content-secondary">
        {t('settings.general.installAppInstalledInBrowser')}
      </p>
    );
  } else {
    body = (
      <p className="text-sm text-content-secondary">{t('settings.general.installAppManual')}</p>
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

  const { settingsLocale, measureUnit, showUpdateSummaries, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      settingsLocale: state.settings.locale,
      measureUnit: state.settings.measureUnit,
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
        id="measure-unit"
        title={t('settings.measureUnit')}
        hint={t('settings.measureUnitHint')}
        resetKeys={['measureUnit']}
      >
        <div
          className="grid grid-cols-3 gap-2"
          role="radiogroup"
          aria-label={t('settings.measureUnit')}
        >
          {LENGTH_UNITS.map((unit) => (
            <SelectableCard
              key={unit}
              compact
              selected={measureUnit === unit}
              onSelect={() => updateSetting('measureUnit', unit)}
              label={t(MEASURE_UNIT_LABELS[unit])}
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
