// src/test/setup.ts
// Base test setup — used by ALL vitest workspace projects.
// Contains environment-agnostic mocks (no DOM dependencies).
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Node 25+ exposes a built-in globalThis.localStorage getter that returns an empty
// object ({}) with no methods, which shadows jsdom's real Storage-backed localStorage
// (jsdom only provides one for a non-opaque origin). Install a faithful replacement so
// all tests can use it. This lives in the base setup (not setup-dom.ts) because
// `.test.ts` files that opt into jsdom via `// @vitest-environment jsdom` still run
// under the unit project, which only loads this file.
//
// In jsdom the replacement is an instance of jsdom's `Storage` class whose methods live
// on `Storage.prototype` and whose entries are stored as own enumerable properties. This
// keeps two behaviours that real Storage guarantees and that tests depend on:
// `Object.keys(localStorage)` enumerates the stored keys, and
// `vi.spyOn(Storage.prototype, 'setItem')` intercepts writes.
//
// In the pure-node env (no `window`) we deliberately use a plain in-memory object instead:
// Node 25 also exposes a global `Storage` class, but its `Storage.prototype.length` is
// non-configurable, so patching the prototype throws and would break every node-env test
// file. Node-env tests only need basic get/set localStorage, so the plain object suffices.
const isJsdom = typeof window !== 'undefined';
if (typeof globalThis !== 'undefined') {
  const StorageCtor = (globalThis as { Storage?: { prototype: object } }).Storage;
  let localStorageValue: object;

  if (isJsdom && typeof StorageCtor === 'function') {
    const proto = StorageCtor.prototype as Record<string, unknown>;
    const has = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
    proto.getItem = function (this: object, key: string) {
      return has(this, key) ? (this as Record<string, string>)[key] : null;
    };
    proto.setItem = function (this: object, key: string, value: string) {
      (this as Record<string, string>)[key] = String(value);
    };
    proto.removeItem = function (this: object, key: string) {
      delete (this as Record<string, string>)[key];
    };
    proto.clear = function (this: object) {
      for (const key of Object.keys(this)) delete (this as Record<string, string>)[key];
    };
    proto.key = function (this: object, index: number) {
      return Object.keys(this)[index] ?? null;
    };
    Object.defineProperty(proto, 'length', {
      get(this: object) {
        return Object.keys(this).length;
      },
      configurable: true,
    });
    localStorageValue = Object.create(proto);
  } else {
    let store: Record<string, string> = {};
    localStorageValue = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() {
        return Object.keys(store).length;
      },
    };
  }

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageValue,
    writable: true,
    configurable: true,
  });
  if (typeof window !== 'undefined' && window !== (globalThis as unknown)) {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageValue,
      writable: true,
      configurable: true,
    });
  }
}

// Mock the i18n module using actual English translations.
// This prevents the need to wrap every test component with LocaleProvider
// while keeping test assertions readable (matching real English text).
vi.mock('@/i18n', async () => {
  const en = (await import('@/i18n/locales/en')).default;

  const t = (key: string, vars?: Record<string, unknown>) => {
    const template = en[key] ?? key;
    if (!vars) return template;
    let result = template;
    for (const [k, v] of Object.entries(vars)) {
      result = result.replaceAll(`{${k}}`, String(v));
    }
    return result;
  };

  return {
    useTranslation: () => t,
    useLocale: () => ({
      locale: 'en' as const,
      setLocale: vi.fn(),
      isLoading: false,
    }),
    useFormatting: () => ({
      formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
        const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        return d.toLocaleDateString('en', options);
      },
      formatRelativeDate: (
        date: Date | string | number,
        shortFormat: boolean | { shortFormat?: boolean; includeTime?: boolean } = true
      ) => {
        const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / 86400000);
        const isShort =
          typeof shortFormat === 'boolean' ? shortFormat : (shortFormat.shortFormat ?? true);
        if (diffDays === 0) return t('date.today');
        if (diffDays === 1) return t('date.yesterday');
        if (diffDays < 7) {
          return isShort
            ? t('date.daysAgo', { days: diffDays })
            : t('date.daysAgoLong', { days: diffDays });
        }
        return d.toLocaleDateString('en');
      },
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
        value.toLocaleString('en', options),
      locale: 'en' as const,
    }),
    getStaticTranslation: t,
    LocaleProvider: ({ children }: { children: unknown }) => children,
    SUPPORTED_LOCALES: [{ code: 'en', nativeName: 'English', englishName: 'English' }],
    isLocale: (value: string) => value === 'en',
    detectBrowserLocale: () => 'en',
  };
});
