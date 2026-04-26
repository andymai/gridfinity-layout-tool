// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runUpdateSmokeTest } from './smokeGate';
import { SMOKE_MESSAGE_TYPE } from '@/shared/utils/smokeMode';

interface MockWorker {
  state: ServiceWorkerState;
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
  fireStateChange: (newState: ServiceWorkerState) => void;
}

function makeWorker(initialState: ServiceWorkerState = 'installed'): MockWorker {
  let state: ServiceWorkerState = initialState;
  const listeners = new Set<() => void>();
  return {
    get state() {
      return state;
    },
    set state(s: ServiceWorkerState) {
      state = s;
    },
    postMessage: vi.fn(),
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'statechange') listeners.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === 'statechange') listeners.delete(listener);
    },
    fireStateChange(newState: ServiceWorkerState) {
      state = newState;
      for (const l of listeners) l();
    },
  };
}

function makeRegistration(waiting: MockWorker | null): ServiceWorkerRegistration {
  return {
    waiting,
    unregister: vi.fn().mockResolvedValue(true),
  } as unknown as ServiceWorkerRegistration;
}

const FRESH_VERSION = {
  version: '4.48.0',
  gitSha: 'abc1234',
  buildTime: '2026-04-26T18:00:00.000Z',
};

function mockFetchVersion(payload: typeof FRESH_VERSION | { ok: false; status?: number }): void {
  // Build a minimal duck-typed Response to avoid the jsdom Response constructor's
  // internal stream timers, which clash with vi.useFakeTimers(). vi.stubGlobal
  // is restored automatically by vi.unstubAllGlobals() in afterEach so the
  // fetch override doesn't leak into other test files.
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => {
      if ('ok' in payload && !payload.ok) {
        return Promise.resolve({
          ok: false,
          status: payload.status ?? 500,
          json: () => Promise.resolve({}),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      });
    })
  );
}

/**
 * Drain microtasks so the gate's awaits (fetch, JSON parse, etc.) resolve before
 * the test drives the next event. 10 ticks is overkill for our flow, but cheap.
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/**
 * Find the iframe the gate just appended and dispatch a postMessage from it.
 * Source must match contentWindow for the gate's strict check to pass.
 */
function postFromIframe(data: unknown, originOverride?: string): void {
  const iframe = document.querySelector<HTMLIFrameElement>('iframe[src="/?smoke=1"]');
  if (!iframe) throw new Error('iframe not found');
  const event = new MessageEvent('message', {
    data,
    origin: originOverride ?? window.location.origin,
    source: iframe.contentWindow,
  });
  window.dispatchEvent(event);
}

describe('runUpdateSmokeTest', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
    mockFetchVersion(FRESH_VERSION);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('returns ok when SW activates, iframe boots, and versions match', async () => {
    const worker = makeWorker('installed');
    const registration = makeRegistration(worker);

    const promise = runUpdateSmokeTest(registration);

    // Let the gate fetch /version.json and post SKIP_WAITING.
    await flush();
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

    // Activate the worker — gate proceeds to spawn the iframe.
    worker.fireStateChange('activating');
    worker.fireStateChange('activated');
    await flush();

    postFromIframe({
      type: SMOKE_MESSAGE_TYPE,
      smokeOk: true,
      version: FRESH_VERSION.version,
      gitSha: FRESH_VERSION.gitSha,
      buildTime: FRESH_VERSION.buildTime,
    });

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.version).toBe(FRESH_VERSION.version);
    expect(result.expectedVersion).toBe(FRESH_VERSION.version);
    expect(document.querySelector('iframe[src="/?smoke=1"]')).toBeNull();
  });

  it('reports version_mismatch when iframe gitSha differs from /version.json', async () => {
    const worker = makeWorker('installed');
    const registration = makeRegistration(worker);

    const promise = runUpdateSmokeTest(registration);
    await flush();

    worker.fireStateChange('activated');
    await flush();

    postFromIframe({
      type: SMOKE_MESSAGE_TYPE,
      smokeOk: true,
      version: '4.48.0',
      gitSha: 'staleeee',
      buildTime: FRESH_VERSION.buildTime,
    });

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('version_mismatch');
    expect(result.expectedVersion).toBe(FRESH_VERSION.version);
  });

  it('returns version_fetch_failed when /version.json is non-200', async () => {
    mockFetchVersion({ ok: false, status: 502 });
    const worker = makeWorker('installed');
    const registration = makeRegistration(worker);

    const result = await runUpdateSmokeTest(registration);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('version_fetch_failed');
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it('returns no_waiting_worker when registration.waiting is null', async () => {
    const registration = makeRegistration(null);
    const result = await runUpdateSmokeTest(registration);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_waiting_worker');
  });

  it('returns activate_failed when the worker becomes redundant', async () => {
    const worker = makeWorker('installed');
    const registration = makeRegistration(worker);

    const promise = runUpdateSmokeTest(registration);
    await flush();

    worker.fireStateChange('redundant');

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('activate_failed');
    expect(result.reason).toContain('activate_redundant');
  });

  it('reports activate_timeout when the worker never activates', async () => {
    const worker = makeWorker('installed');
    const registration = makeRegistration(worker);

    const promise = runUpdateSmokeTest(registration);
    await flush();

    await vi.advanceTimersByTimeAsync(5_000);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('activate_timeout');
  });

  it('retries iframe smoke once on timeout, then gives up', async () => {
    const worker = makeWorker('installed');
    const registration = makeRegistration(worker);

    const promise = runUpdateSmokeTest(registration);
    await flush();
    worker.fireStateChange('activated');
    await flush();

    // First attempt — drive its 10s timeout without posting.
    await vi.advanceTimersByTimeAsync(10_000);
    await flush();
    // Retry — drive that timeout too.
    await vi.advanceTimersByTimeAsync(10_000);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('timeout');
    expect(result.retries).toBe(1);
  });

  it('rejects messages from a wrong origin (anti-spoof)', async () => {
    const worker = makeWorker('installed');
    const registration = makeRegistration(worker);

    const promise = runUpdateSmokeTest(registration);
    await flush();
    worker.fireStateChange('activated');
    await flush();

    // Wrong origin — must be ignored, not treated as a pass.
    postFromIframe(
      {
        type: SMOKE_MESSAGE_TYPE,
        smokeOk: true,
        version: FRESH_VERSION.version,
        gitSha: FRESH_VERSION.gitSha,
        buildTime: FRESH_VERSION.buildTime,
      },
      'https://evil.example.com'
    );

    await vi.advanceTimersByTimeAsync(10_000);
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('timeout');
  });

  it('reports iframe_reported when the iframe self-reports a failure', async () => {
    const worker = makeWorker('installed');
    const registration = makeRegistration(worker);

    const promise = runUpdateSmokeTest(registration);
    await flush();
    worker.fireStateChange('activated');
    await flush();

    postFromIframe({
      type: SMOKE_MESSAGE_TYPE,
      smokeOk: false,
      reason: 'error:boom',
      version: FRESH_VERSION.version,
      gitSha: FRESH_VERSION.gitSha,
      buildTime: FRESH_VERSION.buildTime,
    });

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('iframe_reported:error:boom');
    // iframe_reported is non-transient — must NOT retry.
    expect(result.retries).toBe(0);
  });

  it('skips SKIP_WAITING if the worker is already activated', async () => {
    const worker = makeWorker('activated');
    const registration = makeRegistration(worker);

    const promise = runUpdateSmokeTest(registration);
    await flush();

    // Already-activated worker: no SKIP_WAITING needed, gate proceeds straight to iframe.
    expect(worker.postMessage).not.toHaveBeenCalled();

    postFromIframe({
      type: SMOKE_MESSAGE_TYPE,
      smokeOk: true,
      version: FRESH_VERSION.version,
      gitSha: FRESH_VERSION.gitSha,
      buildTime: FRESH_VERSION.buildTime,
    });

    const result = await promise;
    expect(result.ok).toBe(true);
  });
});
