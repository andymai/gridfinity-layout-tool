import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import type { STLSearchSite, SlicerSite } from '@/core/store/settings';
import { Checkbox } from '@/shared/components/Checkbox';
import { useTranslation } from '@/i18n';

export function IntegrationsTab() {
  const t = useTranslation();

  const { stlSearchSites, slicerSites, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      stlSearchSites: state.settings.stlSearchSites,
      slicerSites: state.settings.slicerSites,
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

  const toggleSlicer = (slicerId: string) => {
    updateSetting(
      'slicerSites',
      slicerSites.map((slicer) =>
        slicer.id === slicerId ? { ...slicer, enabled: !slicer.enabled } : slicer
      )
    );
  };

  return (
    <div className="space-y-8">
      {/* STL Search Section */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">{t('settings.stlSearch')}</h3>
        <p className="text-sm text-content-tertiary mb-3">{t('settings.stlSearchHint')}</p>
        <div className="space-y-2">
          {stlSearchSites.map((site: STLSearchSite) => (
            <ToggleRow
              key={site.id}
              id={site.id}
              name={site.name}
              enabled={site.enabled}
              ariaLabel={t('settings.toggleSite', { name: site.name })}
              onToggle={toggleSite}
            />
          ))}
        </div>
      </section>

      {/* Slicers Section */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">{t('settings.slicers')}</h3>
        <p className="text-sm text-content-tertiary mb-3">{t('settings.slicersHint')}</p>
        <div className="space-y-2">
          {slicerSites.map((slicer: SlicerSite) => (
            <ToggleRow
              key={slicer.id}
              id={slicer.id}
              name={slicer.name}
              enabled={slicer.enabled}
              ariaLabel={t('settings.toggleSlicer', { name: slicer.name })}
              onToggle={toggleSlicer}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  id,
  name,
  enabled,
  ariaLabel,
  onToggle,
}: {
  id: string;
  name: string;
  enabled: boolean;
  ariaLabel: string;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className="flex items-center justify-between text-sm cursor-pointer group rounded-md p-1 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
      onClick={() => onToggle(id)}
      role="checkbox"
      tabIndex={0}
      aria-checked={enabled}
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle(id);
        }
      }}
    >
      <span
        className={`${enabled ? 'text-content' : 'text-content-tertiary'} group-hover:text-content transition-colors`}
      >
        {name}
      </span>
      <Checkbox checked={enabled} variant="desktop" />
    </div>
  );
}
