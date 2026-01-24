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

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Locale, Translations, TranslationVars } from './types';
import en from './locales/en';

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
 * Interpolate variables into a translation string.
 * Replaces {variableName} placeholders with provided values.
 */
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
const localeLoaders: Record<string, () => Promise<{ default: Translations }>> = {
  de: () => import('./locales/de.json'),
  nl: () => import('./locales/nl.json'),
  es: () => import('./locales/es.json'),
  'pt-BR': () => import('./locales/pt-BR.json'),
  fr: () => import('./locales/fr.json'),
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
  const [translations, setTranslations] = useState<Translations>(
    initialLocale === 'en' ? en : en // Start with English, load target async
  );
  const [isLoading, setIsLoading] = useState(initialLocale !== 'en');
  const mountedRef = useRef(true);

  const loadLocale = useCallback(async (target: Locale) => {
    if (target === 'en') {
      setTranslations(en);
      setIsLoading(false);
      return;
    }

    const loader = localeLoaders[target];
    if (!loader) {
      setTranslations(en);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const module = await loader();
      if (mountedRef.current) {
        setTranslations(module.default);
        setIsLoading(false);
      }
    } catch {
      // Fall back to English on load failure
      if (mountedRef.current) {
        setTranslations(en);
        setIsLoading(false);
      }
    }
  }, []);

  // Load initial non-English locale on mount
  useEffect(() => {
    if (initialLocale !== 'en') {
      loadLocale(initialLocale);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [initialLocale, loadLocale]);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleState(newLocale);
      loadLocale(newLocale);
      onLocaleChange?.(newLocale);

      // Update document lang attribute
      document.documentElement.lang = newLocale === 'pt-BR' ? 'pt' : newLocale;
    },
    [loadLocale, onLocaleChange]
  );

  const t: TFunction = useCallback(
    (key: string, vars?: TranslationVars): string => {
      // Try current locale, fall back to English, then show key
      const template = translations[key] ?? en[key] ?? key;
      return interpolate(template, vars);
    },
    [translations]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, isLoading }}>
      {children}
    </LocaleContext.Provider>
  );
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
