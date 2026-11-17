// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlagResolution } from '@/shared/analytics/posthog/flags';
import {
  ANALYTICS_STORAGE_KEY,
  loadAnalyticsData,
  pruneAnalyticsData,
  saveAnalyticsData,
} from '@/shared/analytics/posthog/identity';

const flag = vi.hoisted(() => ({
  resolve: vi.fn<(key: string, timeoutMs: number) => Promise<FlagResolution>>(),
}));
const settings = vi.hoisted(() => ({ analyticsEnabled: true }));

vi.mock('@/shared/analytics/posthog/flags', () => ({ resolveFeatureFlag: flag.resolve }));
vi.mock('@/core/store/settings', () => ({
  useSettingsStore: { getState: () => ({ settings }) },
}));

import { applyLandingExperiment, isFirstVisit, LANDING_FLAG_KEY } from './landingExperiment';

function visit(url: string): void {
  window.history.replaceState(null, '', url);
}

function currentUrl(): string {
  return window.location.pathname + window.location.search;
}

function enroll(variant: 'control' | 'test'): void {
  saveAnalyticsData({ ...loadAnalyticsData(), userId: 'u1', landingVariant: variant });
}

function serve(value: string | boolean | undefined): void {
  flag.resolve.mockResolvedValue({ loaded: true, value });
}

describe('applyLandingExperiment', () => {
  const realAgent = navigator.userAgent;

  beforeEach(() => {
    pruneAnalyticsData();
    settings.analyticsEnabled = true;
    flag.resolve.mockReset();
    visit('/');
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: realAgent, configurable: true });
  });

  it('opens the designer for a first visit in the test arm and keeps campaign params', async () => {
    visit('/?utm_source=reddit');
    serve('test');

    await applyLandingExperiment(true);

    expect(currentUrl()).toBe('/designer?utm_source=reddit');
    expect(loadAnalyticsData().landingVariant).toBe('test');
    expect(flag.resolve).toHaveBeenCalledWith(LANDING_FLAG_KEY, expect.any(Number));
  });

  it('keeps the planner for a first visit in the control arm and records the arm', async () => {
    serve('control');

    await applyLandingExperiment(true);

    expect(currentUrl()).toBe('/');
    expect(loadAnalyticsData().landingVariant).toBe('control');
  });

  it('does not enroll a first visit when the flag misses the wait', async () => {
    flag.resolve.mockResolvedValue({ loaded: false });

    await applyLandingExperiment(true);

    expect(currentUrl()).toBe('/');
    expect(loadAnalyticsData().landingVariant).toBe('');
  });

  it('does not enroll a first visit outside the rollout', async () => {
    serve(false);

    await applyLandingExperiment(true);

    expect(currentUrl()).toBe('/');
    expect(loadAnalyticsData().landingVariant).toBe('');
  });

  it('never asks for the flag on a later visit of a browser that was not enrolled', async () => {
    await applyLandingExperiment(false);

    expect(flag.resolve).not.toHaveBeenCalled();
  });

  it('opens the designer at once for an enrolled test visitor, without waiting on PostHog', async () => {
    enroll('test');
    flag.resolve.mockReturnValue(new Promise(() => {}));

    await applyLandingExperiment(false);

    expect(currentUrl()).toBe('/designer');
  });

  it('unenrolls a visitor once the flag is turned off', async () => {
    enroll('test');
    serve(false);

    await applyLandingExperiment(false);
    await vi.waitFor(() => expect(loadAnalyticsData().landingVariant).toBe(''));
  });

  it.each([
    [
      'turns analytics off',
      () => {
        settings.analyticsEnabled = false;
        pruneAnalyticsData();
      },
    ],
    [
      'turns analytics off and on again',
      () => {
        pruneAnalyticsData();
        saveAnalyticsData({ ...loadAnalyticsData(), userId: 'u2' });
      },
    ],
  ])('does not enroll again a visitor who %s while the refresh waits', async (_label, optOut) => {
    enroll('test');
    let deliver: (result: FlagResolution) => void = () => {};
    flag.resolve.mockReturnValue(new Promise((resolve) => (deliver = resolve)));

    await applyLandingExperiment(false);
    optOut();
    deliver({ loaded: true, value: 'test' });
    await Promise.resolve();

    expect(loadAnalyticsData().landingVariant).toBe('');
  });

  it.each([
    ['a layout link', '/l/abc123/kitchen'],
    ['a query the app reads', '/?share=abc'],
    ['a hash', '/#import'],
    ['another tool', '/baseplate'],
  ])('leaves %s alone', async (_label, url) => {
    visit(url);
    serve('test');

    await applyLandingExperiment(true);

    expect(currentUrl() + window.location.hash).toBe(url);
    expect(flag.resolve).not.toHaveBeenCalled();
  });

  it('leaves crawlers on the planner', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      configurable: true,
    });
    serve('test');

    await applyLandingExperiment(true);

    expect(currentUrl()).toBe('/');
    expect(flag.resolve).not.toHaveBeenCalled();
  });

  it('leaves a visitor who turned analytics off on the planner, even if enrolled', async () => {
    enroll('test');
    settings.analyticsEnabled = false;

    await applyLandingExperiment(false);

    expect(currentUrl()).toBe('/');
  });
});

describe('isFirstVisit', () => {
  it('is true only before the analytics record exists', () => {
    localStorage.removeItem(ANALYTICS_STORAGE_KEY);
    expect(isFirstVisit()).toBe(true);

    localStorage.setItem(ANALYTICS_STORAGE_KEY, '{}');
    expect(isFirstVisit()).toBe(false);
  });
});
