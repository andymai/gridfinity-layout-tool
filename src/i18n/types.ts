/**
 * Internationalization type definitions.
 *
 * Supported locales and translation system types.
 * English is always bundled inline as the default/fallback.
 * Other locales are lazy-loaded on demand.
 */

/** Supported locale codes */
export type Locale = 'en' | 'de' | 'nl' | 'es' | 'pt-BR' | 'fr' | 'nb' | 'uk' | 'sv';

/** Locale metadata for UI display */
export interface LocaleInfo {
  /** ISO locale code */
  code: Locale;
  /** Native name (displayed in language selector) */
  nativeName: string;
  /** English name (for accessibility/tooltips) */
  englishName: string;
}

/** All supported locales with display metadata */
export const SUPPORTED_LOCALES: readonly LocaleInfo[] = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)' },
  { code: 'fr', nativeName: 'Français', englishName: 'French' },
  { code: 'nb', nativeName: 'Norsk bokmål', englishName: 'Norwegian Bokmål' },
  { code: 'uk', nativeName: 'Українська', englishName: 'Ukrainian' },
  { code: 'sv', nativeName: 'Svenska', englishName: 'Swedish' },
] as const;

/** Flat key-value map of translations */
export type Translations = Record<string, string>;

/** Variables for string interpolation: t('key', { count: 5 }) */
export type TranslationVars = Record<string, string | number>;

/** Check if a string is a valid locale code */
export function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.some((l) => l.code === value);
}
