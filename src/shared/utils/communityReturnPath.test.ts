import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import {
  loadCommunityReopenDesign,
  loadCommunityReturnPath,
  saveCommunityReopenDesign,
  saveCommunityReturnPath,
} from './communityReturnPath';

const KEY = 'gridfinity-community-return-path-v1';
const REOPEN_KEY = 'gridfinity-community-reopen-design-v1';

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

describe('communityReturnPath', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  });

  it('round-trips a gallery path', () => {
    saveCommunityReturnPath('/community');
    expect(loadCommunityReturnPath()).toBe('/community');
  });

  it('round-trips a detail deep link and an author-filtered gallery URL', () => {
    saveCommunityReturnPath('/community/d/AbCdEf123456');
    expect(loadCommunityReturnPath()).toBe('/community/d/AbCdEf123456');
    saveCommunityReturnPath('/community?author=0123456789abcdef0123456789abcdef');
    expect(loadCommunityReturnPath()).toBe('/community?author=0123456789abcdef0123456789abcdef');
  });

  it('is one-shot', () => {
    saveCommunityReturnPath('/community');
    expect(loadCommunityReturnPath()).toBe('/community');
    expect(loadCommunityReturnPath()).toBeNull();
  });

  it('refuses non-community paths (the in-app tab on /, arbitrary routes)', () => {
    saveCommunityReturnPath('/');
    expect(loadCommunityReturnPath()).toBeNull();
    saveCommunityReturnPath('/designer?id=abc');
    expect(loadCommunityReturnPath()).toBeNull();
    saveCommunityReturnPath('/communityfake');
    expect(loadCommunityReturnPath()).toBeNull();
  });

  it('refuses a tampered stored record with a non-community path', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ path: '//evil.example', savedAt: Date.now() }));
    expect(loadCommunityReturnPath()).toBeNull();
  });

  it('expires after the OAuth window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    saveCommunityReturnPath('/community');
    vi.setSystemTime(1_000_000 + 10 * 60 * 1000 + 1);
    expect(loadCommunityReturnPath()).toBeNull();
  });

  it('removes a malformed record instead of replaying it', () => {
    sessionStorage.setItem(KEY, 'not-json');
    expect(loadCommunityReturnPath()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  describe('reopen design intent', () => {
    it('round-trips a design id, one-shot', () => {
      saveCommunityReopenDesign('AbCdEf123456');
      expect(loadCommunityReopenDesign()).toBe('AbCdEf123456');
      expect(loadCommunityReopenDesign()).toBeNull();
    });

    it('is independent of the return-path slot', () => {
      saveCommunityReturnPath('/community');
      saveCommunityReopenDesign('AbCdEf123456');
      expect(loadCommunityReturnPath()).toBe('/community');
      expect(loadCommunityReopenDesign()).toBe('AbCdEf123456');
    });

    it('refuses tampered records (empty or oversized ids)', () => {
      sessionStorage.setItem(REOPEN_KEY, JSON.stringify({ designId: '', savedAt: Date.now() }));
      expect(loadCommunityReopenDesign()).toBeNull();
      sessionStorage.setItem(
        REOPEN_KEY,
        JSON.stringify({ designId: 'x'.repeat(65), savedAt: Date.now() })
      );
      expect(loadCommunityReopenDesign()).toBeNull();
    });

    it('expires after the OAuth window', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1_000_000);
      saveCommunityReopenDesign('AbCdEf123456');
      vi.setSystemTime(1_000_000 + 10 * 60 * 1000 + 1);
      expect(loadCommunityReopenDesign()).toBeNull();
    });

    it('removes a malformed record instead of replaying it', () => {
      sessionStorage.setItem(REOPEN_KEY, 'not-json');
      expect(loadCommunityReopenDesign()).toBeNull();
      expect(sessionStorage.getItem(REOPEN_KEY)).toBeNull();
    });
  });
});
