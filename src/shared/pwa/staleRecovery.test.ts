// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recoverStaleBundle, STALE_RECOVERY_FLAG } from './staleRecovery';

const capture = vi.fn();
vi.mock('@/shared/analytics/posthog/init', () => ({
  getPosthogInstance: () => ({ capture }),
}));

const reload = vi.fn();
const cacheDelete = vi.fn().mockResolvedValue(true);
const unregister = vi.fn().mockResolvedValue(true);

const realLocation = window.location;

beforeEach(() => {
  sessionStorage.clear();
  capture.mockClear();
  reload.mockClear();
  cacheDelete.mockClear();
  unregister.mockClear();

  // Preserve the real Location shape (href/origin/...) and override only reload,
  // so code reading other fields still works.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...realLocation, href: realLocation.href, origin: realLocation.origin, reload },
  });

  vi.stubGlobal('caches', {
    keys: vi
      .fn()
      .mockResolvedValue(['gridfinity-v1-precache-abc', 'wasm-binaries', 'shared-layouts']),
    delete: cacheDelete,
  });

  vi.stubGlobal('navigator', {
    onLine: true,
    serviceWorker: {
      getRegistrations: vi.fn().mockResolvedValue([{ unregister }, { unregister }]),
    },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  vi.unstubAllGlobals();
});

describe('recoverStaleBundle', () => {
  it('clears precache + wasm caches, unregisters SWs, and reloads', async () => {
    const started = await recoverStaleBundle('wasm_load_failure');

    expect(started).toBe(true);
    // Drops the precache and wasm caches, leaves unrelated caches (shared-layouts) alone.
    expect(cacheDelete).toHaveBeenCalledWith('gridfinity-v1-precache-abc');
    expect(cacheDelete).toHaveBeenCalledWith('wasm-binaries');
    expect(cacheDelete).not.toHaveBeenCalledWith('shared-layouts');
    expect(unregister).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('captures a telemetry event with the reason', async () => {
    await recoverStaleBundle('boot_version_mismatch');
    expect(capture).toHaveBeenCalledWith(
      'pwa_stale_recovery',
      expect.objectContaining({ reason: 'boot_version_mismatch' })
    );
  });

  it('recovers at most once per session (guards against reload loops)', async () => {
    expect(await recoverStaleBundle('first')).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    const second = await recoverStaleBundle('second');
    expect(second).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(STALE_RECOVERY_FLAG)).not.toBeNull();
  });
});
