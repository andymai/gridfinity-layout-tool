import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recoverFromBadWwwMigration } from './wwwMigrationRecovery';

const MIGRATION_FLAG = 'gridfinity-indexeddb-migrated';
const CLEANUP_FLAG = 'gridfinity-localstorage-cleaned';
const LAYOUT_UUID_KEY = 'gridfinity-layout-550e8400-e29b-41d4-a716-446655440000';

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ─── recoverFromBadWwwMigration ───────────────────────────────────────────────

describe('recoverFromBadWwwMigration', () => {
  it('returns false and does nothing when not on canonical (www hostname)', () => {
    vi.stubGlobal('location', { hostname: 'www.gridfinitylayouttool.com', reload: vi.fn() });
    localStorage.setItem(MIGRATION_FLAG, 'true');
    localStorage.setItem(LAYOUT_UUID_KEY, '{}');

    expect(recoverFromBadWwwMigration()).toBe(false);
    expect(localStorage.getItem(MIGRATION_FLAG)).toBe('true');
  });

  it('returns false when migration flag is not set', () => {
    vi.stubGlobal('location', { hostname: 'gridfinitylayouttool.com', reload: vi.fn() });
    localStorage.setItem(LAYOUT_UUID_KEY, '{}');

    expect(recoverFromBadWwwMigration()).toBe(false);
  });

  it('returns false when migration flag is set but no layout-uuid keys exist', () => {
    vi.stubGlobal('location', { hostname: 'gridfinitylayouttool.com', reload: vi.fn() });
    localStorage.setItem(MIGRATION_FLAG, 'true');
    // Only non-layout keys
    localStorage.setItem('gridfinity-settings-v1', '{}');
    localStorage.setItem('gridfinity-library-v1', '[]');

    expect(recoverFromBadWwwMigration()).toBe(false);
  });

  it('returns false for gridfinity-layout-v1 (legacy single-layout key, not a UUID key)', () => {
    vi.stubGlobal('location', { hostname: 'gridfinitylayouttool.com', reload: vi.fn() });
    localStorage.setItem(MIGRATION_FLAG, 'true');
    localStorage.setItem('gridfinity-layout-v1', '{}');

    expect(recoverFromBadWwwMigration()).toBe(false);
  });

  it('detects bad migration: flag set + UUID layout keys present → clears flags and reloads', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { hostname: 'gridfinitylayouttool.com', reload });
    localStorage.setItem(MIGRATION_FLAG, 'true');
    localStorage.setItem(CLEANUP_FLAG, 'true');
    localStorage.setItem(LAYOUT_UUID_KEY, '{"bins":[]}');

    const result = recoverFromBadWwwMigration();

    expect(result).toBe(true);
    expect(localStorage.getItem(MIGRATION_FLAG)).toBeNull();
    expect(localStorage.getItem(CLEANUP_FLAG)).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('also clears cleanup flag when it is present', () => {
    vi.stubGlobal('location', { hostname: 'gridfinitylayouttool.com', reload: vi.fn() });
    localStorage.setItem(MIGRATION_FLAG, 'true');
    localStorage.setItem(CLEANUP_FLAG, 'true');
    localStorage.setItem(LAYOUT_UUID_KEY, '{}');

    recoverFromBadWwwMigration();

    expect(localStorage.getItem(CLEANUP_FLAG)).toBeNull();
  });

  it('leaves layout LS data intact for useStorageMigration to process', () => {
    vi.stubGlobal('location', { hostname: 'gridfinitylayouttool.com', reload: vi.fn() });
    localStorage.setItem(MIGRATION_FLAG, 'true');
    localStorage.setItem(LAYOUT_UUID_KEY, '{"bins":[]}');

    recoverFromBadWwwMigration();

    // Layout data must remain so the subsequent migration can move it to IDB
    expect(localStorage.getItem(LAYOUT_UUID_KEY)).toBe('{"bins":[]}');
  });

  it('handles multiple UUID layout keys', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { hostname: 'gridfinitylayouttool.com', reload });
    localStorage.setItem(MIGRATION_FLAG, 'true');
    localStorage.setItem('gridfinity-layout-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', '{}');
    localStorage.setItem('gridfinity-layout-11111111-2222-3333-4444-555555555555', '{}');

    expect(recoverFromBadWwwMigration()).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });
});
