import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from '@/App';
import { ErrorBoundary } from '@/shell/ErrorBoundary';
import { SmokeReporter } from '@/shell/SmokeReporter';
import { LocaleProvider } from '@/i18n/context';
import { detectBrowserLocale } from '@/i18n/detection';
import { isLocale } from '@/i18n/types';
import type { Locale } from '@/i18n/types';
import { useSettingsStore } from '@/core/store/settings';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useSharedWithMeStore } from '@/core/store/sharedWithMe';
import { connectEventStoreToBus, connectSelectionPruning, eventBus } from '@/core/cqrs';
import { connectDesignLinking } from '@/features/design-linking/subscribers';
import {
  layoutId,
  layerId,
  categoryId,
  gridUnits,
  heightUnits,
  mm,
  type Layout,
  type LayoutLibrary,
  type LayoutId,
} from '@/core/types';
import { SMOKE_MESSAGE_TYPE, type SmokeResultMessage } from '@/shared/utils/smokeMode';

/**
 * Deterministic synthetic layout for smoke boots. Mirrors the shape of
 * `createTestLayout()` in `src/test/testUtils.ts` but lives outside the test
 * directory so it can be imported into production code without dragging in vitest.
 */
function buildSmokeLayout(): { layout: Layout; library: LayoutLibrary; id: LayoutId } {
  const id = layoutId('00000000-0000-4000-8000-000000000001');
  const layout: Layout = {
    version: '1.0',
    name: 'Smoke Layout',
    drawer: { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(12) },
    printBedSize: mm(256),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
    categories: [{ id: categoryId('cat1'), name: 'General', color: '#3b82f6' }],
    layers: [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }],
    bins: [],
  };
  const library: LayoutLibrary = {
    version: '1.0',
    activeLayoutId: id,
    settings: {},
    entries: [
      {
        id,
        name: layout.name,
        createdAt: 0,
        modifiedAt: 0,
        preview: {
          drawerWidth: layout.drawer.width,
          drawerDepth: layout.drawer.depth,
          drawerHeight: layout.drawer.height,
          binCount: 0,
          layerCount: 1,
        },
      },
    ],
  };
  return { layout, library, id };
}

function postSmokeResult(message: Omit<SmokeResultMessage, 'type'>): void {
  if (window.parent === window) return; // No parent listener — Playwright reads the DOM directly.
  const payload: SmokeResultMessage = { type: SMOKE_MESSAGE_TYPE, ...message };
  try {
    window.parent.postMessage(payload, window.location.origin);
  } catch {
    // best-effort
  }
}

function resolveInitialLocale(): Locale {
  const savedLocale = useSettingsStore.getState().settings.locale;
  if (savedLocale !== 'auto' && isLocale(savedLocale)) {
    return savedLocale;
  }
  return detectBrowserLocale();
}

export function runSmokeBoot(): void {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    postSmokeResult({
      smokeOk: false,
      version: __APP_VERSION__,
      gitSha: __GIT_SHA__,
      buildTime: __BUILD_TIME__,
      reason: 'root_missing',
    });
    return;
  }

  // Surface unexpected boot errors to the parent before the React error boundary catches them.
  // `once: true` so a single fixture that emits multiple errors doesn't spam the parent.
  window.addEventListener(
    'error',
    (event) => {
      postSmokeResult({
        smokeOk: false,
        version: __APP_VERSION__,
        gitSha: __GIT_SHA__,
        buildTime: __BUILD_TIME__,
        reason: `error:${event.message}`,
      });
    },
    { once: true }
  );
  window.addEventListener(
    'unhandledrejection',
    (event) => {
      postSmokeResult({
        smokeOk: false,
        version: __APP_VERSION__,
        gitSha: __GIT_SHA__,
        buildTime: __BUILD_TIME__,
        reason: `rejection:${String(event.reason)}`,
      });
    },
    { once: true }
  );

  const { layout, library, id } = buildSmokeLayout();
  useLibraryStore.getState().initLibrary(library);
  useLayoutStore.getState().importLayout(layout, id, 'init');
  useSharedWithMeStore.getState().init([]);

  // Connect CQRS bus — App components subscribe to it; leaving it unconnected can throw.
  connectEventStoreToBus();
  connectSelectionPruning(eventBus);
  connectDesignLinking(eventBus);

  const initialLocale = resolveInitialLocale();
  document.documentElement.lang = initialLocale === 'pt-BR' ? 'pt' : initialLocale;

  createRoot(rootElement).render(
    <ErrorBoundary>
      <LocaleProvider initialLocale={initialLocale} onLocaleChange={() => {}}>
        <App />
        <SmokeReporter />
      </LocaleProvider>
      <Analytics />
    </ErrorBoundary>
  );
}
