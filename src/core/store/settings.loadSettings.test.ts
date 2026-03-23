// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadSettings } from './settings.normalize';

// Mock localStorage backend to control what loadSettings reads
vi.mock('@/core/storage/backends/localStorage', () => ({
  loadFromLocalStorage: vi.fn(),
  saveToLocalStorage: vi.fn(),
}));

// Mock the tracking opt-out check
vi.mock('@/shared/analytics/posthog/privacy', () => ({
  isTrackingOptOut: vi.fn(() => false),
}));

import { loadFromLocalStorage } from '@/core/storage/backends/localStorage';
import { isTrackingOptOut } from '@/shared/analytics/posthog/privacy';

describe('loadSettings - browser privacy signals', () => {
  afterEach(() => {
    vi.mocked(isTrackingOptOut).mockReturnValue(false);
  });

  it('defaults analyticsEnabled to true when no privacy signal', () => {
    vi.mocked(loadFromLocalStorage).mockReturnValue({ ok: true, value: null });
    vi.mocked(isTrackingOptOut).mockReturnValue(false);
    const settings = loadSettings();
    expect(settings.analyticsEnabled).toBe(true);
  });

  it('defaults analyticsEnabled to false when privacy signal detected (new user)', () => {
    vi.mocked(loadFromLocalStorage).mockReturnValue({ ok: true, value: null });
    vi.mocked(isTrackingOptOut).mockReturnValue(true);
    const settings = loadSettings();
    expect(settings.analyticsEnabled).toBe(false);
  });

  it('respects explicit user choice even when privacy signal is active', () => {
    vi.mocked(loadFromLocalStorage).mockReturnValue({
      ok: true,
      value: { analyticsEnabled: true },
    });
    vi.mocked(isTrackingOptOut).mockReturnValue(true);
    const settings = loadSettings();
    expect(settings.analyticsEnabled).toBe(true);
  });

  it('respects explicit opt-out even when no privacy signal', () => {
    vi.mocked(loadFromLocalStorage).mockReturnValue({
      ok: true,
      value: { analyticsEnabled: false },
    });
    vi.mocked(isTrackingOptOut).mockReturnValue(false);
    const settings = loadSettings();
    expect(settings.analyticsEnabled).toBe(false);
  });
});
