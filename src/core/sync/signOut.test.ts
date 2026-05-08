// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runSignOut, type KeepLocalPrompt } from './signOut';
import type { SyncAdapter, SyncAdapters, SyncableItem } from './adapters/types';

const flushNowMock = vi.fn();
const getPendingEntriesMock = vi.fn();
const apiSignOutMock = vi.fn();
const clearOutboxMock = vi.fn();
const stopEngineMock = vi.fn();

vi.mock('./engine', () => ({
  flushNow: () => flushNowMock(),
  getPendingEntries: () => getPendingEntriesMock(),
  stop: () => stopEngineMock(),
}));

vi.mock('./session/sessionApi', () => ({
  signOut: () => apiSignOutMock(),
}));

vi.mock('./outbox', () => ({
  clearAll: () => clearOutboxMock(),
}));

interface MockAdapter extends SyncAdapter {
  items: Map<string, SyncableItem>;
}

function makeAdapter(): MockAdapter {
  const items = new Map<string, SyncableItem>();
  return {
    items,
    list: vi.fn(async () => Array.from(items.values())),
    get: vi.fn(),
    applyRemote: vi.fn(),
    applyRemoteDelete: vi.fn(async (id) => {
      items.delete(id);
    }),
    subscribe: vi.fn(() => () => {}),
  };
}

let layouts: MockAdapter;
let designs: MockAdapter;
let adapters: SyncAdapters;
const onAnonymous = vi.fn();
const promptKeep: KeepLocalPrompt = vi.fn(async () => 'keep');
const promptWipe: KeepLocalPrompt = vi.fn(async () => 'wipe');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  layouts = makeAdapter();
  designs = makeAdapter();
  adapters = { layouts, designs };
  flushNowMock.mockResolvedValue(undefined);
  getPendingEntriesMock.mockResolvedValue([]);
  apiSignOutMock.mockResolvedValue(undefined);
});

describe('runSignOut — keep path (default)', () => {
  it('returns "kept" without wiping local items', async () => {
    layouts.items.set('a', { id: 'a', payload: {}, modifiedAt: 1000 });
    const result = await runSignOut({
      adapters,
      promptKeepLocal: promptKeep,
      onAnonymous,
    });
    expect(result.status).toBe('kept');
    expect(layouts.applyRemoteDelete).not.toHaveBeenCalled();
    expect(clearOutboxMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('gflt-last-signed-in-user')).toBe(null);
    expect(apiSignOutMock).toHaveBeenCalled();
    expect(onAnonymous).toHaveBeenCalled();
  });

  it('preserves lastSignedInUserId so a same-account re-sign-in is silent', async () => {
    localStorage.setItem('gflt-last-signed-in-user', 'user-1');
    await runSignOut({ adapters, promptKeepLocal: promptKeep, onAnonymous });
    expect(localStorage.getItem('gflt-last-signed-in-user')).toBe('user-1');
  });
});

describe('runSignOut — wipe path', () => {
  it('returns "wiped" and clears local items, outbox, and lastSignedInUserId', async () => {
    layouts.items.set('a', { id: 'a', payload: {}, modifiedAt: 1000 });
    designs.items.set('d', { id: 'd', payload: {}, modifiedAt: 1000 });
    localStorage.setItem('gflt-last-signed-in-user', 'user-1');

    const result = await runSignOut({
      adapters,
      promptKeepLocal: promptWipe,
      onAnonymous,
    });

    expect(result.status).toBe('wiped');
    expect(layouts.applyRemoteDelete).toHaveBeenCalledWith('a');
    expect(designs.applyRemoteDelete).toHaveBeenCalledWith('d');
    expect(clearOutboxMock).toHaveBeenCalled();
    expect(localStorage.getItem('gflt-last-signed-in-user')).toBe(null);
    expect(onAnonymous).toHaveBeenCalled();
  });
});

describe('runSignOut — outbox flush', () => {
  it('skips flush when outbox is empty (keep path)', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([]);
    await runSignOut({ adapters, promptKeepLocal: promptKeep, onAnonymous });
    expect(flushNowMock).not.toHaveBeenCalled();
  });

  it('attempts a flush when items are pending (keep path)', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'a', op: 'put', modifiedAt: 1000 },
    ]);
    await runSignOut({ adapters, promptKeepLocal: promptKeep, onAnonymous });
    expect(flushNowMock).toHaveBeenCalled();
  });

  it('wipe path clears outbox before wiping local items (leak-safe order)', async () => {
    const order: string[] = [];
    clearOutboxMock.mockImplementation(async () => {
      order.push('clearOutbox');
    });
    layouts.applyRemoteDelete = vi.fn(async () => {
      order.push('wipe');
    });
    layouts.items.set('a', { id: 'a', payload: {}, modifiedAt: 1000 });
    await runSignOut({ adapters, promptKeepLocal: promptWipe, onAnonymous });
    expect(order.indexOf('clearOutbox')).toBeLessThan(order.indexOf('wipe'));
  });

  it('wipe path stops the engine before wiping so a poll cannot race new items in', async () => {
    const order: string[] = [];
    stopEngineMock.mockImplementation(() => {
      order.push('stop');
    });
    clearOutboxMock.mockImplementation(async () => {
      order.push('clearOutbox');
    });
    layouts.applyRemoteDelete = vi.fn(async () => {
      order.push('wipe');
    });
    layouts.items.set('a', { id: 'a', payload: {}, modifiedAt: 1000 });
    await runSignOut({ adapters, promptKeepLocal: promptWipe, onAnonymous });
    expect(order[0]).toBe('stop');
    expect(order.indexOf('stop')).toBeLessThan(order.indexOf('wipe'));
  });

  it('skips flush on wipe path (clearOutbox makes flush wasted work)', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'a', op: 'put', modifiedAt: 1000 },
    ]);
    await runSignOut({ adapters, promptKeepLocal: promptWipe, onAnonymous });
    expect(flushNowMock).not.toHaveBeenCalled();
    expect(clearOutboxMock).toHaveBeenCalled();
  });

  it('skips flush on cancel (no logout, no flush)', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'a', op: 'put', modifiedAt: 1000 },
    ]);
    const promptCancel: KeepLocalPrompt = vi.fn(async () => 'cancel');
    const result = await runSignOut({ adapters, promptKeepLocal: promptCancel, onAnonymous });
    expect(result.status).toBe('cancelled');
    expect(flushNowMock).not.toHaveBeenCalled();
    expect(apiSignOutMock).not.toHaveBeenCalled();
    expect(onAnonymous).not.toHaveBeenCalled();
  });

  it('prompt fires before flushNow so the dialog is never blocked by a 5s flush', async () => {
    getPendingEntriesMock.mockResolvedValue([
      { kind: 'layouts', id: 'a', op: 'put', modifiedAt: 1000 },
    ]);
    let promptFiredAt = -1;
    let flushFiredAt = -1;
    let tick = 0;
    const promptOrdered: KeepLocalPrompt = vi.fn(async () => {
      promptFiredAt = tick++;
      return 'keep';
    });
    flushNowMock.mockImplementation(async () => {
      flushFiredAt = tick++;
    });
    await runSignOut({ adapters, promptKeepLocal: promptOrdered, onAnonymous });
    expect(promptFiredAt).toBeGreaterThanOrEqual(0);
    expect(flushFiredAt).toBeGreaterThan(promptFiredAt);
  });

  it('proceeds with sign-out if getPendingEntries rejects (IndexedDB failure)', async () => {
    getPendingEntriesMock.mockRejectedValueOnce(new Error('idb error'));
    const result = await runSignOut({ adapters, promptKeepLocal: promptKeep, onAnonymous });
    expect(result.status).toBe('kept');
    expect(onAnonymous).toHaveBeenCalled();
  });

  it('proceeds with sign-out if flushNow rejects (network failure during push)', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'a', op: 'put', modifiedAt: 1000 },
    ]);
    flushNowMock.mockRejectedValueOnce(new Error('network'));
    const result = await runSignOut({ adapters, promptKeepLocal: promptKeep, onAnonymous });
    expect(result.status).toBe('kept');
    expect(onAnonymous).toHaveBeenCalled();
  });

  it('proceeds with sign-out even if the flush hangs', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'a', op: 'put', modifiedAt: 1000 },
    ]);
    flushNowMock.mockReturnValue(new Promise(() => {})); // never resolves
    vi.useFakeTimers();

    const promise = runSignOut({ adapters, promptKeepLocal: promptKeep, onAnonymous });
    await vi.advanceTimersByTimeAsync(5_000);
    vi.useRealTimers();
    const result = await promise;
    expect(result.status).toBe('kept');
    expect(apiSignOutMock).toHaveBeenCalled();
  });
});

describe('runSignOut — server failure resilience', () => {
  it('still flips to anonymous if /api/auth/logout throws', async () => {
    apiSignOutMock.mockRejectedValueOnce(new Error('network'));
    const result = await runSignOut({
      adapters,
      promptKeepLocal: promptKeep,
      onAnonymous,
    });
    expect(result.status).toBe('kept');
    expect(onAnonymous).toHaveBeenCalled();
  });
});
