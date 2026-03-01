import { describe, it, expect } from 'vitest';
import {
  LAYOUT_KEY_PREFIX,
  LEGACY_STORAGE_KEY,
  LIBRARY_STORAGE_KEY,
  ACTIVE_ID_STORAGE_KEY,
  LIBRARY_CHANNEL_NAME,
  SETTINGS_STORAGE_KEY,
  MIGRATION_FLAG_KEY,
  CLEANUP_FLAG_KEY,
} from './storageKeys';

describe('storageKeys', () => {
  it('all keys use the gridfinity- prefix', () => {
    const keys = [
      LAYOUT_KEY_PREFIX,
      LEGACY_STORAGE_KEY,
      LIBRARY_STORAGE_KEY,
      ACTIVE_ID_STORAGE_KEY,
      LIBRARY_CHANNEL_NAME,
      SETTINGS_STORAGE_KEY,
      MIGRATION_FLAG_KEY,
      CLEANUP_FLAG_KEY,
    ];

    for (const key of keys) {
      expect(key).toMatch(/^gridfinity-/);
    }
  });

  it('LAYOUT_KEY_PREFIX ends with a hyphen for ID concatenation', () => {
    expect(LAYOUT_KEY_PREFIX).toBe('gridfinity-layout-');
    expect(LAYOUT_KEY_PREFIX.endsWith('-')).toBe(true);
  });

  it('LEGACY_STORAGE_KEY matches the v1 layout key', () => {
    expect(LEGACY_STORAGE_KEY).toBe('gridfinity-layout-v1');
  });
});
