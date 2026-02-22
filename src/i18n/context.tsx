/**
 * Locale context and translation hook.
 *
 * Provides the translation function `t()` to all components via React context.
 * English translations are bundled inline (zero latency). Other locales are
 * lazy-loaded on demand via dynamic imports.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const t = useTranslation();
 *   return <h2>{t('settings.title')}</h2>;
 * }
 *
 * // With interpolation:
 * t('toast.binsDeleted', { count: 5 }); // "Deleted 5 bin(s)"
 * ```
 */

/* eslint-disable react-refresh/only-export-components */
// Hooks are intentionally co-located with LocaleProvider for cohesion.
// Fast Refresh still works; this just skips component-level HMR for hooks.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import type { ReactNode } from 'react';
import type { Locale, Translations, TranslationVars } from './types';

/**
 * Minimal inline translations for ErrorBoundary and initial render.
 * The full English locale is lazy-loaded like all other locales.
 */
const fallback: Translations = {
  'errorBoundary.heading': 'Something went wrong',
  'errorBoundary.description': 'The app encountered an unexpected error. Your layout data is safe.',
  'errorBoundary.hint':
    'Try refreshing the page. If the problem persists, resetting app data will restore defaults while your browser may still have cached data.',
  'errorBoundary.tryAgain': 'Try Again',
  'errorBoundary.resetAppData': 'Reset App Data',
  'common.loading': 'Loading...',
  'seo.title': 'Gridfinity Layout Tool | Plan Your 3D Printed Drawer Organizers',
  'seo.description':
    'Plan and visualize Gridfinity drawer layouts for 3D printing. Custom bins, multi-layer support, and 3D preview.',
};

/**
 * Map of locale codes to Open Graph locale format.
 * OG uses underscore format (e.g., en_US, de_DE).
 */
const OG_LOCALE_MAP: Record<Locale, string> = {
  en: 'en_US',
  de: 'de_DE',
  nl: 'nl_NL',
  es: 'es_ES',
  fr: 'fr_FR',
  'pt-BR': 'pt_BR',
  nb: 'nb_NO',
};

/** Translation function signature */
export type TFunction = (key: string, vars?: TranslationVars) => string;

interface LocaleContextValue {
  /** Current active locale */
  locale: Locale;
  /** Change the active locale (triggers async load for non-English) */
  setLocale: (locale: Locale) => void;
  /** Translation function */
  t: TFunction;
  /** Whether a locale is currently being loaded */
  isLoading: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Static translation lookup for use outside React context.
 * Currently uses English only - suitable for ErrorBoundary and other
 * edge cases where React context is unavailable.
 *
 * @example
 * ```tsx
 * import { getStaticTranslation } from '@/i18n';
 * const heading = getStaticTranslation('error.heading');
 * ```
 */
export function getStaticTranslation(key: string, vars?: TranslationVars): string {
  const template = _loadedEn?.[key] ?? lookupKey(fallback, key) ?? key;
  if (!vars) return template;
  let result = template;
  for (const [k, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${k}}`, String(value));
  }
  return result;
}

/**
 * Cache for the full English translations (loaded lazily).
 * Used by getStaticTranslation and as fallback in t().
 */
let _loadedEn: Translations | null = null;

/** @internal Test-only: seed the English translation cache */
export function _setLoadedEn(translations: Translations | null): void {
  _loadedEn = translations;
}

/**
 * Interpolate variables into a translation string.
 * Replaces {variableName} placeholders with provided values.
 */
/**
 * Look up a key in a translations map, returning undefined when absent.
 * Needed because Record<string, string> tells TS every key exists,
 * but at runtime a locale file may not contain every possible key.
 */
function lookupKey(map: Translations, key: string): string | undefined {
  return key in map ? map[key] : undefined;
}

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, String(value));
  }
  return result;
}

/**
 * Lazy-load locale modules. Vite splits these into separate chunks.
 * Only called for non-English locales.
 */
const localeLoaders: Record<Locale, () => Promise<{ default: Translations }>> = {
  en: () => import('./locales/en.json'),
  de: () => import('./locales/de.json'),
  nl: () => import('./locales/nl.json'),
  es: () => import('./locales/es.json'),
  'pt-BR': () => import('./locales/pt-BR.json'),
  fr: () => import('./locales/fr.json'),
  nb: () => import('./locales/nb.json'),
};

interface LocaleProviderProps {
  children: ReactNode;
  /** Initial locale (from settings or detection) */
  initialLocale: Locale;
  /** Callback when locale changes (to persist preference) */
  onLocaleChange?: (locale: Locale) => void;
}

export function LocaleProvider({ children, initialLocale, onLocaleChange }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [translations, setTranslations] = useState<Translations>(fallback);
  const [isLoading, setIsLoading] = useState(true);
  const latestLocaleRef = useRef<Locale>(initialLocale);

  const loadLocale = useCallback(async (target: Locale) => {
    latestLocaleRef.current = target;

    const loader = localeLoaders[target];
    setIsLoading(true);
    try {
      // For non-English, also ensure English is loaded (for fallback keys)
      const [module, enModule] = await Promise.all([
        loader(),
        _loadedEn ? Promise.resolve(null) : localeLoaders.en(),
      ]);
      if (enModule) {
        _loadedEn = enModule.default;
      }
      if (latestLocaleRef.current === target) {
        setTranslations(module.default);
        setIsLoading(false);
      }
    } catch {
      // Fall back to English (or fallback) on load failure
      if (latestLocaleRef.current === target) {
        setTranslations(_loadedEn ?? fallback);
        setIsLoading(false);
      }
    }
  }, []);

  // Load initial locale on mount (all locales including English are lazy-loaded)
  useEffect(() => {
    // Schedule for next microtask to avoid sync setState during effect
    // (React Compiler flags sync state updates in effects as problematic)
    void Promise.resolve().then(() => loadLocale(initialLocale));
  }, [initialLocale, loadLocale]);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleState(newLocale);
      void loadLocale(newLocale);
      onLocaleChange?.(newLocale);
    },
    [loadLocale, onLocaleChange]
  );

  // Sync SEO meta tags when locale/translations change
  useEffect(() => {
    if (isLoading || typeof document === 'undefined') return;

    // HTML lang attribute (screen readers, SEO)
    document.documentElement.lang = locale;

    // Page title and meta description
    const seoTitle =
      lookupKey(translations, 'seo.title') ?? _loadedEn?.['seo.title'] ?? fallback['seo.title'];
    const seoDesc =
      lookupKey(translations, 'seo.description') ??
      _loadedEn?.['seo.description'] ??
      fallback['seo.description'];

    document.title = seoTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', seoDesc);

    // Open Graph tags
    document
      .querySelector('meta[property="og:locale"]')
      ?.setAttribute('content', OG_LOCALE_MAP[locale]);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', seoTitle);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', seoDesc);

    // Twitter Card tags
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', seoTitle);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', seoDesc);
  }, [locale, translations, isLoading]);

  const t: TFunction = useCallback(
    (key: string, vars?: TranslationVars): string => {
      // Try current locale, fall back to English, then show key
      const template = translations[key] || _loadedEn?.[key] || key;
      return interpolate(template, vars);
    },
    [translations]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t, isLoading }),
    [locale, setLocale, t, isLoading]
  );

  // Show minimal loading state while translations are loading
  // This prevents flash of English content for non-English users
  if (isLoading) {
    return (
      <LocaleContext.Provider value={value}>
        <div className="h-screen flex items-center justify-center bg-surface">
          <div
            className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin motion-reduce:animate-none"
            role="status"
            aria-label="Loading"
          />
        </div>
      </LocaleContext.Provider>
    );
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Hook to access the translation function.
 * Returns just `t` for the common case of translating strings.
 *
 * @example
 * ```tsx
 * const t = useTranslation();
 * return <button>{t('common.save')}</button>;
 * ```
 */
export function useTranslation(): TFunction {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LocaleProvider');
  }
  return context.t;
}

/**
 * Hook to access full locale context (locale, setLocale, loading state).
 * Use this in the language selector UI.
 *
 * @example
 * ```tsx
 * const { locale, setLocale, isLoading } = useLocale();
 * ```
 */
export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

/**
 * Hook to access locale-aware formatting functions.
 * Uses the app's current locale for consistent formatting.
 *
 * @example
 * ```tsx
 * const { formatDate, formatRelativeDate, formatNumber } = useFormatting();
 * return <span>Updated: {formatRelativeDate(lastModified)}</span>;
 * ```
 */
export function useFormatting() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useFormatting must be used within a LocaleProvider');
  }
  const { locale, t } = context;

  /** Format a date using the app's locale */
  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      return d.toLocaleDateString(locale, options);
    },
    [locale]
  );

  /**
   * Format a date as a relative time string.
   * @param date - The date to format
   * @param options - Formatting options
   * @param options.shortFormat - Use short format (Xd) vs long format (X days ago)
   * @param options.includeTime - Include minutes/hours for recent times (default: false)
   */
  const formatRelativeDate = useCallback(
    (
      date: Date | string | number,
      shortFormat: boolean | { shortFormat?: boolean; includeTime?: boolean } = true
    ) => {
      const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();

      // Parse options
      const opts =
        typeof shortFormat === 'boolean'
          ? { shortFormat, includeTime: false }
          : {
              shortFormat: shortFormat.shortFormat ?? true,
              includeTime: shortFormat.includeTime ?? false,
            };

      // If includeTime is true, show minutes/hours for recent times
      if (opts.includeTime) {
        const diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes < 1) return t('snapshots.justNow');
        if (diffMinutes < 60) return t('date.minutesAgo', { minutes: diffMinutes });

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return t('date.hoursAgo', { hours: diffHours });
      }

      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return t('date.today');
      if (diffDays === 1) return t('date.yesterday');
      if (diffDays < 7) {
        return opts.shortFormat
          ? t('date.daysAgo', { days: diffDays })
          : t('date.daysAgoLong', { days: diffDays });
      }
      return d.toLocaleDateString(locale);
    },
    [locale, t]
  );

  /** Format a number using the app's locale (adds thousand separators, etc.) */
  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return value.toLocaleString(locale, options);
    },
    [locale]
  );

  return { formatDate, formatRelativeDate, formatNumber, locale };
}
