import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { useTranslation, useLocale, SUPPORTED_LOCALES, detectBrowserLocale } from '@/i18n';

export function GeneralTab() {
  const t = useTranslation();
  const { locale, setLocale } = useLocale();

  const { settingsLocale, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      settingsLocale: state.settings.locale,
      updateSetting: state.updateSetting,
    }))
  );

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
                setLocale(loc.code);
              }}
              role="radio"
              tabIndex={0}
              aria-checked={locale === loc.code && settingsLocale !== 'auto'}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  updateSetting('locale', loc.code);
                  setLocale(loc.code);
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
    </div>
  );
}
