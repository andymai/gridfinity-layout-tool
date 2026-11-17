// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagsCallback } from 'posthog-js';

const ready = vi.hoisted((): { instance: unknown } => ({ instance: null }));

vi.mock('./init', () => ({ whenPosthogReady: () => Promise.resolve(ready.instance) }));

import { resolveFeatureFlag } from './flags';

function fakePosthog(options: { loadedValue?: string | boolean; alreadyLoaded?: boolean } = {}) {
  let handler: FeatureFlagsCallback | undefined;
  const unsubscribe = vi.fn();
  const posthog = {
    getFeatureFlag: vi.fn(() => options.loadedValue),
    onFeatureFlags: vi.fn((callback: FeatureFlagsCallback) => {
      handler = callback;
      if (options.alreadyLoaded) callback([], {});
      return unsubscribe;
    }),
    deliver: (errorsLoading = false) => handler?.([], {}, { errorsLoading }),
    unsubscribe,
  };
  return posthog;
}

describe('resolveFeatureFlag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    ready.instance = null;
  });

  it('reads the flag from the server response', async () => {
    const posthog = fakePosthog({ loadedValue: 'test' });
    ready.instance = posthog;

    const pending = resolveFeatureFlag('landing', 1000);
    await vi.waitFor(() => expect(posthog.onFeatureFlags).toHaveBeenCalled());
    posthog.deliver();

    await expect(pending).resolves.toEqual({ loaded: true, value: 'test' });
    expect(posthog.getFeatureFlag).toHaveBeenCalledWith('landing', { fresh: true });
    expect(posthog.unsubscribe).toHaveBeenCalled();
  });

  it('reports a flag the server does not return as loaded, so callers do not wait it out', async () => {
    const posthog = fakePosthog({ loadedValue: undefined });
    ready.instance = posthog;

    const pending = resolveFeatureFlag('landing', 1000);
    await vi.waitFor(() => expect(posthog.onFeatureFlags).toHaveBeenCalled());
    posthog.deliver();

    await expect(pending).resolves.toEqual({ loaded: true, value: undefined });
  });

  it('reads nothing after a timeout, so no exposure is sent for a value that came too late', async () => {
    const posthog = fakePosthog({ loadedValue: 'test' });
    ready.instance = posthog;

    const pending = resolveFeatureFlag('landing', 1000);
    await vi.waitFor(() => expect(posthog.onFeatureFlags).toHaveBeenCalled());
    vi.advanceTimersByTime(1000);
    posthog.deliver();

    await expect(pending).resolves.toEqual({ loaded: false });
    expect(posthog.getFeatureFlag).not.toHaveBeenCalled();
    expect(posthog.unsubscribe).toHaveBeenCalled();
  });

  it('reads nothing when the flag request fails', async () => {
    const posthog = fakePosthog({ loadedValue: 'test' });
    ready.instance = posthog;

    const pending = resolveFeatureFlag('landing', 1000);
    await vi.waitFor(() => expect(posthog.onFeatureFlags).toHaveBeenCalled());
    posthog.deliver(true);

    await expect(pending).resolves.toEqual({ loaded: false });
    expect(posthog.getFeatureFlag).not.toHaveBeenCalled();
  });

  it('reads nothing when analytics never starts', async () => {
    await expect(resolveFeatureFlag('landing', 1000)).resolves.toEqual({ loaded: false });
  });

  it('unsubscribes when flags were already in and the callback ran synchronously', async () => {
    const posthog = fakePosthog({ loadedValue: 'control', alreadyLoaded: true });
    ready.instance = posthog;

    await expect(resolveFeatureFlag('landing', 1000)).resolves.toEqual({
      loaded: true,
      value: 'control',
    });
    expect(posthog.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
