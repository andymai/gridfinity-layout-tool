/**
 * Standard echo mock for `@/i18n` in component tests: `t(key)` returns the
 * key itself, with `{param}` interpolation applied, so assertions target
 * stable keys instead of English copy. A plural family called with a count
 * echoes the English form it picks (`baseplate.splitInfo_one`). Use as:
 *
 *   vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));
 */

import en from '@/i18n/locales/en';
import { pluralCategory, pluralCount } from '@/i18n/plural';

function pluralForm(key: string, params?: Record<string, unknown>): string {
  const count = pluralCount(params?.count);
  if (count === undefined || !(`${key}_other` in en)) return key;
  const form = `${key}_${pluralCategory('en', count)}`;
  return form in en ? form : `${key}_other`;
}

export function useTranslation() {
  return (key: string, params?: Record<string, unknown>): string => {
    const resolved = pluralForm(key, params);
    if (params) {
      return Object.entries(params).reduce(
        (str, [k, v]) => str.replace(`{${k}}`, String(v)),
        resolved
      );
    }
    return resolved;
  };
}

/**
 * Deterministic `useFormatting`, so a component that formats a date is
 * testable without a LocaleProvider and without the runner's own locale
 * leaking into assertions. Fixed values, not `toLocaleDateString`: the real
 * output varies by machine.
 */
export function useFormatting() {
  return {
    formatDate: (date: Date | string | number): string => new Date(date).toISOString().slice(0, 10),
    formatRelativeDate: (date: Date | string | number): string =>
      new Date(date).toISOString().slice(0, 10),
    formatNumber: (value: number): string => String(value),
  };
}
