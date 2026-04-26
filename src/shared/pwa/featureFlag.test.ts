// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/shared/analytics/posthog/init', () => ({
  getPosthogInstance: vi.fn(),
}));

import { getSmokeGateFlag, _resetSmokeGateFlagCache } from './featureFlag';
import { getPosthogInstance } from '@/shared/analytics/posthog/init';

const FLAG_KEY = 'pwa-smoke-gate-enabled';

describe('getSmokeGateFlag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetSmokeGateFlagCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    _resetSmokeGateFlagCache();
  });

  it('returns false when PostHog is not initialized', async () => {
    vi.mocked(getPosthogInstance).mockReturnValue(null);
    await expect(getSmokeGateFlag()).resolves.toBe(false);
  });

  it('returns true when PostHog reports the flag enabled', async () => {
    const onFeatureFlags = vi.fn((cb: () => void) => {
      cb();
    });
    const getFeatureFlag = vi.fn().mockReturnValue(true);
    vi.mocked(getPosthogInstance).mockReturnValue({
      onFeatureFlags,
      getFeatureFlag,
    } as unknown as ReturnType<typeof getPosthogInstance>);

    await expect(getSmokeGateFlag()).resolves.toBe(true);
    expect(getFeatureFlag).toHaveBeenCalledWith(FLAG_KEY);
  });

  it('returns false when PostHog reports the flag explicitly false', async () => {
    vi.mocked(getPosthogInstance).mockReturnValue({
      onFeatureFlags: (cb: () => void) => cb(),
      getFeatureFlag: () => false,
    } as unknown as ReturnType<typeof getPosthogInstance>);

    await expect(getSmokeGateFlag()).resolves.toBe(false);
  });

  it('returns false when PostHog returns undefined (flag not yet loaded)', async () => {
    vi.mocked(getPosthogInstance).mockReturnValue({
      onFeatureFlags: (cb: () => void) => cb(),
      getFeatureFlag: () => undefined,
    } as unknown as ReturnType<typeof getPosthogInstance>);

    await expect(getSmokeGateFlag()).resolves.toBe(false);
  });

  it('returns false when PostHog returns a string variant (only boolean true counts)', async () => {
    vi.mocked(getPosthogInstance).mockReturnValue({
      onFeatureFlags: (cb: () => void) => cb(),
      getFeatureFlag: () => 'control',
    } as unknown as ReturnType<typeof getPosthogInstance>);

    await expect(getSmokeGateFlag()).resolves.toBe(false);
  });

  it('returns false after 2s when onFeatureFlags never fires', async () => {
    vi.mocked(getPosthogInstance).mockReturnValue({
      onFeatureFlags: vi.fn(),
      getFeatureFlag: vi.fn(),
    } as unknown as ReturnType<typeof getPosthogInstance>);

    const promise = getSmokeGateFlag();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(promise).resolves.toBe(false);
  });

  it('returns false when onFeatureFlags throws synchronously', async () => {
    vi.mocked(getPosthogInstance).mockReturnValue({
      onFeatureFlags: () => {
        throw new Error('PostHog blocked');
      },
      getFeatureFlag: vi.fn(),
    } as unknown as ReturnType<typeof getPosthogInstance>);

    await expect(getSmokeGateFlag()).resolves.toBe(false);
  });
});
