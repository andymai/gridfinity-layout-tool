// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  __resetForTests,
  isChunkLoadError,
  recoverStaleBundle,
  RELOAD_GRACE_MS,
  STALE_RECOVERY_FLAG,
} from './staleRecovery';

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
  __resetForTests();
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
  vi.useRealTimers();
});

/** The reload landed: module state is gone, sessionStorage survives. */
function simulateReload(): void {
  __resetForTests();
  reload.mockClear();
}

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

  it('reports a recovery already running in this page as started, without a second reload', async () => {
    // Two lazy chunks miss in the same gap: the second must wait for the reload
    // the first started, not fall through to an error boundary.
    const [first, second] = await Promise.all([
      recoverStaleBundle('chunk_load_failure'),
      recoverStaleBundle('chunk_load_failure'),
    ]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(unregister).toHaveBeenCalledTimes(2);
  });

  it('declines after a reload that landed on the same build (guards against reload loops)', async () => {
    expect(await recoverStaleBundle('first')).toBe(true);
    simulateReload();

    expect(await recoverStaleBundle('second')).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(STALE_RECOVERY_FLAG)).not.toBeNull();
  });

  it('recovers again once the reload landed on a newer build', async () => {
    sessionStorage.setItem(STALE_RECOVERY_FLAG, JSON.stringify({ sha: 'old-sha', at: Date.now() }));

    expect(await recoverStaleBundle('chunk_load_failure')).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('ignores a guard written in the old timestamp-only format', async () => {
    sessionStorage.setItem(STALE_RECOVERY_FLAG, Date.now().toString());

    expect(await recoverStaleBundle('chunk_load_failure')).toBe(true);
  });

  it('lets the same build recover again once the guard window has passed', async () => {
    vi.useFakeTimers();
    expect(await recoverStaleBundle('first')).toBe(true);
    simulateReload();

    vi.advanceTimersByTime(9 * 60 * 1000);
    expect(await recoverStaleBundle('second')).toBe(false);

    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(await recoverStaleBundle('third')).toBe(true);
  });

  it('ends the in-flight state when a cancelled reload leaves the page alive', async () => {
    vi.useFakeTimers();
    expect(await recoverStaleBundle('first')).toBe(true);
    expect(await recoverStaleBundle('waits')).toBe(true);

    vi.advanceTimersByTime(RELOAD_GRACE_MS);
    expect(await recoverStaleBundle('guarded')).toBe(false);

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(await recoverStaleBundle('later')).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/a.js',
    'error loading dynamically imported module: https://x/assets/a.js',
    'Importing a module script failed.',
  ])('matches %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('rejects an unrelated error and a non-error value', () => {
    expect(isChunkLoadError(new Error('Failed to fetch'))).toBe(false);
    expect(isChunkLoadError('error loading dynamically imported module')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('recoverStaleBundle with force', () => {
  it('ignores the once-per-session guard so a user can always retry the reload', async () => {
    // Spend the automatic guard, as the first chunk miss would.
    await recoverStaleBundle('chunk_load_failure');
    reload.mockClear();

    expect(await recoverStaleBundle('error_boundary_chunk_load', { force: true })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads even offline, since the user asked for it', async () => {
    vi.stubGlobal('navigator', {
      onLine: false,
      serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
    });

    expect(await recoverStaleBundle('error_boundary_chunk_load', { force: true })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('drops the wasm cache when the caller asks (a full get-latest reload)', async () => {
    await recoverStaleBundle('error_boundary_chunk_load', { force: true, dropWasmCache: true });
    expect(cacheDelete).toHaveBeenCalledWith('gridfinity-v1-precache-abc');
    expect(cacheDelete).toHaveBeenCalledWith('wasm-binaries');
  });

  it('marks the telemetry event as forced', async () => {
    await recoverStaleBundle('error_boundary_chunk_load', { force: true });
    expect(capture).toHaveBeenCalledWith(
      'pwa_stale_recovery',
      expect.objectContaining({ reason: 'error_boundary_chunk_load', forced: true })
    );
  });
});
