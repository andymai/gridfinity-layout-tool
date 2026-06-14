import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import type { STLSearchSite } from '@/core/store/settings';
import { CheckboxRow } from '@/design-system';
import { useTranslation } from '@/i18n';
import { SettingSection } from '../../components/SettingSection/SettingSection';

export function IntegrationsTab() {
  const t = useTranslation();

  const { stlSearchSites, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      stlSearchSites: state.settings.stlSearchSites,
      updateSetting: state.updateSetting,
    }))
  );

  const toggleSite = (siteId: string) => {
    updateSetting(
      'stlSearchSites',
      stlSearchSites.map((site) =>
        site.id === siteId ? { ...site, enabled: !site.enabled } : site
      )
    );
  };

  return (
    <div className="space-y-8">
      <SettingSection
        id="stl-search"
        title={t('settings.stlSearch')}
        hint={t('settings.stlSearchHint')}
        resetKeys={['stlSearchSites']}
      >
        <div className="space-y-1">
          {stlSearchSites.map((site: STLSearchSite) => (
            <CheckboxRow
              key={site.id}
              label={site.name}
              checked={site.enabled}
              onChange={() => toggleSite(site.id)}
            />
          ))}
        </div>
      </SettingSection>
    </div>
  );
}
