import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isOk, isErr } from '@/core/result';
import { createIsolatedLocalStorageMock } from '@/test/testUtils';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  deleteFromLocalStorage,
  existsInLocalStorage,
  getAllKeysWithPrefix,
  getAllLayoutIds,
  getStorageUsagePercent,
} from './localStorage';

describe('localStorage backend', () => {
  let localStorageMock: ReturnType<typeof createIsolatedLocalStorageMock>;

  beforeEach(() => {
    localStorageMock = createIsolatedLocalStorageMock();
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock.mock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    localStorageMock.cleanup();
  });

  describe('saveToLocalStorage', () => {
    it('saves JSON data', () => {
      const result = saveToLocalStorage('key1', { name: 'test' });
      expect(isOk(result)).toBe(true);
      expect(localStorageMock.mock.setItem).toHaveBeenCalledWith('key1', '{"name":"test"}');
    });

    it('returns Err when storage is full', () => {
      localStorageMock.mock.setItem.mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
      const result = saveToLocalStorage('key1', { big: 'data' });
      expect(isErr(result)).toBe(true);
    });
  });

  describe('loadFromLocalStorage', () => {
    it('loads and parses JSON data', () => {
      localStorageMock.mock.getItem.mockReturnValue('{"name":"loaded"}');
      const result = loadFromLocalStorage<{ name: string }>('key1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toEqual({ name: 'loaded' });
    });

    it('returns null for missing key', () => {
      localStorageMock.mock.getItem.mockReturnValue(null);
      const result = loadFromLocalStorage('missing');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBeNull();
    });

    it('returns Err for corrupted JSON', () => {
      localStorageMock.mock.getItem.mockReturnValue('not{valid}json');
      const result = loadFromLocalStorage('corrupt');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('deleteFromLocalStorage', () => {
    it('calls removeItem', () => {
      deleteFromLocalStorage('key1');
      expect(localStorageMock.mock.removeItem).toHaveBeenCalledWith('key1');
    });
  });

  describe('existsInLocalStorage', () => {
    it('returns true when key exists', () => {
      localStorageMock.mock.getItem.mockReturnValue('value');
      expect(existsInLocalStorage('key1')).toBe(true);
    });

    it('returns false when key does not exist', () => {
      localStorageMock.mock.getItem.mockReturnValue(null);
      expect(existsInLocalStorage('missing')).toBe(false);
    });
  });

  describe('getAllKeysWithPrefix', () => {
    it('returns keys matching prefix', () => {
      // Mock localStorage with 3 keys, 2 matching prefix
      Object.defineProperty(localStorageMock.mock, 'length', { value: 3, configurable: true });
      localStorageMock.mock.key
        .mockReturnValueOnce('gridfinity-layout-abc')
        .mockReturnValueOnce('gridfinity-layout-def')
        .mockReturnValueOnce('other-key');

      const keys = getAllKeysWithPrefix('gridfinity-layout-');
      expect(keys).toEqual(['gridfinity-layout-abc', 'gridfinity-layout-def']);
    });

    it('returns empty array when no keys match', () => {
      Object.defineProperty(localStorageMock.mock, 'length', { value: 0, configurable: true });
      expect(getAllKeysWithPrefix('nope')).toEqual([]);
    });
  });

  describe('getAllLayoutIds', () => {
    it('strips prefix from keys', () => {
      Object.defineProperty(localStorageMock.mock, 'length', { value: 2, configurable: true });
      localStorageMock.mock.key.mockReturnValueOnce('pre-abc').mockReturnValueOnce('pre-def');

      const ids = getAllLayoutIds('pre-');
      expect(ids).toEqual(['abc', 'def']);
    });
  });

  describe('getStorageUsagePercent', () => {
    it('returns 0 for empty storage', () => {
      Object.defineProperty(localStorageMock.mock, 'length', { value: 0, configurable: true });
      expect(getStorageUsagePercent()).toBe(0);
    });

    it('calculates usage percentage', () => {
      // Simulate ~1MB of data
      const bigValue = 'x'.repeat(500_000);
      Object.defineProperty(localStorageMock.mock, 'length', { value: 1, configurable: true });
      localStorageMock.mock.key.mockReturnValue('k');
      localStorageMock.mock.getItem.mockReturnValue(bigValue);

      const percent = getStorageUsagePercent();
      expect(percent).toBeGreaterThan(0);
      expect(percent).toBeLessThan(100);
    });
  });
});
