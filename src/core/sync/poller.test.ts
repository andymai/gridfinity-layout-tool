// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __resetForTests, pullNow } from './poller';
import { useSessionStore } from './session/useSession';
import { useSyncStatusStore } from './status';
import type { SyncAdapter, SyncAdapters, SyncableItem } from './adapters/types';

const fetchMock = vi.fn();

vi.mock('./apiFetch', () => ({
  apiFetch: (url: string, init?: RequestInit) => fetchMock(url, init),
}));

interface MockAdapter extends SyncAdapter {
  items: Map<string, SyncableItem>;
}

function makeMockAdapter(): MockAdapter {
  const items = new Map<string, SyncableItem>();
  const adapter: MockAdapter = {
    items,
    list: vi.fn(async () => Array.from(items.values())),
    get: vi.fn(async (id: string) => items.get(id) ?? null),
    applyRemote: vi.fn(async (item) => {
      items.set(item.id, item);
    }),
    applyRemoteDelete: vi.fn(async (id) => {
      items.delete(id);
    }),
    subscribe: vi.fn(() => () => {}),
  };
  return adapter;
}

let layouts: MockAdapter;
let designs: MockAdapter;
let adapters: SyncAdapters;

beforeEach(() => {
  __resetForTests();
  vi.clearAllMocks();
  useSyncStatusStore.getState().reset();
  useSessionStore.setState({
    status: 'authenticated',
    user: { userId: 'test-user', email: 'test@example.com', provider: 'google' },
  });
  layouts = makeMockAdapter();
  designs = makeMockAdapter();
  adapters = { layouts, designs };
});

function manifestResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function envelopeResponse(envelope: unknown, indexEntry: unknown): Response {
  return new Response(JSON.stringify({ envelope, indexEntry }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('pullNow — session gate', () => {
  it('returns "unauthorized" without fetching when session is anonymous', async () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    const result = await pullNow(adapters);
    expect(result.status).toBe('unauthorized');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns "unauthorized" without fetching when session is unknown', async () => {
    useSessionStore.setState({ status: 'unknown', user: null });
    const result = await pullNow(adapters);
    expect(result.status).toBe('unauthorized');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('pullNow — single-flight + 304 path', () => {
  it('coalesces concurrent calls into one in-flight pull', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 304 }));
    await Promise.all([pullNow(adapters), pullNow(adapters), pullNow(adapters)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns "not-modified" when the server says 304', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
    const result = await pullNow(adapters);
    expect(result.status).toBe('not-modified');
  });

  it('returns "unauthorized" on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect((await pullNow(adapters)).status).toBe('unauthorized');
  });

  it('returns "offline" on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect((await pullNow(adapters)).status).toBe('offline');
  });

  it('returns "offline" on 429 (rate-limit) instead of error', async () => {
    // Regression: pull side was reporting error on 429, diverging from
    // the push side which honors Retry-After and treats 429 as throttling.
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 429, headers: { 'Retry-After': '5' } })
    );
    const result = await pullNow(adapters);
    expect(result.status).toBe('offline');
    expect(useSyncStatusStore.getState().state).toBe('offline');
  });
});

describe('diff: only-remote (live)', () => {
  it('downloads and applies via adapter.applyRemote', async () => {
    fetchMock
      .mockResolvedValueOnce(
        manifestResponse({
          layouts: { 'lay-1': { modifiedAt: 5000, sizeBytes: 100 } },
          designs: {},
          indexUpdatedAt: 5000,
        })
      )
      .mockResolvedValueOnce(
        envelopeResponse(
          { layout: { v: 1 }, modifiedAt: 5000, schemaVersion: 1 },
          { modifiedAt: 5000, sizeBytes: 100 }
        )
      );

    const result = await pullNow(adapters);
    expect(result.status).toBe('applied');
    expect(result.applied).toBe(1);
    expect(layouts.applyRemote).toHaveBeenCalledWith({
      id: 'lay-1',
      payload: { v: 1 },
      modifiedAt: 5000,
    });
  });
});

describe('diff: remote newer than local', () => {
  it('downloads and applies; bumps localMtime', async () => {
    layouts.items.set('lay-1', { id: 'lay-1', payload: { v: 'old' }, modifiedAt: 1000 });
    fetchMock
      .mockResolvedValueOnce(
        manifestResponse({
          layouts: { 'lay-1': { modifiedAt: 5000, sizeBytes: 100 } },
          designs: {},
          indexUpdatedAt: 5000,
        })
      )
      .mockResolvedValueOnce(
        envelopeResponse(
          { layout: { v: 'new' }, modifiedAt: 5000, schemaVersion: 1 },
          { modifiedAt: 5000, sizeBytes: 100 }
        )
      );

    const result = await pullNow(adapters);
    expect(result.applied).toBe(1);
    expect(layouts.applyRemote).toHaveBeenCalled();
  });
});

describe('diff: local newer than remote (push handles)', () => {
  it('does NOT pull — the local edit is the source of truth', async () => {
    layouts.items.set('lay-1', { id: 'lay-1', payload: { v: 'newer' }, modifiedAt: 9000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({
        layouts: { 'lay-1': { modifiedAt: 1000, sizeBytes: 100 } },
        designs: {},
        indexUpdatedAt: 9000,
      })
    );

    const result = await pullNow(adapters);
    expect(result.applied).toBe(0);
    expect(layouts.applyRemote).not.toHaveBeenCalled();
  });
});

describe('diff: equal mtime', () => {
  it('does nothing', async () => {
    layouts.items.set('lay-1', { id: 'lay-1', payload: { v: 1 }, modifiedAt: 5000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({
        layouts: { 'lay-1': { modifiedAt: 5000, sizeBytes: 100 } },
        designs: {},
        indexUpdatedAt: 5000,
      })
    );

    const result = await pullNow(adapters);
    expect(result.applied).toBe(0);
    expect(layouts.applyRemote).not.toHaveBeenCalled();
  });
});

describe('diff: remote tombstone newer than local', () => {
  it('applies the tombstone via applyRemoteDelete', async () => {
    layouts.items.set('lay-1', { id: 'lay-1', payload: { v: 1 }, modifiedAt: 1000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({
        layouts: {
          'lay-1': { modifiedAt: 5000, sizeBytes: 0, deletedAt: 5000 },
        },
        designs: {},
        indexUpdatedAt: 5000,
      })
    );

    const result = await pullNow(adapters);
    expect(result.applied).toBe(1);
    expect(layouts.applyRemoteDelete).toHaveBeenCalledWith('lay-1');
  });
});

describe('diff: remote tombstone older than local', () => {
  it('does NOT apply the tombstone — local edit is newer', async () => {
    layouts.items.set('lay-1', { id: 'lay-1', payload: { v: 'fresh' }, modifiedAt: 9000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({
        layouts: {
          'lay-1': { modifiedAt: 5000, sizeBytes: 0, deletedAt: 5000 },
        },
        designs: {},
        indexUpdatedAt: 9000,
      })
    );

    const result = await pullNow(adapters);
    expect(result.applied).toBe(0);
    expect(layouts.applyRemoteDelete).not.toHaveBeenCalled();
  });
});

describe('diff: only-remote tombstone, no local', () => {
  it('does nothing — nothing to delete locally', async () => {
    fetchMock.mockResolvedValueOnce(
      manifestResponse({
        layouts: { 'lay-1': { modifiedAt: 5000, sizeBytes: 0, deletedAt: 5000 } },
        designs: {},
        indexUpdatedAt: 5000,
      })
    );

    const result = await pullNow(adapters);
    expect(result.applied).toBe(0);
    expect(layouts.applyRemoteDelete).not.toHaveBeenCalled();
  });
});

describe('diff: only-local (no remote entry)', () => {
  it('does NOT apply anything — push handles new items', async () => {
    layouts.items.set('lay-1', { id: 'lay-1', payload: { v: 1 }, modifiedAt: 5000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 5000 })
    );

    const result = await pullNow(adapters);
    expect(result.applied).toBe(0);
  });
});

describe('diff: mixed kinds', () => {
  it('applies layouts and designs independently', async () => {
    fetchMock
      .mockResolvedValueOnce(
        manifestResponse({
          layouts: { 'lay-1': { modifiedAt: 1000, sizeBytes: 100 } },
          designs: { 'des-1': { modifiedAt: 2000, sizeBytes: 100 } },
          indexUpdatedAt: 2000,
        })
      )
      .mockResolvedValueOnce(
        envelopeResponse(
          { layout: { v: 1 }, modifiedAt: 1000, schemaVersion: 1 },
          { modifiedAt: 1000, sizeBytes: 100 }
        )
      )
      .mockResolvedValueOnce(
        envelopeResponse(
          { design: { d: 1 }, modifiedAt: 2000, schemaVersion: 1 },
          { modifiedAt: 2000, sizeBytes: 100 }
        )
      );

    const result = await pullNow(adapters);
    expect(result.applied).toBe(2);
    expect(layouts.applyRemote).toHaveBeenCalled();
    expect(designs.applyRemote).toHaveBeenCalled();
  });
});

describe('If-Modified-Since', () => {
  it('first pull omits the header; subsequent pulls send the cached timestamp', async () => {
    fetchMock
      .mockResolvedValueOnce(manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 5000 }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    await pullNow(adapters);
    const firstHeaders = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(firstHeaders['If-Modified-Since']).toBeUndefined();

    await pullNow(adapters);
    const secondHeaders = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(secondHeaders['If-Modified-Since']).toBe('5000');
  });
});

describe('envelope fetch failure', () => {
  it('skips items whose envelope fetch fails, applies the rest', async () => {
    fetchMock
      .mockResolvedValueOnce(
        manifestResponse({
          layouts: {
            good: { modifiedAt: 1000, sizeBytes: 100 },
            bad: { modifiedAt: 1000, sizeBytes: 100 },
          },
          designs: {},
          indexUpdatedAt: 1000,
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        envelopeResponse(
          { layout: { v: 1 }, modifiedAt: 1000, schemaVersion: 1 },
          { modifiedAt: 1000, sizeBytes: 100 }
        )
      );

    const result = await pullNow(adapters);
    expect(result.applied).toBe(1);
  });
});
