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
