// @vitest-environment jsdom
/**
 * Tests for the sync engine. The engine talks to outbox (real, IDB-backed)
 * + apiFetch (mocked) + adapters (mocked). We exercise the core push
 * paths: success, 409, 410, 413, 5xx, and the in-flight serialization.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSyncStatusStore } from './status';
import {
  __resetForTests as resetOutbox,
  getAll as outboxGetAll,
  clearAll as clearOutbox,
} from './outbox';
import type { AdapterChange, SyncAdapter, SyncAdapters } from './adapters/types';

const fetchMock = vi.fn();

vi.mock('./apiFetch', () => ({
  apiFetch: (url: string, init?: RequestInit) => fetchMock(url, init),
}));

import * as engine from './engine';

interface MockAdapter extends SyncAdapter {
  triggerChange: (change: AdapterChange) => void;
}

function makeMockAdapter(): MockAdapter {
  let listener: ((c: AdapterChange) => void) | null = null;
  const items = new Map<string, { id: string; payload: unknown; modifiedAt: number }>();
  const adapter: MockAdapter = {
    list: vi.fn(async () => Array.from(items.values())),
    get: vi.fn(async (id: string) => items.get(id) ?? null),
    applyRemote: vi.fn(async (item) => {
      items.set(item.id, item);
    }),
    applyRemoteDelete: vi.fn(async (id: string) => {
      items.delete(id);
    }),
    subscribe: vi.fn((cb) => {
      listener = cb;
      return () => {
        listener = null;
      };
    }),
    triggerChange: (change) => {
      if (change.kind === 'put') {
        items.set(change.id, { id: change.id, payload: { v: 1 }, modifiedAt: change.modifiedAt });
      } else {
        items.delete(change.id);
      }
      listener?.(change);
    },
  };
  return adapter;
}

let layoutsAdapter: MockAdapter;
let designsAdapter: MockAdapter;
let adapters: SyncAdapters;

beforeEach(async () => {
  resetOutbox();
  try {
    await clearOutbox();
  } catch {
    /* first test of the file — DB not yet open */
  }
  vi.clearAllMocks();
  useSyncStatusStore.getState().reset();
  layoutsAdapter = makeMockAdapter();
  designsAdapter = makeMockAdapter();
  adapters = { layouts: layoutsAdapter, designs: designsAdapter };
  // Default: every fetch resolves with 200 + empty body.
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
});

afterEach(() => {
  engine.stop();
  resetOutbox();
});

async function flush(): Promise<void> {
  // Multiple microtask flushes to settle scheduleDrain → drain → pushOne.
  await new Promise((r) => setTimeout(r, 10));
  await engine.flushNow();
  await new Promise((r) => setTimeout(r, 10));
}

describe('engine.start / stop', () => {
  it('subscribes to every adapter on start', () => {
    engine.start(adapters);
    expect(layoutsAdapter.subscribe).toHaveBeenCalledTimes(1);
    expect(designsAdapter.subscribe).toHaveBeenCalledTimes(1);
  });

  it('start is idempotent', () => {
    engine.start(adapters);
    engine.start(adapters);
    expect(layoutsAdapter.subscribe).toHaveBeenCalledTimes(1);
  });

  it('stop unsubscribes and resets the status store', async () => {
    engine.start(adapters);
    useSyncStatusStore.getState().reportError('boom');
    engine.stop();
    expect(useSyncStatusStore.getState().state).toBe('idle');
    expect(useSyncStatusStore.getState().lastError).toBeUndefined();
  });
});

describe('push: PUT happy path', () => {
  it('on local change, sends PUT and clears the outbox on success', async () => {
    engine.start(adapters);
    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sync/layouts/lay-1',
      expect.objectContaining({ method: 'PUT' })
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ layout: { v: 1 }, modifiedAt: 1000 });
    expect(await outboxGetAll()).toEqual([]);
  });

  it('uses the design body shape for design adapters', async () => {
    engine.start(adapters);
    designsAdapter.triggerChange({ kind: 'put', id: 'des-1', modifiedAt: 2000 });
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sync/designs/des-1',
      expect.objectContaining({ method: 'PUT' })
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ design: { v: 1 }, modifiedAt: 2000 });
  });

  it('after success, status returns to idle and lastSyncedAt is set', async () => {
    engine.start(adapters);
    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    await flush();
    const s = useSyncStatusStore.getState();
    expect(s.state).toBe('idle');
    expect(s.pendingCount).toBe(0);
    expect(s.lastSyncedAt).toBeGreaterThan(0);
  });
});

describe('push: DELETE', () => {
  it('sends DELETE and treats 404 / 410 as idempotent success', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    engine.start(adapters);
    layoutsAdapter.triggerChange({ kind: 'delete', id: 'lay-1', modifiedAt: 5000 });
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sync/layouts/lay-1',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(await outboxGetAll()).toEqual([]);
  });
});

describe('push: 409 conflict', () => {
  it('pulls the stored envelope, applies via adapter, and emits remote-replaced-local', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          stored: { layout: { v: 99 }, modifiedAt: 9000, schemaVersion: 1 },
          indexEntry: { modifiedAt: 9000, sizeBytes: 0 },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    );

    engine.start(adapters);
    const events: engine.EngineEvent[] = [];
    engine.onEngineEvent((e) => events.push(e));

    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    await flush();

    expect(layoutsAdapter.applyRemote).toHaveBeenCalledWith({
      id: 'lay-1',
      payload: { v: 99 },
      modifiedAt: 9000,
    });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'remote-replaced-local', kind: 'layouts', id: 'lay-1' })
    );
    expect(await outboxGetAll()).toEqual([]);
  });
});

describe('push: 410 stale-resurrect blocked', () => {
  it('emits sync-error reason=deleted-elsewhere and clears the outbox entry', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 410 }));

    engine.start(adapters);
    const events: engine.EngineEvent[] = [];
    engine.onEngineEvent((e) => events.push(e));

    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    await flush();

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'sync-error', reason: 'deleted-elsewhere' })
    );
    expect(await outboxGetAll()).toEqual([]);
  });
});

describe('push: 413 quota exceeded', () => {
  it('emits sync-error reason=quota and reports error in status store', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Quota exceeded (count): 101 of 100.' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    engine.start(adapters);
    const events: engine.EngineEvent[] = [];
    engine.onEngineEvent((e) => events.push(e));

    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    await flush();

    expect(events).toContainEqual(expect.objectContaining({ type: 'sync-error', reason: 'quota' }));
    expect(useSyncStatusStore.getState().state).toBe('error');
  });
});

describe('push: uncaught rejections in fire-and-forget paths', () => {
  it('reports a network rejection from the scheduled drain via reportError instead of bubbling unhandled', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    engine.start(adapters);
    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    await new Promise((r) => setTimeout(r, 50));

    expect(useSyncStatusStore.getState().state).toBe('error');
    expect(useSyncStatusStore.getState().lastError).toContain('Failed to fetch');
  });
});

describe('push: 429 rate-limited', () => {
  it('reschedules without bumping attempts, reports offline, and does not give up', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '5' },
      })
    );

    engine.start(adapters);
    const events: engine.EngineEvent[] = [];
    engine.onEngineEvent((e) => events.push(e));

    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    await flush();

    const entries = await outboxGetAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].attempts).toBe(0);
    expect(entries[0].nextAttemptAt).toBeGreaterThan(Date.now() + 3_000);
    expect(useSyncStatusStore.getState().state).toBe('offline');
    expect(events.filter((e) => e.type === 'sync-error' && e.reason === 'gave-up')).toEqual([]);
  });

  it('falls back to exponential backoff when Retry-After is absent', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }));

    engine.start(adapters);
    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    await flush();

    const entries = await outboxGetAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].attempts).toBe(0);
    expect(entries[0].nextAttemptAt).toBeGreaterThanOrEqual(Date.now() + 900);
    expect(entries[0].nextAttemptAt).toBeLessThan(Date.now() + 2_000);
  });

  it('bumps the per-(kind,id) rate-limit counter so backoff actually escalates', async () => {
    // Regression: previous impl passed `entry.attempts` to
    // `rateLimitedBackoffMs`, but `rescheduleWithoutAttempt` keeps attempts
    // at 0 — so every 429 retried at ~1s forever. Engine now tracks a
    // separate counter that drives the exponent.
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }));

    engine.start(adapters);
    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    await flush();

    const counter = engine.__getEngineStateForTests()?.rateLimitedRetries.get('layouts:lay-1');
    expect(counter).toBe(1);
  });

  it('resets the rate-limit counter when a push succeeds', async () => {
    // Seed a counter as if we'd hit several 429s already, then have the
    // next push return 200 and assert the counter is cleared. Easier
    // than chaining 429-then-200 through the real backoff timer.
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    engine.start(adapters);
    engine.__getEngineStateForTests()?.rateLimitedRetries.set('layouts:lay-1', 3);

    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    await flush();

    expect(
      engine.__getEngineStateForTests()?.rateLimitedRetries.get('layouts:lay-1')
    ).toBeUndefined();
  });

  it('falls back to backoff when Retry-After is 0 (no immediate-retry loop)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 429, headers: { 'Retry-After': '0' } })
    );

    engine.start(adapters);
    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    await flush();

    const entries = await outboxGetAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].nextAttemptAt).toBeGreaterThanOrEqual(Date.now() + 900);
  });
});

describe('push: 5xx / network failure', () => {
  it('reschedules with backoff and reports offline', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    engine.start(adapters);
    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    await flush();

    const entries = await outboxGetAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].attempts).toBe(1);
    expect(useSyncStatusStore.getState().state).toBe('offline');
  });
});

describe('push: in-flight serialization', () => {
  it('does not double-send the same item if it is already being pushed', async () => {
    let resolveFirst: (() => void) | null = null;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = () => resolve(new Response(null, { status: 200 }));
        })
    );

    engine.start(adapters);
    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 1000 });
    // Trigger another change for the same id while the first push is in flight.
    layoutsAdapter.triggerChange({ kind: 'put', id: 'lay-1', modifiedAt: 2000 });

    await new Promise((r) => setTimeout(r, 10));
    // Only the first push should be in flight; second is queued.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFirst?.();
    await flush();

    // After the first resolves, the queued change pushes (now with mtime=2000).
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    const lastBody = JSON.parse((lastCall[1] as RequestInit).body as string);
    expect(lastBody.modifiedAt).toBe(2000);
  });
});

describe('push: get returns null', () => {
  it('drops the outbox entry when the item disappeared locally before push', async () => {
    engine.start(adapters);
    layoutsAdapter.triggerChange({ kind: 'put', id: 'gone', modifiedAt: 1000 });
    // Simulate the item being deleted between enqueue and drain.
    layoutsAdapter.triggerChange({ kind: 'delete', id: 'gone', modifiedAt: 1001 });
    // Now mock get returning null for `gone`.
    (layoutsAdapter.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await flush();
    // No PUT goes out for the deleted-then-gone item; only the DELETE.
    const puts = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PUT'
    );
    expect(puts.length).toBe(0);
  });
});
