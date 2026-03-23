/**
 * PostHog initialization, opt-in/out, and core capture helper.
 * Lazy-loads posthog-js to avoid impacting initial bundle size.
 */

import type { PostHog } from 'posthog-js';
import { useSettingsStore } from '@/core/store/settings';
import { getStableUserId } from './identity';
import { isTrackingOptOut } from './privacy';

// INITIALIZATION (LAZY LOADED)

let posthogInstance: PostHog | null = null;
let initPromise: Promise<void> | null = null;
let eventQueue: Array<{ name: string; properties: Record<string, unknown> }> = [];
/** Re-entrancy guard: prevents infinite loops if captureException itself throws */
let isCapturingGlobalError = false;

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

  // Check if analytics is enabled in settings
  const { analyticsEnabled } = useSettingsStore.getState().settings;
  if (!analyticsEnabled) return;

  // Respect browser privacy signals (GPC / DNT)
  if (isTrackingOptOut()) return;

  const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined;

  if (!key) {
    console.warn('Posthog API key not set, analytics disabled');
    return;
  }

  // Lazy load posthog-js
  initPromise = import('posthog-js')
    .then(async ({ default: posthog }) => {
      posthog.init(key, {
        api_host: '/ph',
        ui_host: 'https://us.posthog.com',
        capture_pageview: false, // Manual pageview - auto mode fires on every replaceState
        capture_pageleave: true,
        persistence: 'localStorage',
        autocapture: false, // We'll track specific events manually

        // Error tracking - auto-capture exceptions
        capture_exceptions: true,

        // Performance monitoring - web vitals
        capture_performance: true,
      });
      posthogInstance = posthog;

      // Fire a single pageview on app load
      posthog.capture('$pageview');

      // Identify user with stable ID for person properties & cohorts
      const userId = getStableUserId();
      posthog.identify(userId);

      // Set person properties (these persist across sessions)
      // Deferred import to avoid circular dependency: events.ts imports capture from init.ts.
      // This makes the .then() callback async, which means error handlers below are installed
      // after this await resolves. PostHog's capture_exceptions: true provides native coverage
      // during that brief gap, so no errors are lost.
      const {
        updatePersonProperties,
        captureException,
        listenForPwaInstall,
        captureUtmParameters,
      } = await import('./events');
      updatePersonProperties();
      captureUtmParameters();
      listenForPwaInstall();

      // Flush queued events
      for (const event of eventQueue) {
        posthog.capture(event.name, event.properties);
      }
      eventQueue = [];

      // Install global error handlers for structured exception capture.
      // PostHog's auto-capture sends raw browser events with null message/type.
      // These handlers intercept errors first and send structured data.
      // A re-entrancy guard prevents infinite loops if captureException itself throws.
      window.addEventListener('error', (event: ErrorEvent) => {
        if (isCapturingGlobalError) return;
        isCapturingGlobalError = true;
        try {
          if (event.error instanceof Error) {
            captureException(event.error, {
              source: 'window.onerror',
              file: event.filename,
              line: event.lineno,
              column: event.colno,
            });
          }
        } finally {
          isCapturingGlobalError = false;
        }
      });

      window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        if (isCapturingGlobalError) return;
        isCapturingGlobalError = true;
        try {
          const error =
            event.reason instanceof Error ? event.reason : new Error(String(event.reason));
          captureException(error, {
            source: 'unhandledrejection',
          });
        } finally {
          isCapturingGlobalError = false;
        }
      });
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
