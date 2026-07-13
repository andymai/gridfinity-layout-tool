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

const fallback: Translations = {
  'errorBoundary.heading': 'Something went wrong',
  'errorBoundary.description': 'The app encountered an unexpected error. Your layout data is safe.',
  'errorBoundary.hint':
    'Try again or refresh the page. You can download a backup of your layouts to keep them safe.',
  'errorBoundary.tryAgain': 'Try Again',
  'errorBoundary.undoLastChange': 'Undo Last Change',
  'errorBoundary.downloadBackup': 'Download Backup',
  'errorBoundary.backupDone': 'Backup downloaded.',
  'errorBoundary.backupError': "Couldn't create a backup. Try refreshing the page.",
  'common.loading': 'Loading...',
  'seo.title': 'Gridfinity Planner & Layout Tool — Free Online Drawer Organizer',
  'seo.description':
    'Plan Gridfinity drawer layouts in your browser. Drag-and-drop bins, custom bin generator, 3D preview, STL/STEP/3MF export. Free, no account.',
  'seo.h1': 'Gridfinity Planner & Layout Tool',
  'seo.designer.title': 'Gridfinity Bin Designer — Free Custom Bin Builder',
  'seo.designer.description':
    'Design custom Gridfinity bins in your browser: dimensions, compartments, label tabs, wall cutouts, and base styles with a real-time 3D preview. Export STL, STEP, or 3MF. Free, no account.',
  'seo.baseplate.title': 'Gridfinity Baseplate Maker — Free Custom Baseplate Builder',
  'seo.baseplate.description':
    'Make custom Gridfinity baseplates in your browser: any grid size, magnet holes, edge padding, and automatic print-bed splitting. Export STL, STEP, or 3MF. Free, no account.',
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
  it: 'it_IT',
  'pt-BR': 'pt_BR',
  nb: 'nb_NO',
  uk: 'uk_UA',
  sv: 'sv_SE',
  ja: 'ja_JP',
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
  it: () => import('./locales/it.json'),
  nb: () => import('./locales/nb.json'),
  uk: () => import('./locales/uk.json'),
  sv: () => import('./locales/sv.json'),
  ja: () => import('./locales/ja.json'),
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
  // Start with isLoading=false so the first render shows children immediately
  // (avoids a fullscreen spinner that causes CLS). The initial locale load
  // happens in the background; fallback translations cover the brief gap.
  const [isLoading, setIsLoading] = useState(false);
  const latestLocaleRef = useRef<Locale>(initialLocale);
  // Track whether the initial locale has loaded (suppresses loading spinner
  // for the first mount — only explicit locale switches show the spinner).
  // Uses state (not ref) because it's read during render for conditional UI.
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  const loadLocale = useCallback(async (target: Locale, isInitial = false) => {
    latestLocaleRef.current = target;

    const loader = localeLoaders[target];
    // Only show loading spinner for explicit locale switches, not the initial load.
    // The initial load renders children with fallback translations to avoid CLS.
    if (!isInitial) {
      setIsLoading(true);
    }
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
        setHasLoadedInitial(true);
      }
    } catch {
      // Fall back to English (or fallback) on load failure
      if (latestLocaleRef.current === target) {
        setTranslations(_loadedEn ?? fallback);
        setIsLoading(false);
        setHasLoadedInitial(true);
      }
    }
  }, []);

  // Load initial locale on mount (all locales including English are lazy-loaded)
  useEffect(() => {
    // Schedule for next microtask to avoid sync setState during effect
    // (React Compiler flags sync state updates in effects as problematic)
    void Promise.resolve().then(() => loadLocale(initialLocale, true));
  }, [initialLocale, loadLocale]);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleState(newLocale);
      void loadLocale(newLocale);
      onLocaleChange?.(newLocale);
    },
    [loadLocale, onLocaleChange]
  );

  // Sync locale-specific document attributes when locale changes.
  // Title / description / og:title / og:description / twitter:title /
  // twitter:description are owned by App's route-aware effect — they vary by
  // route too, so a single owner avoids the parent/child useEffect ordering
  // race (children fire first, parent overwrites) that would otherwise leave
  // /designer and /baseplate stuck on the homepage title after a locale flip.
  useEffect(() => {
    if (isLoading || typeof document === 'undefined') return;

    document.documentElement.lang = locale;
    document
      .querySelector('meta[property="og:locale"]')
      ?.setAttribute('content', OG_LOCALE_MAP[locale]);
  }, [locale, isLoading]);

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

  // Show minimal loading state only during explicit locale switches (not initial load).
  // The initial load renders children with fallback translations to avoid CLS.
  if (isLoading && hasLoadedInitial) {
    return (
      <LocaleContext.Provider value={value}>
        <div className="h-screen flex items-center justify-center bg-surface">
          <div
            className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin motion-reduce:animate-none"
            role="status"
            aria-label={t('common.loading')}
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
 * return <span>{t('common.save')}</span>;
 * ```
 */
export function useTranslation(): TFunction {
  const context = useContext(LocaleContext);
  if (!context) {
    // Degrade gracefully during transitions (navigation, HMR) rather than
    // crashing. Returns English strings via the static lookup; components
    // will re-render with the real `t` once the provider is available.
    return getStaticTranslation;
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
