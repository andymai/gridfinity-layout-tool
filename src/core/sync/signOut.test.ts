// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runSignOut, type KeepLocalPrompt } from './signOut';
import type { SyncAdapter, SyncAdapters, SyncableItem } from './adapters/types';

const flushNowMock = vi.fn();
const getPendingEntriesMock = vi.fn();
const apiSignOutMock = vi.fn();
const clearOutboxMock = vi.fn();

vi.mock('./engine', () => ({
  flushNow: () => flushNowMock(),
  getPendingEntries: () => getPendingEntriesMock(),
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
  it('skips flush when outbox is empty', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([]);
    await runSignOut({ adapters, promptKeepLocal: promptKeep, onAnonymous });
    expect(flushNowMock).not.toHaveBeenCalled();
  });

  it('attempts a flush when items are pending', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'a', op: 'put', modifiedAt: 1000 },
    ]);
    await runSignOut({ adapters, promptKeepLocal: promptKeep, onAnonymous });
    expect(flushNowMock).toHaveBeenCalled();
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
