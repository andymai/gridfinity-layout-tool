import en from '../../src/i18n/locales/en';

type Key = keyof typeof en;

/** The English UI string for `key`, with `{placeholders}` filled from `values`. */
export function label(key: Key, values: Record<string, string | number> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (_match, name: string) => {
    const v = values[name];
    if (v === undefined) throw new Error(`${key}: no value for {${name}}`);
    return String(v);
  });
}
