import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { Switch } from '@/design-system';
import {
  optInAnalytics,
  optOutAnalytics,
  pruneAnalyticsData,
  isTrackingOptOut,
} from '@/shared/analytics/posthog';
import { useTranslation } from '@/i18n';
import { SettingSection } from '../../components/SettingSection/SettingSection';

export function PrivacyTab() {
  const t = useTranslation();

  const { analyticsEnabled, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      analyticsEnabled: state.settings.analyticsEnabled,
      updateSetting: state.updateSetting,
    }))
  );

  const browserPrivacySignal = isTrackingOptOut();

  const setAnalytics = (enabled: boolean) => {
    updateSetting('analyticsEnabled', enabled);
    if (enabled) {
      optInAnalytics();
    } else {
      optOutAnalytics();
      pruneAnalyticsData();
    }
  };

  return (
    <div className="space-y-8">
      <SettingSection id="privacy-analytics" title={t('settings.privacy')}>
        {browserPrivacySignal && !analyticsEnabled && (
          <p className="mb-3 rounded-md bg-surface-secondary px-3 py-2 text-xs text-content-secondary">
            {t('settings.browserPrivacySignal')}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-sm text-content">{t('settings.helpImprove')}</span>
            <p className="mt-0.5 text-xs text-content-disabled">{t('settings.helpImproveHint')}</p>
          </div>
          <Switch
            checked={analyticsEnabled}
            onChange={setAnalytics}
            aria-label={t('settings.toggleUsageData')}
          />
        </div>
      </SettingSection>
    </div>
  );
}
