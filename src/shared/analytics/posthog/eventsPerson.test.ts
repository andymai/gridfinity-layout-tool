// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setPersonProperties = vi.fn();

vi.mock('./init', () => ({
  getPosthogInstance: () => ({ setPersonProperties }),
}));

vi.mock('./trackEvent', () => ({
  getDeviceType: () => 'desktop',
}));

vi.mock('./identity', () => ({
  loadAnalyticsData: () => ({ featureFlags: {} }),
  saveAnalyticsData: vi.fn(),
  getFirstSeenDate: () => '2026-01-01T00:00:00.000Z',
}));

import {
  computeEngagementTier,
  updatePersonProperties,
  resetPersonPropertyCache,
} from './eventsPerson';

beforeEach(() => {
  setPersonProperties.mockReset();
  resetPersonPropertyCache();
});

/** Calls that carry a non-empty first argument are `$set`; the rest are `$set_once`. */
const setCalls = (): unknown[][] =>
  setPersonProperties.mock.calls.filter((call) => Object.keys(call[0] ?? {}).length > 0);

const setOnceCalls = (): unknown[][] =>
  setPersonProperties.mock.calls.filter((call) => Object.keys(call[0] ?? {}).length === 0);

describe('updatePersonProperties', () => {
  it('sends the profile on the first call', () => {
    updatePersonProperties();

    expect(setCalls()).toHaveLength(1);
    expect(setOnceCalls()).toHaveLength(1);
  });

  it('does not resend an unchanged profile', () => {
    updatePersonProperties();
    updatePersonProperties();
    updatePersonProperties();

    expect(setCalls()).toHaveLength(1);
  });

  it('sends the once-only traits a single time per session', () => {
    updatePersonProperties();
    updatePersonProperties();

    expect(setOnceCalls()).toHaveLength(1);
  });

  it('omits last_active so an unchanged profile stays byte-identical', () => {
    updatePersonProperties();

    expect(setCalls()[0][0]).not.toHaveProperty('last_active');
  });

  it('resends once a tracked value actually changes', async () => {
    const { useLibraryStore } = await import('@/core/store/library');
    updatePersonProperties();

    useLibraryStore.setState((state) => ({
      library: {
        ...state.library,
        entries: [...state.library.entries, { id: 'l1', name: 'one', updatedAt: 0, binCount: 1 }],
      },
    }));
    updatePersonProperties();

    expect(setCalls()).toHaveLength(2);
  });
});

describe('computeEngagementTier', () => {
  it('classifies by whichever of layout count or bin count is reached first', () => {
    expect(computeEngagementTier(0, 0)).toBe('new');
    expect(computeEngagementTier(2, 0)).toBe('active');
    expect(computeEngagementTier(0, 20)).toBe('active');
    expect(computeEngagementTier(5, 0)).toBe('power');
    expect(computeEngagementTier(0, 100)).toBe('power');
  });
});
