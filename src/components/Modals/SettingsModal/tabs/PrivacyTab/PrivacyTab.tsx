import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useSettingsStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { Checkbox } from '@/shared/components/Checkbox';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { optInAnalytics, optOutAnalytics } from '@/shared/analytics/posthog';
import { useTranslation } from '@/i18n';

export function PrivacyTab() {
  const t = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
    }
  };

  const handleReset = () => {
    updateSetting('analyticsEnabled', true);
    optInAnalytics();
    setShowResetConfirm(false);
    addToast(t('settings.resetPrivacy'), 'info');
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

      {/* Divider */}
      <hr className="border-stroke-subtle" />

      {/* Legal Links */}
      <section>
        <div className="text-xs text-content-disabled space-x-3">
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-content-tertiary transition-colors"
          >
            {t('settings.privacyPolicy')}
          </a>
          <span>·</span>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-content-tertiary transition-colors"
          >
            {t('settings.termsOfService')}
          </a>
        </div>
      </section>

      {/* Reset to defaults */}
      <div className="pt-6 border-t border-stroke-subtle mt-6">
        <button
          onClick={() => {
            // If analytics is already enabled, nothing to reset
            if (analyticsEnabled) {
              addToast(t('settings.resetPrivacy'), 'info');
              return;
            }
            // Otherwise confirm re-enabling analytics
            setShowResetConfirm(true);
          }}
          className="text-sm text-content-tertiary hover:text-content transition-colors"
          aria-label={t('settings.resetTabDefaults') + ' — ' + t('settings.tabs.privacy')}
        >
          {t('settings.resetTabDefaults')}
        </button>
      </div>

      <ConfirmDialog
        isOpen={showResetConfirm}
        title={t('settings.resetTabDefaults')}
        message={t('settings.confirmResetPrivacy')}
        confirmText={t('common.apply')}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
