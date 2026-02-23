import { describe, it, expect, beforeEach } from 'vitest';
import { readAllLocalStorage } from './wwwMigration';

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
});

// ─── readAllLocalStorage ─────────────────────────────────────────────────────

describe('readAllLocalStorage', () => {
  it('returns empty object when localStorage is empty', () => {
    expect(readAllLocalStorage()).toEqual({});
  });

  it('collects all gridfinity-* keys', () => {
    localStorage.setItem('gridfinity-settings-v1', '{"theme":"dark"}');
    localStorage.setItem('gridfinity-library-v1', '[]');
    localStorage.setItem('gridfinity-user-id', 'abc-123');

    const result = readAllLocalStorage();

    expect(result).toEqual({
      'gridfinity-settings-v1': '{"theme":"dark"}',
      'gridfinity-library-v1': '[]',
      'gridfinity-user-id': 'abc-123',
    });
  });

  it('ignores non-gridfinity keys', () => {
    localStorage.setItem('gridfinity-settings-v1', '{}');
    localStorage.setItem('other-app-key', 'value');
    localStorage.setItem('posthog-data', 'value');

    const result = readAllLocalStorage();

    expect(Object.keys(result)).toEqual(['gridfinity-settings-v1']);
  });

  it('handles all known gridfinity key patterns', () => {
    const knownKeys = [
      'gridfinity-layout-550e8400-e29b-41d4-a716-446655440000',
      'gridfinity-library-v1',
      'gridfinity-library-active-id',
      'gridfinity-settings-v1',
      'gridfinity-labs-v1',
      'gridfinity-half-bin-mode',
      'gridfinity-settings-active-tab',
      'gridfinity-user-id',
      'gridfinity-analytics-v1',
      'gridfinity-ml-user-hash-v1',
      'gridfinity-designer-active-v1',
      'gridfinity-indexeddb-migrated',
      'gridfinity-localstorage-cleaned',
      'gridfinity-shared-with-me-v1',
    ];

    for (const key of knownKeys) {
      localStorage.setItem(key, 'test-value');
    }

    const result = readAllLocalStorage();
    expect(Object.keys(result)).toHaveLength(knownKeys.length);

    for (const key of knownKeys) {
      expect(result[key]).toBe('test-value');
    }
  });
});
