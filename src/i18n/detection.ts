/**
 * Browser language detection.
 *
 * Detects the user's preferred language from browser settings
 * and maps it to a supported locale.
 */

import type { Locale } from './types';
import { isLocale } from './types';

/**
 * Map of browser language codes to our supported locales.
 * Handles regional variants (e.g., pt-BR, de-AT, es-MX).
 */
const LANGUAGE_MAP: Partial<Record<string, Locale>> = {
  // Direct matches
  en: 'en',
  de: 'de',
  nl: 'nl',
  es: 'es',
  fr: 'fr',

  // Portuguese variants → Brazilian Portuguese
  pt: 'pt-BR',
  'pt-BR': 'pt-BR',
  'pt-PT': 'pt-BR', // European Portuguese falls back to BR

  // German regional variants
  'de-AT': 'de', // Austrian German
  'de-CH': 'de', // Swiss German

  // Dutch regional variants
  'nl-BE': 'nl', // Belgian Dutch (Flemish)

  // Spanish regional variants
  'es-MX': 'es',
  'es-AR': 'es',
  'es-CO': 'es',

  // French regional variants
  'fr-BE': 'fr',
  'fr-CH': 'fr',
  'fr-CA': 'fr',

  // Norwegian variants → Bokmål
  nb: 'nb',
  nn: 'nb', // Nynorsk falls back to Bokmål
  no: 'nb', // Generic Norwegian → Bokmål
  'nb-NO': 'nb',
  'nn-NO': 'nb',
  'no-NO': 'nb',

  // Ukrainian
  uk: 'uk',
  'uk-UA': 'uk',
};

/**
 * Detect the best matching locale from browser language preferences.
 *
 * Checks `navigator.languages` (ordered preference list) then falls
 * back to `navigator.language`. Returns 'en' if no match found.
 */
export function detectBrowserLocale(): Locale {
  // Check all preferred languages in order
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- navigator.languages can be undefined in some environments
  const languages = navigator.languages ?? [navigator.language];

  for (const lang of languages) {
    // Try exact match first (e.g., "pt-BR")
    const exactMatch = LANGUAGE_MAP[lang];
    if (exactMatch) return exactMatch;

    // Try base language (e.g., "pt" from "pt-PT")
    const baseLang = lang.split('-')[0];
    if (isLocale(baseLang)) return baseLang;

    const baseMatch = LANGUAGE_MAP[baseLang];
    if (baseMatch) return baseMatch;
  }

  return 'en';
}
