import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock the i18n module using actual English translations
// This prevents the need to wrap every test component with LocaleProvider
// while keeping test assertions readable (matching real English text)
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
    LocaleProvider: ({ children }: { children: unknown }) => children,
    SUPPORTED_LOCALES: [{ code: 'en', nativeName: 'English', englishName: 'English' }],
    isLocale: (value: string) => value === 'en',
    detectBrowserLocale: () => 'en',
  };
});

// Suppress jsdom-environment noise from Three.js / React Three Fiber.
//    warns when the module is loaded more than once in the same global (vitest's
//    thread pool can cause this when a component imports three as ESM and a
//    dependency loads it via CommonJS). Tests are unaffected — pure noise.
//    names (hemisphereLight, directionalLight, planeGeometry, meshStandardMaterial,
//    lineBasicMaterial, lineSegments, …) that are correct inside R3F's custom
//    WebGL reconciler but unknown to React's DOM reconciler in jsdom. The elements
//    work correctly at runtime; the warning is environmental mismatch noise.
if (typeof window !== 'undefined') {
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Multiple instances of Three.js')) return;
    originalWarn(...args);
  };

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string') {
      // R3F element names (hemisphereLight, directionalLight, etc.) are lowercase
      // by design in R3F's reconciler but unknown to React's DOM reconciler in jsdom.
      if (args[0].includes('is using incorrect casing')) return;
      // R3F-specific props (emissiveIntensity, flatShading, polygonOffset, …) are
      // valid Three.js material/object properties passed via R3F JSX but unrecognised
      // by React's DOM reconciler when running in jsdom without WebGL context.
      if (
        args[0].startsWith('React does not recognize the') &&
        args[0].includes('prop on a DOM element')
      )
        return;
    }
    originalError(...args);
  };
}

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

  // Mock ResizeObserver for components that use it (e.g., responsive stash)
  class MockResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {
      // Immediately call with a mock entry to simulate initial measurement
      this.callback(
        [
          {
            contentRect: { width: 800, height: 400 } as DOMRectReadOnly,
            target: document.body,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        this
      );
    }
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver;
}

// Global cleanup for React components
// This catches component cleanup that individual tests might miss
afterEach(() => {
  if (typeof document !== 'undefined') {
    cleanup();
  }
});
