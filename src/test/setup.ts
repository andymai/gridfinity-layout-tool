// src/test/setup.ts
// Base test setup — used by ALL vitest workspace projects.
// Contains environment-agnostic mocks (no DOM dependencies).
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Mock the i18n module using actual English translations.
// This prevents the need to wrap every test component with LocaleProvider
// while keeping test assertions readable (matching real English text).
vi.mock('@/i18n', async () => {
  const en = (await import('@/i18n/locales/en')).default;

  const t = (key: string, vars?: Record<string, unknown>) => {
    const template = en[key] ?? key;
    if (!vars) return template;
    let result = template;
    for (const [k, v] of Object.entries(vars)) {
      result = result.replaceAll(`{${k}}`, String(v));
    }
    return result;
  };

  return {
    useTranslation: () => t,
    useLocale: () => ({
      locale: 'en' as const,
      setLocale: vi.fn(),
      isLoading: false,
    }),
    useFormatting: () => ({
      formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
        const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        return d.toLocaleDateString('en', options);
      },
      formatRelativeDate: (
        date: Date | string | number,
        shortFormat: boolean | { shortFormat?: boolean; includeTime?: boolean } = true
      ) => {
        const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / 86400000);
        const isShort =
          typeof shortFormat === 'boolean' ? shortFormat : (shortFormat.shortFormat ?? true);
        if (diffDays === 0) return t('date.today');
        if (diffDays === 1) return t('date.yesterday');
        if (diffDays < 7) {
          return isShort
            ? t('date.daysAgo', { days: diffDays })
            : t('date.daysAgoLong', { days: diffDays });
        }
        return d.toLocaleDateString('en');
      },
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
        value.toLocaleString('en', options),
      locale: 'en' as const,
    }),
    getStaticTranslation: t,
    LocaleProvider: ({ children }: { children: unknown }) => children,
    SUPPORTED_LOCALES: [{ code: 'en', nativeName: 'English', englishName: 'English' }],
    isLocale: (value: string) => value === 'en',
    detectBrowserLocale: () => 'en',
  };
});
