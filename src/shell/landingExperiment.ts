import { useSettingsStore } from '@/core/store/settings';
import {
  ANALYTICS_STORAGE_KEY,
  loadAnalyticsData,
  saveAnalyticsData,
} from '@/shared/analytics/posthog/identity';
import type { AnalyticsData } from '@/shared/analytics/posthog/identity';
import { resolveFeatureFlag } from '@/shared/analytics/posthog/flags';

export const LANDING_FLAG_KEY = 'default-landing-designer';

/** Both arms wait this long before the first paint, so the wait costs them equally. */
const FIRST_VISIT_WAIT_MS = 1500;
const REFRESH_WAIT_MS = 10_000;

const NEUTRAL_PARAMS = new Set(['gclid', 'fbclid', 'msclkid', 'ref']);
const AUTOMATED_AGENT = /bot|crawl|spider|slurp|lighthouse|headless|prerender/i;

type LandingVariant = AnalyticsData['landingVariant'];

/**
 * Read before `initAnalytics()`, which creates the analytics record. Its
 * absence marks a browser that never loaded the app.
 */
export function isFirstVisit(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_STORAGE_KEY) === null;
  } catch {
    return false;
  }
}

function isBareRoot(url: URL): boolean {
  if (url.pathname !== '/' || url.hash !== '') return false;
  for (const key of url.searchParams.keys()) {
    if (!key.startsWith('utm_') && !NEUTRAL_PARAMS.has(key)) return false;
  }
  return true;
}

// Crawlers must keep seeing the planner at `/`: the homepage ranks on its text.
function isAutomated(): boolean {
  return navigator.webdriver || AUTOMATED_AGENT.test(navigator.userAgent);
}

function toVariant(value: unknown): LandingVariant {
  return value === 'control' || value === 'test' ? value : '';
}

function storeVariant(variant: LandingVariant): void {
  const data = loadAnalyticsData();
  if (data.landingVariant === variant) return;
  saveAnalyticsData({ ...data, landingVariant: variant });
}

function openDesigner(): void {
  window.history.replaceState(window.history.state, '', `/designer${window.location.search}`);
}

// Ending the experiment turns the flag off, which unenrolls the visitor on
// their next load instead of leaving them redirected forever.
async function refreshVariant(): Promise<void> {
  const result = await resolveFeatureFlag(LANDING_FLAG_KEY, REFRESH_WAIT_MS);
  if (result.loaded) storeVariant(toVariant(result.value));
}

/**
 * Decide whether a load of the bare root opens the designer. Run before the
 * first render: the routes read the path once, when they mount.
 *
 * Only a first visit enrolls. An enrolled visitor keeps their arm on every
 * later load of `/`, as a real change of default would behave.
 */
export async function applyLandingExperiment(firstVisit: boolean): Promise<void> {
  try {
    if (!useSettingsStore.getState().settings.analyticsEnabled) return;
    if (!isBareRoot(new URL(window.location.href)) || isAutomated()) return;

    const stored = toVariant(loadAnalyticsData().landingVariant);
    if (stored) {
      if (stored === 'test') openDesigner();
      void refreshVariant();
      return;
    }
    if (!firstVisit) return;

    const result = await resolveFeatureFlag(LANDING_FLAG_KEY, FIRST_VISIT_WAIT_MS);
    if (!result.loaded) return;
    const variant = toVariant(result.value);
    if (!variant) return;
    storeVariant(variant);
    if (variant === 'test') openDesigner();
  } catch {
    // The planner stays the landing page.
  }
}
