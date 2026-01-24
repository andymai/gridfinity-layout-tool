import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock the i18n module using actual English translations
// This prevents the need to wrap every test component with LocaleProvider
// while keeping test assertions readable (matching real English text)
vi.mock('@/i18n', async () => {
  const en = (await import('@/i18n/locales/en')).default;
  return {
    useTranslation: () => (key: string, vars?: Record<string, unknown>) => {
      const template = en[key] ?? key;
      if (!vars) return template;
      let result = template;
      for (const [k, v] of Object.entries(vars)) {
        result = result.replaceAll(`{${k}}`, String(v));
      }
      return result;
    },
    useLocale: () => ({
      locale: 'en' as const,
      setLocale: vi.fn(),
      isLoading: false,
    }),
    LocaleProvider: ({ children }: { children: unknown }) => children,
    SUPPORTED_LOCALES: [
      { code: 'en', nativeName: 'English', englishName: 'English' },
    ],
    isLocale: (value: string) => value === 'en',
    detectBrowserLocale: () => 'en',
  };
});

// Guard DOM-specific mocks for tests running in Node.js environment
if (typeof Element !== 'undefined') {
  // Mock pointer capture methods not implemented in jsdom
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}

if (typeof window !== 'undefined') {
  // Mock matchMedia for responsive hook tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Global cleanup for React components
// This catches component cleanup that individual tests might miss
afterEach(() => {
  if (typeof document !== 'undefined') {
    cleanup();
  }
});
