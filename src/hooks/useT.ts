import { useTranslation } from 'react-i18next';
import type { Namespace } from '../i18n';

/**
 * Custom translation hook that wraps react-i18next's useTranslation.
 * Provides typed namespace support and convenient accessor.
 *
 * @param ns - Namespace(s) to load. Defaults to 'common'.
 * @returns Object with `t` function and `i18n` instance.
 *
 * @example
 * // Single namespace
 * const { t } = useT('layout');
 * t('bin.title'); // "Bin"
 *
 * @example
 * // Multiple namespaces
 * const { t } = useT(['common', 'layout']);
 * t('common:buttons.save'); // "Save"
 * t('layout:bin.title'); // "Bin"
 *
 * @example
 * // With interpolation
 * const { t } = useT('toast');
 * t('bin.deleted', { count: 5 }); // "Deleted 5 bins"
 */
export function useT(ns: Namespace | Namespace[] = 'common') {
  const { t, i18n } = useTranslation(ns);
  return { t, i18n };
}

/**
 * Hook for common UI strings (buttons, labels, placeholders).
 */
export function useCommonT() {
  return useT('common');
}

/**
 * Hook for layout-related strings (drawer, layers, bins, categories).
 */
export function useLayoutT() {
  return useT('layout');
}

/**
 * Hook for validation and error messages.
 */
export function useValidationT() {
  return useT('validation');
}

/**
 * Hook for toast notification messages.
 */
export function useToastT() {
  return useT('toast');
}

/**
 * Hook for share feature strings.
 */
export function useShareT() {
  return useT('share');
}

/**
 * Hook for print list strings.
 */
export function usePrintT() {
  return useT('print');
}

/**
 * Hook for help modal and keyboard shortcuts.
 */
export function useHelpT() {
  return useT('help');
}

/**
 * Hook for ARIA labels and accessibility strings.
 */
export function useAriaT() {
  return useT('aria');
}
