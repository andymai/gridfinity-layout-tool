import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  clearPendingLikeAction,
  loadPendingLikeAction,
  savePendingLikeAction,
} from './communityPendingLikeAction';

const KEY = 'gridfinity-community-pending-like-v1';

function installSessionStorage(): void {
  const store = new Map<string, string>();
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: mock,
    writable: true,
    configurable: true,
  });
}

installSessionStorage();

describe('communityPendingLikeAction', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  });

  it('returns null when nothing is stored', () => {
    expect(loadPendingLikeAction()).toBeNull();
  });

  it('round-trips a saved action with a timestamp', () => {
    savePendingLikeAction({ designId: 'design000001', liked: true });
    const loaded = loadPendingLikeAction();
    expect(loaded).not.toBeNull();
    expect(loaded?.designId).toBe('design000001');
    expect(loaded?.liked).toBe(true);
    expect(typeof loaded?.savedAt).toBe('number');
  });

  it('is one-shot: a second load returns null', () => {
    savePendingLikeAction({ designId: 'design000001', liked: true });
    expect(loadPendingLikeAction()).not.toBeNull();
    expect(loadPendingLikeAction()).toBeNull();
  });

  it('rejects a record older than the OAuth round-trip budget', () => {
    vi.useFakeTimers();
    try {
      savePendingLikeAction({ designId: 'design000001', liked: true });
      vi.advanceTimersByTime(11 * 60 * 1000);
      expect(loadPendingLikeAction()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects malformed records and clears the slot', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ designId: 42, liked: 'yes' }));
    expect(loadPendingLikeAction()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('rejects unparseable JSON without throwing', () => {
    sessionStorage.setItem(KEY, '{nope');
    expect(loadPendingLikeAction()).toBeNull();
  });

  it('clearPendingLikeAction removes a saved record', () => {
    savePendingLikeAction({ designId: 'design000001', liked: false });
    clearPendingLikeAction();
    expect(loadPendingLikeAction()).toBeNull();
  });
});
