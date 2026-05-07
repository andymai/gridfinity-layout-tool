import { describe, it, expect, beforeEach } from 'vitest';
import { useSyncStatusStore } from './status';

describe('useSyncStatusStore', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().reset();
  });

  it('starts in idle with no pending items and no lastSyncedAt', () => {
    const s = useSyncStatusStore.getState();
    expect(s.state).toBe('idle');
    expect(s.pendingCount).toBe(0);
    expect(s.lastSyncedAt).toBeUndefined();
    expect(s.lastError).toBeUndefined();
  });

  it('beginSync transitions idle → syncing', () => {
    useSyncStatusStore.getState().beginSync();
    expect(useSyncStatusStore.getState().state).toBe('syncing');
  });

  it('beginSync is idempotent when already syncing', () => {
    useSyncStatusStore.getState().beginSync();
    useSyncStatusStore.getState().beginSync();
    expect(useSyncStatusStore.getState().state).toBe('syncing');
  });

  it('succeed clears the error and stamps lastSyncedAt', () => {
    useSyncStatusStore.getState().reportError('quota exceeded');
    expect(useSyncStatusStore.getState().lastError).toBe('quota exceeded');

    const before = Date.now();
    useSyncStatusStore.getState().succeed();
    const s = useSyncStatusStore.getState();
    expect(s.state).toBe('idle');
    expect(s.lastError).toBeUndefined();
    expect(s.lastSyncedAt).toBeGreaterThanOrEqual(before);
  });

  it('succeed leaves state as syncing when items remain in the outbox', () => {
    useSyncStatusStore.getState().setPendingCount(3);
    useSyncStatusStore.getState().beginSync();
    useSyncStatusStore.getState().succeed();
    expect(useSyncStatusStore.getState().state).toBe('syncing');
  });

  it('reportOffline transitions to offline and stores the message', () => {
    useSyncStatusStore.getState().reportOffline('fetch failed');
    const s = useSyncStatusStore.getState();
    expect(s.state).toBe('offline');
    expect(s.lastError).toBe('fetch failed');
  });

  it('reportError transitions to error', () => {
    useSyncStatusStore.getState().reportError('Quota exceeded (count): 101 of 100.');
    const s = useSyncStatusStore.getState();
    expect(s.state).toBe('error');
    expect(s.lastError).toContain('Quota exceeded');
  });

  it('setPendingCount clamps to non-negative', () => {
    useSyncStatusStore.getState().setPendingCount(-5);
    expect(useSyncStatusStore.getState().pendingCount).toBe(0);
    useSyncStatusStore.getState().setPendingCount(7);
    expect(useSyncStatusStore.getState().pendingCount).toBe(7);
  });

  it('reset returns the store to its initial shape', () => {
    useSyncStatusStore.getState().reportError('boom');
    useSyncStatusStore.getState().setPendingCount(3);
    useSyncStatusStore.getState().reset();

    const s = useSyncStatusStore.getState();
    expect(s.state).toBe('idle');
    expect(s.pendingCount).toBe(0);
    expect(s.lastError).toBeUndefined();
    expect(s.lastSyncedAt).toBeUndefined();
  });
});
