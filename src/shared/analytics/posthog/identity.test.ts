// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ANALYTICS_STORAGE_KEY,
  loadAnalyticsData,
  pruneAnalyticsData,
  syncAnalyticsDataAcrossWindows,
} from './identity';

function writeFromOtherWindow(featureFlags: Record<string, boolean>, key: string | null): void {
  const stored = { ...loadAnalyticsData(), featureFlags };
  localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(stored));
  window.dispatchEvent(new StorageEvent('storage', { key }));
}

describe('syncAnalyticsDataAcrossWindows', () => {
  beforeAll(() => {
    syncAnalyticsDataAcrossWindows();
  });

  beforeEach(() => {
    pruneAnalyticsData();
    loadAnalyticsData();
  });

  it('reads the record again after another window writes it', () => {
    writeFromOtherWindow({ pwa_standalone: true }, ANALYTICS_STORAGE_KEY);

    expect(loadAnalyticsData().featureFlags.pwa_standalone).toBe(true);
  });

  it('reads the record again after another window clears storage', () => {
    writeFromOtherWindow({ pwa_standalone: true }, null);

    expect(loadAnalyticsData().featureFlags.pwa_standalone).toBe(true);
  });

  it('keeps the cache when another window writes a different key', () => {
    writeFromOtherWindow({ pwa_standalone: true }, 'gridfinity-settings-v1');

    expect(loadAnalyticsData().featureFlags.pwa_standalone).toBeUndefined();
  });
});
