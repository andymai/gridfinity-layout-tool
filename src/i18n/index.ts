/**
 * Internationalization module - public API.
 *
 * @example
 * ```tsx
 * import { useTranslation, useLocale, LocaleProvider } from '@/i18n';
 *
 * // In components:
 * const t = useTranslation();
 * <h2>{t('settings.title')}</h2>
 *
 * // For locale switching:
 * const { locale, setLocale } = useLocale();
 * ```
 */

export {
  LocaleProvider,
  useTranslation,
  useLocale,
  useFormatting,
  getStaticTranslation,
} from './context';
export type { TFunction } from './context';
export { detectBrowserLocale } from './detection';
export { SUPPORTED_LOCALES, isLocale } from './types';
export type { Locale, LocaleInfo, Translations, TranslationVars } from './types';
