/**
 * Standard echo mock for `@/i18n` in component tests: `t(key)` returns the
 * key itself, with `{param}` interpolation applied, so assertions target
 * stable keys instead of English copy. Use as:
 *
 *   vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));
 */

export function useTranslation() {
  return (key: string, params?: Record<string, unknown>): string => {
    if (params) {
      return Object.entries(params).reduce((str, [k, v]) => str.replace(`{${k}}`, String(v)), key);
    }
    return key;
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
