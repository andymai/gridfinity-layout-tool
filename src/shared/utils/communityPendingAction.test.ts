import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  clearPendingPublishAction,
  loadPendingPublishAction,
  peekPendingPublishAction,
  savePendingPublishAction,
} from './communityPendingAction';

const KEY = 'gridfinity-community-pending-publish-v1';

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

describe('pendingAction', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  });

  it('returns null when nothing is stored', () => {
    expect(loadPendingPublishAction()).toBeNull();
  });

  it('round-trips a saved action with a timestamp', () => {
    savePendingPublishAction({ designId: 'design-1', returnSurface: 'designer' });
    const loaded = loadPendingPublishAction();
    expect(loaded).not.toBeNull();
    expect(loaded?.designId).toBe('design-1');
    expect(loaded?.returnSurface).toBe('designer');
    expect(typeof loaded?.savedAt).toBe('number');
  });

  it('is one-shot: a second load returns null', () => {
    savePendingPublishAction({ designId: 'design-1', returnSurface: 'gallery' });
    expect(loadPendingPublishAction()).not.toBeNull();
    expect(loadPendingPublishAction()).toBeNull();
  });

  it('discards a stale action past the max age', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        designId: 'design-1',
        returnSurface: 'route',
        savedAt: Date.now() - 11 * 60 * 1000,
      })
    );
    expect(loadPendingPublishAction()).toBeNull();
  });

  it('discards malformed JSON and clears the key', () => {
    sessionStorage.setItem(KEY, '{not json');
    expect(loadPendingPublishAction()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('discards a record with an unknown return surface', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ designId: 'design-1', returnSurface: 'elsewhere', savedAt: Date.now() })
    );
    expect(loadPendingPublishAction()).toBeNull();
  });

  it('discards a record with an empty design id', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ designId: '', returnSurface: 'designer', savedAt: Date.now() })
    );
    expect(loadPendingPublishAction()).toBeNull();
  });

  it('round-trips an attached form draft', () => {
    savePendingPublishAction({
      designId: 'design-1',
      returnSurface: 'designer',
      draft: { name: 'Screw Bin', description: 'M3 screws', category: 'hardware' },
    });
    const loaded = loadPendingPublishAction();
    expect(loaded?.draft).toEqual({
      name: 'Screw Bin',
      description: 'M3 screws',
      category: 'hardware',
    });
  });

  it('discards a record whose draft has an unknown category', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        designId: 'design-1',
        returnSurface: 'designer',
        savedAt: Date.now(),
        draft: { name: 'x', description: '', category: 'weapons' },
      })
    );
    expect(loadPendingPublishAction()).toBeNull();
  });

  it('clearPendingPublishAction removes a saved action', () => {
    savePendingPublishAction({ designId: 'design-1', returnSurface: 'designer' });
    clearPendingPublishAction();
    expect(loadPendingPublishAction()).toBeNull();
  });

  it('peekPendingPublishAction reads without consuming', () => {
    savePendingPublishAction({ designId: 'design-1', returnSurface: 'designer' });
    expect(peekPendingPublishAction()?.designId).toBe('design-1');
    expect(peekPendingPublishAction()?.designId).toBe('design-1');
    expect(loadPendingPublishAction()?.designId).toBe('design-1');
  });

  it('peekPendingPublishAction ignores stale or malformed records', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        designId: 'design-1',
        returnSurface: 'designer',
        savedAt: Date.now() - 11 * 60 * 1000,
      })
    );
    expect(peekPendingPublishAction()).toBeNull();
    sessionStorage.setItem(KEY, '{not json');
    expect(peekPendingPublishAction()).toBeNull();
  });
});
