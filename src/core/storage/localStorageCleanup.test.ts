import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanupLocalStorageBackups, clearCleanupFlag } from './localStorageCleanup';

// Mock backends
vi.mock('./backends/localStorage', () => ({
  getAllLayoutIds: vi.fn(),
  deleteFromLocalStorage: vi.fn(),
}));

vi.mock('./backends/indexedDB', () => ({
  isIndexedDBAvailable: vi.fn(),
  loadLayout: vi.fn(),
}));

import * as localStorageBackend from './backends/localStorage';
import * as indexedDBBackend from './backends/indexedDB';

const DUMMY_LAYOUT = { name: 'Test', version: '1.0' };

beforeEach(() => {
  vi.clearAllMocks();
  clearCleanupFlag();
  // Clear any leftover localStorage state
  window.localStorage.clear();
});

describe('cleanupLocalStorageBackups', () => {
  it('skips cleanup if already completed', async () => {
    window.localStorage.setItem('gridfinity-localstorage-cleaned', 'true');

    const result = await cleanupLocalStorageBackups();

    expect(result).toBeNull();
    expect(localStorageBackend.getAllLayoutIds).not.toHaveBeenCalled();
  });

  it('skips cleanup if IndexedDB is unavailable', async () => {
    vi.mocked(indexedDBBackend.isIndexedDBAvailable).mockResolvedValue(false);

    const result = await cleanupLocalStorageBackups();

    expect(result).toBeNull();
    expect(localStorageBackend.getAllLayoutIds).not.toHaveBeenCalled();
  });

  it('sets flag and returns null when no localStorage layouts exist', async () => {
    vi.mocked(indexedDBBackend.isIndexedDBAvailable).mockResolvedValue(true);
    vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue([]);

    const result = await cleanupLocalStorageBackups();

    expect(result).toBeNull();
    expect(window.localStorage.getItem('gridfinity-localstorage-cleaned')).toBe('true');
  });

  it('removes localStorage copies confirmed readable in IndexedDB', async () => {
    vi.mocked(indexedDBBackend.isIndexedDBAvailable).mockResolvedValue(true);
    vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['layout-1', 'layout-2']);
    // loadLayout returns data for both layouts (confirmed readable)
    vi.mocked(indexedDBBackend.loadLayout).mockResolvedValue(DUMMY_LAYOUT);

    // Mock the raw localStorage to calculate freed bytes
    window.localStorage.setItem('gridfinity-layout-layout-1', JSON.stringify({ name: 'Test 1' }));
    window.localStorage.setItem('gridfinity-layout-layout-2', JSON.stringify({ name: 'Test 2' }));

    const result = await cleanupLocalStorageBackups();

    expect(result).not.toBeNull();
    expect(result!.removedCount).toBe(2);
    expect(result!.keptCount).toBe(0);
    expect(result!.freedBytes).toBeGreaterThan(0);
    expect(localStorageBackend.deleteFromLocalStorage).toHaveBeenCalledTimes(2);
    expect(localStorageBackend.deleteFromLocalStorage).toHaveBeenCalledWith(
      'gridfinity-layout-layout-1'
    );
    expect(localStorageBackend.deleteFromLocalStorage).toHaveBeenCalledWith(
      'gridfinity-layout-layout-2'
    );
  });

  it('keeps localStorage copies when IndexedDB data is missing or corrupt', async () => {
    vi.mocked(indexedDBBackend.isIndexedDBAvailable).mockResolvedValue(true);
    vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['layout-1', 'layout-2']);
    // layout-1 loads fine; layout-2 returns null (missing or corrupt)
    vi.mocked(indexedDBBackend.loadLayout)
      .mockResolvedValueOnce(DUMMY_LAYOUT)
      .mockResolvedValueOnce(null);

    window.localStorage.setItem('gridfinity-layout-layout-1', JSON.stringify({ name: 'Test 1' }));

    const result = await cleanupLocalStorageBackups();

    expect(result).not.toBeNull();
    expect(result!.removedCount).toBe(1);
    expect(result!.keptCount).toBe(1);
    expect(localStorageBackend.deleteFromLocalStorage).toHaveBeenCalledTimes(1);
    expect(localStorageBackend.deleteFromLocalStorage).toHaveBeenCalledWith(
      'gridfinity-layout-layout-1'
    );
  });

  it('sets cleanup flag after successful cleanup', async () => {
    vi.mocked(indexedDBBackend.isIndexedDBAvailable).mockResolvedValue(true);
    vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['layout-1']);
    vi.mocked(indexedDBBackend.loadLayout).mockResolvedValue(DUMMY_LAYOUT);
    window.localStorage.setItem('gridfinity-layout-layout-1', '{}');

    await cleanupLocalStorageBackups();

    expect(window.localStorage.getItem('gridfinity-localstorage-cleaned')).toBe('true');
  });

  it('does not set cleanup flag when some copies were kept', async () => {
    vi.mocked(indexedDBBackend.isIndexedDBAvailable).mockResolvedValue(true);
    vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['layout-1', 'layout-2']);
    // Only layout-1 loadable — layout-2 returns null
    vi.mocked(indexedDBBackend.loadLayout)
      .mockResolvedValueOnce(DUMMY_LAYOUT)
      .mockResolvedValueOnce(null);
    window.localStorage.setItem('gridfinity-layout-layout-1', '{}');

    await cleanupLocalStorageBackups();

    expect(window.localStorage.getItem('gridfinity-localstorage-cleaned')).toBeNull();
  });

  it('does not re-run after flag is set', async () => {
    vi.mocked(indexedDBBackend.isIndexedDBAvailable).mockResolvedValue(true);
    vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['layout-1']);
    vi.mocked(indexedDBBackend.loadLayout).mockResolvedValue(DUMMY_LAYOUT);
    window.localStorage.setItem('gridfinity-layout-layout-1', '{}');

    await cleanupLocalStorageBackups();
    vi.clearAllMocks();

    const result = await cleanupLocalStorageBackups();
    expect(result).toBeNull();
    expect(localStorageBackend.getAllLayoutIds).not.toHaveBeenCalled();
  });

  it('verifies each layout by loading from IndexedDB', async () => {
    vi.mocked(indexedDBBackend.isIndexedDBAvailable).mockResolvedValue(true);
    vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['layout-1']);
    vi.mocked(indexedDBBackend.loadLayout).mockResolvedValue(DUMMY_LAYOUT);
    window.localStorage.setItem('gridfinity-layout-layout-1', '{}');

    await cleanupLocalStorageBackups();

    // Verify loadLayout was called with the prefixed key
    expect(indexedDBBackend.loadLayout).toHaveBeenCalledWith('gridfinity-layout-layout-1');
  });
});

describe('clearCleanupFlag', () => {
  it('clears the cleanup flag', () => {
    window.localStorage.setItem('gridfinity-localstorage-cleaned', 'true');

    clearCleanupFlag();

    expect(window.localStorage.getItem('gridfinity-localstorage-cleaned')).toBeNull();
  });
});
