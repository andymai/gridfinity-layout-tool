import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from '@/shell/ErrorBoundary';
import { LocaleProvider } from '@/i18n/context.tsx';
import { detectBrowserLocale } from '@/i18n/detection.ts';
import { isLocale } from '@/i18n/types.ts';
import { useSettingsStore } from '@/core/store/settings.ts';
import { initAnalytics } from '@/shared/analytics/posthog';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library.ts';
import { useSharedWithMeStore } from '@/core/store/sharedWithMe.ts';
import { initializeLayoutLibrary, loadSharedWithMe } from '@/core/storage';
import { isOk } from '@/core/result';
import type { Locale } from '@/i18n/types.ts';
import { recoverFromBadWwwMigration } from '@/core/storage/wwwMigrationRecovery';
import {
  connectEventStoreToBus,
  connectFillAnalytics,
  connectLibraryPersistence,
  connectSelectionPruning,
  eventBus,
} from '@/core/cqrs';
import { connectDesignLinking } from '@/features/design-linking/subscribers';
import { InitErrorFallback } from '@/shell/InitErrorFallback';
import { isSmokeMode } from '@/shared/utils/smokeMode';

// Smoke mode (?smoke=1) boots a synthetic fixture and reports back to a parent listener.
// Must short-circuit ahead of www-migration paths, which would otherwise reload/redirect
// during a smoke harness run. The boot module is dynamically imported so it doesn't
// bloat the main bundle (smoke runs only in CI / iframe gate, never in user browsers).
if (isSmokeMode()) {
  void import('./shell/smokeBoot').then(({ runSmokeBoot }) => runSmokeBoot());
} else if (recoverFromBadWwwMigration()) {
  // Reload triggered — stop all further initialization.
} else if ((window as unknown as { __wwwMigrationPending?: boolean }).__wwwMigrationPending) {
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

  // Hydrate stores from IndexedDB before mounting React so the first paint
  // renders the real app layout — no Suspense spinner, no CLS.
  let initError: Error | undefined;

  void initializeLayoutLibrary()
    .then(({ library, activeLayout }) => {
      useLibraryStore.getState().initLibrary(library);
      useLayoutStore.getState().importLayout(activeLayout, library.activeLayoutId, 'init');

      const sharedWithMeResult = loadSharedWithMe();
      useSharedWithMeStore
        .getState()
        .init(isOk(sharedWithMeResult) ? sharedWithMeResult.value : []);

      // Connect CQRS event store — persists domain events to IndexedDB asynchronously
      connectEventStoreToBus();

      // Connect selection pruning — automatically cleans stale bin/layer/category
      // references from selection store when entities are deleted or moved
      connectSelectionPruning(eventBus);

      // Persist library to IndexedDB immediately when cloudShare metadata changes
      // (other library fields are persisted via useAutoSave's debounced flow)
      connectLibraryPersistence(eventBus);

      // Forward bin.layerFilled events to PostHog/mlTracking — replaces the
      // v1 _fillMeta side-channel that the layout store used to set on fills
      connectFillAnalytics(eventBus);

      // Connect design-linking — bridges CQRS events to syncEventBus for
      // design dimension cascade between linked bins and designs
      connectDesignLinking(eventBus);
    })
    .catch((e: unknown) => {
      initError = e instanceof Error ? e : new Error(String(e));
    })
    .finally(() => {
      // Note: StrictMode disabled due to react-three-fiber WebGL context issues
      // R3F's Canvas doesn't handle StrictMode's double-mount cycle well
      createRoot(rootElement).render(
        <ErrorBoundary>
          <LocaleProvider initialLocale={initialLocale} onLocaleChange={handleLocaleChange}>
            {initError ? <InitErrorFallback error={initError} /> : <App />}
          </LocaleProvider>
          <Analytics />
        </ErrorBoundary>
      );
    });
} // end else — www migration check
