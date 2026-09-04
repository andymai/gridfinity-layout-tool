/**
 * PostHog initialization, opt-in/out, and core capture helper.
 * Lazy-loads posthog-js to avoid impacting initial bundle size.
 */

import type { PostHog } from 'posthog-js';
import { useSettingsStore } from '@/core/store/settings';
import { getStableUserId } from './identity';
import { filterExceptionForPosthog } from './errorFilters';

// INITIALIZATION (LAZY LOADED)

let posthogInstance: PostHog | null = null;
let initPromise: Promise<void> | null = null;
let eventQueue: Array<{ name: string; properties: Record<string, unknown> }> = [];
/**
 * Supplies layout context to natively-captured exceptions.
 *
 * Assigned once `./events` has loaded. Held as a reference rather than imported
 * because `eventsErrors` imports `getPosthogInstance` from this module, and a
 * static import back would close that cycle.
 */
let getExceptionContext: (() => Record<string, unknown>) | null = null;

/**
 * Get the PostHog instance (for modules that need direct access).
 * Returns null if not yet initialized or analytics is disabled.
 */
export function getPosthogInstance(): PostHog | null {
  return posthogInstance;
}

export function initAnalytics(): void {
  if (initPromise) return;
  if (typeof window === 'undefined') return;
  if (import.meta.env.DEV) return; // Skip in development

  const { analyticsEnabled } = useSettingsStore.getState().settings;
  if (!analyticsEnabled) return;

  const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined;

  if (!key) {
    if (!(import.meta.env.VITE_SELF_HOSTED as string | undefined)) {
      console.warn('Posthog API key not set, analytics disabled');
    }
    return;
  }

  // Lazy load posthog-js
  initPromise = import('posthog-js')
    .then(async ({ default: posthog }) => {
      posthog.init(key, {
        // Direct host on purpose: proxying through the app domain would bill
        // every capture and SDK asset fetch as a platform edge request.
        api_host: 'https://us.i.posthog.com',
        ui_host: 'https://us.posthog.com',
        capture_pageview: false, // Manual pageview - auto mode fires on every replaceState
        capture_pageleave: true,
        persistence: 'localStorage',
        autocapture: false, // We'll track specific events manually

        // Error tracking - auto-capture exceptions
        capture_exceptions: true,

        // Performance monitoring. $web_vitals bills four events per sampled
        // pageview and the dashboards read percentiles, which survive
        // sampling; network timing stays on because replay's network tab is
        // per-recording and cannot be sampled independently of it.
        capture_performance: {
          network_timing: true,
          web_vitals: Math.random() < 0.25,
        },

        // The single place exceptions are filtered and enriched. Every capture
        // path passes through here, native or explicit, so nothing needs a
        // second handler to add context. CaptureResult is a structural superset
        // of the shape filterExceptionForPosthog reads.
        before_send: (event) => {
          const kept = filterExceptionForPosthog(event);
          if (kept?.event === '$exception' && getExceptionContext) {
            // Explicit context wins: `captureException` callers pass details
            // about the specific failure that the ambient layout can't know.
            kept.properties = { ...getExceptionContext(), ...kept.properties };
          }
          return kept as typeof event;
        },
      });
      posthogInstance = posthog;

      // Fire a single pageview on app load
      posthog.capture('$pageview');

      // Identify user with stable ID for person properties & cohorts
      const userId = getStableUserId();
      posthog.identify(userId);

      // Set person properties (these persist across sessions)
      // Deferred import to avoid circular dependency: events.ts imports capture from init.ts.
      const {
        updatePersonProperties,
        getLayoutContext,
        listenForPwaInstall,
        captureUtmParameters,
      } = await import('./events');
      // Exceptions thrown before this resolves are still captured, just without
      // the layout context `before_send` attaches once this is set.
      getExceptionContext = getLayoutContext;
      updatePersonProperties();
      captureUtmParameters();
      listenForPwaInstall();

      // Flush queued events
      for (const event of eventQueue) {
        posthog.capture(event.name, event.properties);
      }
      eventQueue = [];
    })
    .catch(() => {
      // Fail silently
    });
}

/**
 * Opt out of analytics tracking.
 * Called when user disables analytics in settings.
 */
export function optOutAnalytics(): void {
  if (posthogInstance) {
    posthogInstance.opt_out_capturing();
  }
}

/**
 * Opt back into analytics tracking.
 * Called when user re-enables analytics in settings.
 */
export function optInAnalytics(): void {
  if (posthogInstance) {
    posthogInstance.opt_in_capturing();
  } else {
    // If posthog wasn't initialized, try to initialize now
    initPromise = null;
    initAnalytics();
  }
}

/**
 * Internal capture function that queues events if posthog isn't ready yet.
 */
export function capture(name: string, properties: Record<string, unknown>): void {
  if (posthogInstance) {
    posthogInstance.capture(name, properties);
  } else if (initPromise) {
    // Queue event to be sent when posthog loads
    eventQueue.push({ name, properties });
  }
  // If no initPromise, analytics is disabled (dev mode or missing env vars)
}
