import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LocaleProvider } from './i18n/context.tsx';
import { detectBrowserLocale } from './i18n/detection.ts';
import { isLocale } from './i18n/types.ts';
import { useSettingsStore } from './core/store/settings.ts';
import { initAnalytics } from './shared/analytics/posthog.ts';
import { initMLTelemetry, setLayoutStoreRef } from './shared/analytics/mlTelemetry';
import { useLayoutStore } from './core/store/layout.ts';
import type { Locale } from './i18n/types.ts';

// Initialize Posthog analytics (no-op in dev)
initAnalytics();

// Set up layout store reference for ML telemetry (avoids circular dependencies)
setLayoutStoreRef(() => useLayoutStore.getState(), useLayoutStore.subscribe);

// Initialize ML telemetry for bin prediction training
initMLTelemetry();

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
      <App />
    </LocaleProvider>
    <Analytics />
  </ErrorBoundary>
);
