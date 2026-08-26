// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsData } from './identity';

const setPersonProperties = vi.fn();

vi.mock('./init', () => ({
  getPosthogInstance: () => ({ setPersonProperties }),
}));

vi.mock('./trackEvent', () => ({
  getDeviceType: () => 'desktop',
}));

// Stateful stand-in for the persisted analytics record: the dedupe guard
// lives in this record, so the mock must behave like storage (writes are
// visible to later loads), not return a fresh object per call.
let record: AnalyticsData;

vi.mock('./identity', () => ({
  loadAnalyticsData: () => record,
  saveAnalyticsData: (data: AnalyticsData) => {
    record = data;
  },
  getFirstSeenDate: () => '2026-01-01T00:00:00.000Z',
}));

import { computeEngagementTier, updatePersonProperties } from './eventsPerson';

beforeEach(() => {
  setPersonProperties.mockReset();
  record = {
    userId: 'u1',
    firstSeen: '2026-01-01T00:00:00.000Z',
    featureFlags: {},
    milestones: {},
    designsCreated: 0,
    lastSetPayload: '',
    onceTraitsSent: false,
  };
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

  it('sends the once-only traits a single time per browser', () => {
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

  // Last in the file: vi.resetModules() re-creates the store modules, so any
  // test running after it would read different store instances than the
  // statically imported updatePersonProperties above.
  it('does not resend after a reload when nothing changed', async () => {
    vi.resetModules();
    const firstLoad = await import('./eventsPerson');
    firstLoad.updatePersonProperties();
    expect(setCalls()).toHaveLength(1);
    expect(setOnceCalls()).toHaveLength(1);

    // A reload discards module state but keeps the persisted record.
    vi.resetModules();
    const secondLoad = await import('./eventsPerson');
    secondLoad.updatePersonProperties();

    expect(setCalls()).toHaveLength(1);
    expect(setOnceCalls()).toHaveLength(1);
  });
});

describe('computeEngagementTier', () => {
  it('classifies by whichever of layout count or bin count is reached first', () => {
    expect(computeEngagementTier(0, 0)).toBe('new');
    expect(computeEngagementTier(2, 0)).toBe('active');
    expect(computeEngagementTier(5, 0)).toBe('power');
    // Second argument is distinct designs created, matching the designer
    // milestone rungs: one design is `first_design`, eight is `designs_8`.
    expect(computeEngagementTier(0, 1)).toBe('active');
    expect(computeEngagementTier(0, 7)).toBe('active');
    expect(computeEngagementTier(0, 8)).toBe('power');
    // A single layout and no designs is not engagement, however many bins are
    // in it — the bin count that used to reach 'active' here was synthesised.
    expect(computeEngagementTier(1, 0)).toBe('new');
  });
});
