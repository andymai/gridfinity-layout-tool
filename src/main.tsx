import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingFallback } from './shared/components/LoadingFallback';
import { LocaleProvider } from './i18n/context.tsx';
import { detectBrowserLocale } from './i18n/detection.ts';
import { isLocale } from './i18n/types.ts';
import { useSettingsStore } from './core/store/settings.ts';
import { initAnalytics } from './shared/analytics/posthog.ts';
import { useLayoutStore } from './core/store/layout.ts';
import type { Locale } from './i18n/types.ts';

// WWW → canonical migration: if the inline script in index.html detected www with data,
// dynamically import the migration module and skip the normal React boot entirely.
if ((window as unknown as { __wwwMigrationPending?: boolean }).__wwwMigrationPending) {
  void import('./core/storage/wwwMigration')
    .then(({ runWwwMigration }) => runWwwMigration())
    .catch(() => {
      // If the migration module fails to load (network error, CSP), show the overlay
      // with an error so the user isn't stuck on a blank page.
      const overlay = document.getElementById('www-migration-overlay');
      if (overlay) {
        overlay.style.display = 'flex';
        const msg = overlay.querySelector('[data-migration-message]');
        if (msg) msg.textContent = 'Something went wrong. Please refresh the page.';
      }
    });
  // Stop here — don't initialize analytics or mount React
} else {
  // Initialize Posthog analytics (no-op in dev)
  initAnalytics();

  // Lazily initialize ML telemetry — the module is ~104 KB and not needed for first paint
  void import('./shared/analytics/mlTelemetry').then(({ initMLTelemetry, setLayoutStoreRef }) => {
    setLayoutStoreRef(() => useLayoutStore.getState(), useLayoutStore.subscribe);
    initMLTelemetry();
  });

  // Prevent pinch-to-zoom on iOS (Safari ignores viewport meta since iOS 10)
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('gestureend', (e) => e.preventDefault());

  // Prevent multi-touch zoom on all mobile browsers
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // Resolve initial locale from settings (sync - no async load needed for this)
  function resolveInitialLocale(): Locale {
    const savedLocale = useSettingsStore.getState().settings.locale;
    if (savedLocale !== 'auto' && isLocale(savedLocale)) {
      return savedLocale;
    }
    return detectBrowserLocale();
  }

  const initialLocale = resolveInitialLocale();

  // Set initial lang attribute on <html>
  document.documentElement.lang = initialLocale === 'pt-BR' ? 'pt' : initialLocale;

  // Persist locale changes to settings store
  function handleLocaleChange(locale: Locale): void {
    useSettingsStore.getState().updateSetting('locale', locale);
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Note: StrictMode disabled due to react-three-fiber WebGL context issues
  // R3F's Canvas doesn't handle StrictMode's double-mount cycle well
  createRoot(rootElement).render(
    <ErrorBoundary>
      <LocaleProvider initialLocale={initialLocale} onLocaleChange={handleLocaleChange}>
        <Suspense fallback={<LoadingFallback variant="fullscreen" />}>
          <App />
        </Suspense>
      </LocaleProvider>
      <Analytics />
    </ErrorBoundary>
  );
} // end else — www migration check
