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

  // Location's fields are prototype accessors, so a spread copies none of them —
  // stub exactly the fields test subjects read (reload, plus href/origin for
  // incidental readers).
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: realLocation.href, origin: realLocation.origin, reload },
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
  it('clears the precache, unregisters SWs, and reloads', async () => {
    const started = await recoverStaleBundle('wasm_load_failure');

    expect(started).toBe(true);
    // Drops the precache, leaves unrelated caches (shared-layouts) alone.
    expect(cacheDelete).toHaveBeenCalledWith('gridfinity-v1-precache-abc');
    expect(cacheDelete).not.toHaveBeenCalledWith('shared-layouts');
    expect(unregister).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('drops the wasm cache only for a caller that implicates it', async () => {
    await recoverStaleBundle('wasm_load_failure', { dropWasmCache: true });
    expect(cacheDelete).toHaveBeenCalledWith('wasm-binaries');
  });

  it('spares the wasm cache for a chunk failure, which does not implicate it', async () => {
    // Several megabytes whose hash usually survives a deploy, so re-downloading
    // it buys a route-chunk recovery nothing.
    await recoverStaleBundle('chunk_load_failure');
    expect(cacheDelete).not.toHaveBeenCalledWith('wasm-binaries');
  });

  it('declines while offline, since unregistering the SW would strip the shell', async () => {
    vi.stubGlobal('navigator', {
      onLine: false,
      serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
    });

    expect(await recoverStaleBundle('chunk_load_failure')).toBe(false);
    expect(unregister).not.toHaveBeenCalled();
    expect(cacheDelete).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not burn the session guard on a declined offline attempt', async () => {
    vi.stubGlobal('navigator', { onLine: false, serviceWorker: undefined });
    await recoverStaleBundle('chunk_load_failure');
    expect(sessionStorage.getItem(STALE_RECOVERY_FLAG)).toBeNull();

    vi.stubGlobal('navigator', {
      onLine: true,
      serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
    });
    expect(await recoverStaleBundle('chunk_load_failure')).toBe(true);
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
