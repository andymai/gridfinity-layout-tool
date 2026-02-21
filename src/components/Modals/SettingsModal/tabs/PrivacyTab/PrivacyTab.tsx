import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { Checkbox } from '@/shared/components/Checkbox';
import { optInAnalytics, optOutAnalytics, pruneAnalyticsData } from '@/shared/analytics/posthog';
import { useTranslation } from '@/i18n';

export function PrivacyTab() {
  const t = useTranslation();

  const { analyticsEnabled, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      analyticsEnabled: state.settings.analyticsEnabled,
      updateSetting: state.updateSetting,
    }))
  );

  const handlePrivacyToggle = () => {
    const newValue = !analyticsEnabled;
    updateSetting('analyticsEnabled', newValue);
    if (newValue) {
      optInAnalytics();
    } else {
      optOutAnalytics();
      pruneAnalyticsData();
    }
  };

  return (
    <div className="space-y-8">
      {/* Analytics Toggle */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">{t('settings.privacy')}</h3>
        <div
          className="flex items-center justify-between text-sm cursor-pointer group rounded-md p-1 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
          onClick={handlePrivacyToggle}
          role="checkbox"
          tabIndex={0}
          aria-checked={analyticsEnabled}
          aria-label={t('settings.toggleUsageData')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              handlePrivacyToggle();
            }
          }}
        >
          <div>
            <span
              className={`${analyticsEnabled ? 'text-content' : 'text-content-tertiary'} group-hover:text-content transition-colors`}
            >
              {t('settings.helpImprove')}
            </span>
            <p className="text-xs text-content-disabled mt-0.5">{t('settings.helpImproveHint')}</p>
          </div>
          <Checkbox checked={analyticsEnabled} variant="desktop" />
        </div>
      </section>
    </div>
  );
}
