import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSeenState,
  hasUnseen,
  isCooldownElapsed,
  markAllSeen,
  recordAutoOpen,
  reloadSeenState,
  seedIfFirstRun,
} from './seenState';
import { LATEST_ENTRY_ID } from './latest';

describe('seenState', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadSeenState();
    vi.useRealTimers();
  });

  it('does not badge a browser that has never been recorded', () => {
    // A first-time visitor is not behind, and must not be badged on the first
    // paint before seedIfFirstRun() has run.
    expect(hasUnseen(getSeenState())).toBe(false);
  });

  it('badges a browser whose marker is behind the newest entry', () => {
    localStorage.setItem(
      'gridfinity-whats-new-v1',
      JSON.stringify({ lastSeenId: 'an-older-entry', lastAutoOpenAt: 0 })
    );
    reloadSeenState();
    expect(hasUnseen(getSeenState())).toBe(true);
  });

  it('seeds a first run without leaving anything unseen', () => {
    expect(seedIfFirstRun()).toBe(true);
    expect(hasUnseen(getSeenState())).toBe(false);
    expect(getSeenState().lastSeenId).toBe(LATEST_ENTRY_ID);
  });

  it('only seeds once', () => {
    expect(seedIfFirstRun()).toBe(true);
    expect(seedIfFirstRun()).toBe(false);
  });

  it('starts the cooldown when it seeds, so a new browser waits a week', () => {
    seedIfFirstRun();
    expect(isCooldownElapsed(getSeenState())).toBe(false);
  });

  it('clears the unseen flag when marked', () => {
    markAllSeen();
    expect(hasUnseen(getSeenState())).toBe(false);
  });

  it('treats a stale marker as unseen', () => {
    markAllSeen();
    localStorage.setItem(
      'gridfinity-whats-new-v1',
      JSON.stringify({ lastSeenId: 'retired-entry', lastAutoOpenAt: 0 })
    );
    reloadSeenState();
    expect(hasUnseen(getSeenState())).toBe(true);
  });

  it('holds the cooldown for a week after an automatic open', () => {
    recordAutoOpen();
    expect(isCooldownElapsed(getSeenState())).toBe(false);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(isCooldownElapsed(getSeenState())).toBe(true);
  });

  it('survives unparseable stored state', () => {
    localStorage.setItem('gridfinity-whats-new-v1', 'not json');
    reloadSeenState();
    expect(() => getSeenState()).not.toThrow();
    expect(getSeenState().lastSeenId).toBe('');
  });
});
