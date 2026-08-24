import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSettingsStore } from '@/core/store/settings';
import { useViewStore } from '@/core/store/view';
import { useWhatsNewAutoOpen } from './useWhatsNewAutoOpen';
import { getSeenState, reloadSeenState } from '../seenState';
import { LATEST_ENTRY_ID } from '../latest';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** A returning user: caught up as of an older entry, last nagged long ago. */
function seenLongAgo(lastSeenId = 'some-older-entry'): void {
  localStorage.setItem(
    'gridfinity-whats-new-v1',
    JSON.stringify({ lastSeenId, lastAutoOpenAt: Date.now() - WEEK_MS - 1000 })
  );
  reloadSeenState();
}

function isOpen(): boolean {
  return useViewStore.getState().whatsNewOpen;
}

describe('useWhatsNewAutoOpen', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    reloadSeenState();
    useViewStore.getState().setWhatsNewOpen(false);
    useSettingsStore.getState().updateSetting('showUpdateSummaries', true);
  });

  it('opens for a returning user with unseen highlights', () => {
    seenLongAgo();
    renderHook(() => useWhatsNewAutoOpen({ allowed: true }));
    expect(isOpen()).toBe(true);
  });

  it('stays quiet on a first-ever visit, and seeds the marker instead', () => {
    renderHook(() => useWhatsNewAutoOpen({ allowed: true }));
    expect(isOpen()).toBe(false);
    expect(getSeenState().lastSeenId).toBe(LATEST_ENTRY_ID);
  });

  it('stays quiet when nothing is unseen', () => {
    seenLongAgo(LATEST_ENTRY_ID);
    renderHook(() => useWhatsNewAutoOpen({ allowed: true }));
    expect(isOpen()).toBe(false);
  });

  it('stays quiet inside the weekly cooldown', () => {
    localStorage.setItem(
      'gridfinity-whats-new-v1',
      JSON.stringify({ lastSeenId: 'some-older-entry', lastAutoOpenAt: Date.now() - 1000 })
    );
    reloadSeenState();
    renderHook(() => useWhatsNewAutoOpen({ allowed: true }));
    expect(isOpen()).toBe(false);
  });

  it('stays quiet when the arrival came for something else', () => {
    seenLongAgo();
    renderHook(() => useWhatsNewAutoOpen({ allowed: false }));
    expect(isOpen()).toBe(false);
  });

  it('still seeds a first-time visitor who arrives on a suppressed route', () => {
    // Otherwise their marker stays empty and the sidebar badges them forever.
    renderHook(() => useWhatsNewAutoOpen({ allowed: false }));
    expect(isOpen()).toBe(false);
    expect(getSeenState().lastSeenId).toBe(LATEST_ENTRY_ID);
  });

  it('stays quiet when update summaries are turned off', () => {
    seenLongAgo();
    useSettingsStore.getState().updateSetting('showUpdateSummaries', false);
    renderHook(() => useWhatsNewAutoOpen({ allowed: true }));
    expect(isOpen()).toBe(false);
  });

  it('opens once per browser session, not on a mid-session reload', () => {
    seenLongAgo();
    renderHook(() => useWhatsNewAutoOpen({ allowed: true }));
    expect(isOpen()).toBe(true);

    // A silent PWA update reload keeps sessionStorage, so remounting must not re-open.
    useViewStore.getState().setWhatsNewOpen(false);
    seenLongAgo();
    renderHook(() => useWhatsNewAutoOpen({ allowed: true }));
    expect(isOpen()).toBe(false);
  });

  it('records the opening so the next one waits a week', () => {
    seenLongAgo();
    const before = getSeenState().lastAutoOpenAt;
    renderHook(() => useWhatsNewAutoOpen({ allowed: true }));
    expect(getSeenState().lastAutoOpenAt).toBeGreaterThan(before);
  });

  it('does not consume the session claim when suppressed', () => {
    seenLongAgo();
    renderHook(() => useWhatsNewAutoOpen({ allowed: false }));
    expect(isOpen()).toBe(false);

    // The share link is gone; the same session should still get its digest.
    renderHook(() => useWhatsNewAutoOpen({ allowed: true }));
    expect(isOpen()).toBe(true);
  });
});
