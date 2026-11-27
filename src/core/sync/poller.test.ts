// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __resetForTests, endPulls, holdPulls, pullNow } from './poller';
import { useSessionStore } from './session/useSession';
import { useSyncStatusStore } from './status';
import { __resetForTests as resetFirewallChallenge } from './firewallChallenge';
import type {
  SyncAdapter,
  SyncAdapters,
  SyncableItem,
  LayoutAdapter,
  DesignAdapter,
  BaseplateAdapter,
  DesignVersionAdapter,
  FolderAdapter,
} from './adapters/types';

const fetchMock = vi.fn();
const enqueueMock = vi.hoisted(() => vi.fn(async () => {}));
const outboxEntries = vi.hoisted(() => ({ list: [] as Array<{ kind: string; id: string }> }));

vi.mock('./outbox', () => ({
  enqueue: enqueueMock,
  getAll: vi.fn(async () => outboxEntries.list),
}));

vi.mock('./apiFetch', async () => {
  const { noteFirewallChallenge } = await import('./firewallChallenge');
  return {
    apiFetch: async (url: string, init?: RequestInit) => {
      const res: unknown = await fetchMock(url, init);
      if (res instanceof Response) noteFirewallChallenge(res);
      return res;
    },
  };
});

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
let baseplates: MockAdapter;
let adapters: SyncAdapters;

beforeEach(() => {
  __resetForTests();
  resetFirewallChallenge();
  vi.clearAllMocks();
  useSyncStatusStore.getState().reset();
  useSessionStore.setState({
    status: 'authenticated',
    user: { userId: 'test-user', email: 'test@example.com', provider: 'google' },
  });
  layouts = makeMockAdapter();
  designs = makeMockAdapter();
  baseplates = makeMockAdapter();
  // MockAdapter's payload is deliberately untyped (`unknown`) — the poller
  // never inspects payload shape, only `id`/`modifiedAt`. SyncAdapter<Layout
  // |DesignSyncPayload|BaseplatePayload> is assignable to SyncAdapter<unknown>
  // (the concrete payload is assignable to `unknown`), so the reverse cast
  // here is sound, not a type-safety bypass.
  adapters = {
    layouts: layouts as LayoutAdapter,
    designs: designs as DesignAdapter,
    baseplates: baseplates as BaseplateAdapter,
    designVersions: baseplates as unknown as DesignVersionAdapter,
    folders: baseplates as unknown as FolderAdapter,
    cutoutItems: baseplates as unknown as SyncAdapters['cutoutItems'],
    cutoutFolders: baseplates as unknown as SyncAdapters['cutoutFolders'],
  };
});

function manifestResponse(body: unknown): Response {
  // Default an empty `baseplates` index so fixtures written before the third
  // sync kind still parse; explicit `baseplates` in `body` wins.
  const withDefaults =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? { baseplates: {}, ...(body as Record<string, unknown>) }
      : body;
  return new Response(JSON.stringify(withDefaults), {
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
    expect(useSyncStatusStore.getState().lastPulledAt).toBeDefined();
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

  it('stops item downloads at a challenge and reports no success', async () => {
    fetchMock
      .mockResolvedValueOnce(
        manifestResponse({
          layouts: {
            'lay-1': { modifiedAt: 5000, sizeBytes: 100 },
            'lay-2': { modifiedAt: 5000, sizeBytes: 100 },
          },
          designs: {},
          baseplates: {},
        })
      )
      .mockResolvedValueOnce(
        new Response('<html>', { status: 429, headers: { 'x-vercel-mitigated': 'challenge' } })
      );
    expect((await pullNow(adapters)).status).toBe('offline');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(layouts.applyRemote).not.toHaveBeenCalled();
    expect(useSyncStatusStore.getState().state).toBe('offline');
  });

  it('stops polling after a firewall challenge', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>', { status: 429, headers: { 'x-vercel-mitigated': 'challenge' } })
    );
    expect((await pullNow(adapters)).status).toBe('offline');
    expect((await pullNow(adapters)).status).toBe('offline');
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    expect(useSyncStatusStore.getState().lastPulledAt).toBeDefined();
    expect(layouts.applyRemote).toHaveBeenCalledWith({
      id: 'lay-1',
      payload: { v: 1 },
      modifiedAt: 5000,
      schemaVersion: 1,
    });
  });
});

describe('gated kinds: the cutout library', () => {
  let items: MockAdapter;

  beforeEach(() => {
    items = makeMockAdapter();
    adapters = { ...adapters, cutoutItems: items as unknown as SyncAdapters['cutoutItems'] };
    items.items.set('clib_local', { id: 'clib_local', payload: {}, modifiedAt: 100 });
  });

  it('leaves the library alone while the manifest leaves it out', async () => {
    fetchMock.mockResolvedValueOnce(
      manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 1 })
    );
    await pullNow(adapters);
    expect(items.list).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('pulls the library once listed, and queues what the server lacks only the first time', async () => {
    const listed = () =>
      manifestResponse({
        layouts: {},
        designs: {},
        cutoutFolders: {},
        cutoutItems: { clib_remote: { modifiedAt: 500, sizeBytes: 10 } },
        indexUpdatedAt: 2,
      });
    fetchMock
      .mockResolvedValueOnce(listed())
      .mockResolvedValueOnce(
        envelopeResponse(
          { cutoutItem: { name: 'Wrench' }, modifiedAt: 500, schemaVersion: 1 },
          { modifiedAt: 500, sizeBytes: 10 }
        )
      );

    await pullNow(adapters);
    expect(items.applyRemote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'clib_remote', payload: { name: 'Wrench' } })
    );
    expect(enqueueMock).toHaveBeenCalledWith({
      kind: 'cutoutItems',
      id: 'clib_local',
      modifiedAt: 100,
      op: 'put',
    });

    enqueueMock.mockClear();
    fetchMock.mockResolvedValueOnce(listed());
    await pullNow(adapters);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('does not pull back an item whose local change waits in the outbox', async () => {
    outboxEntries.list = [{ kind: 'cutoutItems', id: 'clib_deleted' }];
    fetchMock.mockResolvedValueOnce(
      manifestResponse({
        layouts: {},
        designs: {},
        cutoutFolders: {},
        cutoutItems: { clib_deleted: { modifiedAt: 500, sizeBytes: 10 } },
        indexUpdatedAt: 3,
      })
    );
    await pullNow(adapters);
    expect(items.applyRemote).not.toHaveBeenCalled();

    // The next pull asks for a full manifest, to read the item again.
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
    await pullNow(adapters);
    const headers = (fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined)?.headers;
    expect(headers).not.toHaveProperty('If-Modified-Since', '3');
    outboxEntries.list = [];
  });
});

describe('endPulls', () => {
  it('stops a pull in flight before its next write, once the running one lands', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/sync/manifest'
        ? manifestResponse({
            layouts: {
              'lay-1': { modifiedAt: 5000, sizeBytes: 100 },
              'lay-2': { modifiedAt: 5000, sizeBytes: 100 },
            },
            designs: {},
            indexUpdatedAt: 5000,
          })
        : envelopeResponse(
            { layout: { v: 1 }, modifiedAt: 5000, schemaVersion: 1 },
            { modifiedAt: 5000, sizeBytes: 100 }
          )
    );
    let landWrite = (): void => undefined;
    layouts.applyRemote = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          landWrite = resolve;
        })
    );
    const pull = pullNow(adapters);
    await vi.waitFor(() => expect(layouts.applyRemote).toHaveBeenCalledTimes(1));

    let ended = false;
    const ending = endPulls().then(() => {
      ended = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ended).toBe(false);

    landWrite();
    await ending;
    expect((await pull).status).toBe('offline');
    expect(layouts.applyRemote).toHaveBeenCalledTimes(1);
  });

  it('waits, at a later end, for a write an earlier pull still has in progress', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/sync/manifest'
        ? manifestResponse({
            layouts: { 'lay-1': { modifiedAt: 5000, sizeBytes: 100 } },
            designs: {},
            indexUpdatedAt: 5000,
          })
        : envelopeResponse(
            { layout: { v: 1 }, modifiedAt: 5000, schemaVersion: 1 },
            { modifiedAt: 5000, sizeBytes: 100 }
          )
    );
    const landings: (() => void)[] = [];
    layouts.applyRemote = vi.fn(() => new Promise<void>((resolve) => landings.push(resolve)));
    void pullNow(adapters);
    await vi.waitFor(() => expect(layouts.applyRemote).toHaveBeenCalledTimes(1));
    void endPulls();
    void pullNow(adapters);
    await vi.waitFor(() => expect(layouts.applyRemote).toHaveBeenCalledTimes(2));

    let ended = false;
    const ending = endPulls().then(() => {
      ended = true;
    });
    landings[1]();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ended).toBe(false);

    landings[0]();
    await ending;
  });

  it('lets an ended pull finish without freeing the slot of the pull after it', async () => {
    const answers: (() => void)[] = [];
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          answers.push(() =>
            resolve(manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 1 }))
          );
        })
    );
    const first = pullNow(adapters);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    void endPulls();
    const second = pullNow(adapters);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    answers[0]();
    await first;
    void pullNow(adapters);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    answers[1]();
    expect((await second).status).toBe('applied');
  });

  it('starts no pull while held, and pulls again once released', async () => {
    fetchMock.mockImplementation(async () =>
      manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 1 })
    );
    const { ended, release } = holdPulls();
    await ended;

    expect((await pullNow(adapters)).status).toBe('unauthorized');
    expect(fetchMock).not.toHaveBeenCalled();

    release();
    expect((await pullNow(adapters)).status).toBe('applied');
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
  const oneLayout = () =>
    manifestResponse({
      layouts: { 'lay-1': { modifiedAt: 1000, sizeBytes: 100 } },
      designs: {},
      indexUpdatedAt: 1000,
    });
  const manifestHeaders = (call: number) =>
    (fetchMock.mock.calls[call][1] as RequestInit).headers as Record<string, string>;

  it.each([
    ['a 503', () => Promise.resolve(new Response(null, { status: 503 }))],
    ['a 429', () => Promise.resolve(new Response(null, { status: 429 }))],
    ['a network error', () => Promise.reject(new Error('network'))],
    [
      'a cut-off body',
      () =>
        Promise.resolve(
          new Response('{"envelope":{"layout"', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        ),
    ],
  ])(
    'reads the manifest again after %s, so the next pull fetches the item',
    async (_label, fail) => {
      fetchMock
        .mockResolvedValueOnce(oneLayout())
        .mockImplementationOnce(fail)
        .mockResolvedValueOnce(oneLayout())
        .mockResolvedValueOnce(
          envelopeResponse(
            { layout: { v: 1 }, modifiedAt: 1000, schemaVersion: 1 },
            { modifiedAt: 1000, sizeBytes: 100 }
          )
        );

      expect((await pullNow(adapters)).applied).toBe(0);
      const second = await pullNow(adapters);

      expect(manifestHeaders(2)['If-Modified-Since']).toBeUndefined();
      expect(second.applied).toBe(1);
      expect(layouts.applyRemote).toHaveBeenCalledTimes(1);
    }
  );

  it('reads the whole manifest again after a retry, even at an unchanged timestamp', async () => {
    fetchMock
      .mockResolvedValueOnce(manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 1000 }))
      // A 200 at the same timestamp, as when a newly served kind changes the answer.
      .mockResolvedValueOnce(oneLayout())
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(oneLayout())
      .mockResolvedValueOnce(
        envelopeResponse(
          { layout: { v: 1 }, modifiedAt: 1000, schemaVersion: 1 },
          { modifiedAt: 1000, sizeBytes: 100 }
        )
      );

    await pullNow(adapters);
    await pullNow(adapters);
    const third = await pullNow(adapters);

    expect(manifestHeaders(1)['If-Modified-Since']).toBe('1000');
    expect(manifestHeaders(3)['If-Modified-Since']).toBeUndefined();
    expect(third.applied).toBe(1);
  });

  it('records a pull only once no download waits for a retry', async () => {
    fetchMock
      .mockResolvedValueOnce(oneLayout())
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(oneLayout())
      .mockResolvedValueOnce(
        envelopeResponse(
          { layout: { v: 1 }, modifiedAt: 1000, schemaVersion: 1 },
          { modifiedAt: 1000, sizeBytes: 100 }
        )
      );

    await pullNow(adapters);
    expect(useSyncStatusStore.getState().lastPulledAt).toBeUndefined();
    await pullNow(adapters);
    expect(useSyncStatusStore.getState().lastPulledAt).toBeTypeOf('number');
  });

  it('moves past a 404, so a blob the index lists but storage lacks is not fetched every poll', async () => {
    fetchMock
      .mockResolvedValueOnce(oneLayout())
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    await pullNow(adapters);
    await pullNow(adapters);

    expect(manifestHeaders(2)['If-Modified-Since']).toBe('1000');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
