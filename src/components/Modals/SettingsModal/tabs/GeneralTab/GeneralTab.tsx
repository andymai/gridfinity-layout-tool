import { useShallow } from 'zustand/shallow';
import { useSettingsStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation, useLocale, SUPPORTED_LOCALES, detectBrowserLocale } from '@/i18n';
import type { Locale } from '@/i18n';
import { resetOnboarding } from '@/features/onboarding/hooks/useOnboarding';

export function GeneralTab() {
  const t = useTranslation();
  const { locale, setLocale } = useLocale();
  const addToast = useToastStore((state) => state.addToast);

  const { settingsLocale, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      settingsLocale: state.settings.locale,
      updateSetting: state.updateSetting,
    }))
  );

  const handleReset = () => {
    updateSetting('locale', 'auto');
    setLocale(detectBrowserLocale());
    resetOnboarding();
    addToast(t('settings.resetGeneral'), 'info');
  };

  return (
    <div className="space-y-8">
      {/* Language Section */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">{t('settings.language')}</h3>
        <p className="text-sm text-content-tertiary mb-3">{t('settings.languageHint')}</p>
        <div className="space-y-1" role="radiogroup" aria-label={t('settings.language')}>
          {/* Auto option */}
          <div
            className={`flex items-center justify-between text-sm cursor-pointer group rounded-md p-2 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent ${settingsLocale === 'auto' ? 'bg-surface-elevated border border-accent/30' : 'hover:bg-surface-hover'}`}
            onClick={() => {
              updateSetting('locale', 'auto');
              setLocale(detectBrowserLocale());
            }}
            role="radio"
            tabIndex={0}
            aria-checked={settingsLocale === 'auto'}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                updateSetting('locale', 'auto');
                setLocale(detectBrowserLocale());
              }
            }}
          >
            <span className={settingsLocale === 'auto' ? 'text-content' : 'text-content-secondary'}>
              {t('settings.autoDetect')}
            </span>
            {settingsLocale === 'auto' && (
              <svg
                className="w-4 h-4 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
          {/* Language options */}
          {SUPPORTED_LOCALES.map((loc) => (
            <div
              key={loc.code}
              className={`flex items-center justify-between text-sm cursor-pointer group rounded-md p-2 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent ${locale === loc.code && settingsLocale !== 'auto' ? 'bg-surface-elevated border border-accent/30' : 'hover:bg-surface-hover'}`}
              onClick={() => {
                updateSetting('locale', loc.code);
                setLocale(loc.code as Locale);
              }}
              role="radio"
              tabIndex={0}
              aria-checked={locale === loc.code && settingsLocale !== 'auto'}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  updateSetting('locale', loc.code);
                  setLocale(loc.code as Locale);
                }
              }}
            >
              <div>
                <span
                  className={
                    locale === loc.code && settingsLocale !== 'auto'
                      ? 'text-content'
                      : 'text-content-secondary'
                  }
                >
                  {loc.nativeName}
                </span>
                {loc.code !== 'en' && (
                  <span className="text-xs text-content-disabled ml-2">{loc.englishName}</span>
                )}
              </div>
              {locale === loc.code && settingsLocale !== 'auto' && (
                <svg
                  className="w-4 h-4 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <hr className="border-stroke-subtle" />

      {/* Onboarding Reset */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">
          {t('settings.resetOnboarding')}
        </h3>
        <p className="text-sm text-content-tertiary mb-3">
          {t('settings.resetOnboardingDescription')}
        </p>
        <button
          onClick={() => {
            resetOnboarding();
            addToast(t('toast.onboardingReset'), 'info');
          }}
          className="text-sm py-2 px-3 rounded-lg bg-surface-elevated hover:bg-surface-hover text-content-secondary hover:text-content border border-stroke-subtle transition-colors"
        >
          {t('settings.resetOnboarding')}
        </button>
      </section>

      {/* Reset to defaults */}
      <div className="pt-6 border-t border-stroke-subtle mt-6">
        <button
          onClick={handleReset}
          className="text-sm text-content-tertiary hover:text-content transition-colors"
          aria-label={t('settings.resetTabDefaults') + ' — ' + t('settings.tabs.general')}
        >
          {t('settings.resetTabDefaults')}
        </button>
      </div>
    </div>
  );
}
