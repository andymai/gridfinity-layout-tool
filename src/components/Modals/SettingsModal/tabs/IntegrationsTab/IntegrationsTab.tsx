import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import type { STLSearchSite } from '@/core/store/settings';
import { Checkbox } from '@/shared/components/Checkbox';
import { useTranslation } from '@/i18n';

export function IntegrationsTab() {
  const t = useTranslation();

  const { stlSearchSites, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      stlSearchSites: state.settings.stlSearchSites,
      updateSetting: state.updateSetting,
    }))
  );

  const toggleSite = useCallback(
    (siteId: string) => {
      const updatedSites = stlSearchSites.map((site: STLSearchSite) =>
        site.id === siteId ? { ...site, enabled: !site.enabled } : site
      );
      updateSetting('stlSearchSites', updatedSites);
    },
    [stlSearchSites, updateSetting]
  );

  return (
    <div className="space-y-8">
      {/* STL Search Section */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">{t('settings.stlSearch')}</h3>
        <p className="text-sm text-content-tertiary mb-3">{t('settings.stlSearchHint')}</p>
        <div className="space-y-2">
          {stlSearchSites.map((site: STLSearchSite) => (
            <div
              key={site.id}
              className="flex items-center justify-between text-sm cursor-pointer group rounded-md p-1 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
              onClick={() => toggleSite(site.id)}
              role="checkbox"
              tabIndex={0}
              aria-checked={site.enabled}
              aria-label={t('settings.toggleSite', { name: site.name })}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  toggleSite(site.id);
                }
              }}
            >
              <span
                className={`${site.enabled ? 'text-content' : 'text-content-tertiary'} group-hover:text-content transition-colors`}
              >
                {site.name}
              </span>
              <Checkbox checked={site.enabled} variant="desktop" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
