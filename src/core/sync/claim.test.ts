// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __resetForTests, runClaim, type AccountMismatchPrompt, type ClaimResult } from './claim';
import type { SyncAdapter, SyncAdapters, SyncableItem } from './adapters/types';

const fetchMock = vi.fn();
const enqueueMock = vi.fn();
const clearOutboxMock = vi.fn();

vi.mock('./apiFetch', () => ({
  apiFetch: (url: string, init?: RequestInit) => fetchMock(url, init),
}));

vi.mock('./outbox', () => ({
  enqueue: (input: unknown) => enqueueMock(input),
  clearAll: () => clearOutboxMock(),
}));

interface MockAdapter extends SyncAdapter {
  items: Map<string, SyncableItem>;
}

function makeAdapter(): MockAdapter {
  const items = new Map<string, SyncableItem>();
  return {
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
}

let layouts: MockAdapter;
let designs: MockAdapter;
let baseplates: MockAdapter;
let adapters: SyncAdapters;
const promptMergeMock: AccountMismatchPrompt = vi.fn(async () => 'merge');
const promptDiscardMock: AccountMismatchPrompt = vi.fn(async () => 'discard');

beforeEach(() => {
  __resetForTests();
  vi.clearAllMocks();
  localStorage.clear();
  layouts = makeAdapter();
  designs = makeAdapter();
  baseplates = makeAdapter();
  adapters = { layouts, designs, baseplates };
  fetchMock.mockReset();
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

function envelopeResponse(envelope: unknown): Response {
  return new Response(JSON.stringify({ envelope, indexEntry: {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ctx(
  overrides: Partial<Parameters<typeof runClaim>[0]> = {}
): Parameters<typeof runClaim>[0] {
  return {
    adapters,
    userId: 'user-1',
    newAccountLabel: 'a@example.com',
    promptAccountMismatch: promptMergeMock,
    ...overrides,
  };
}

describe('runClaim — single-flight', () => {
  it('coalesces concurrent runs for the same userId into one', async () => {
    fetchMock.mockResolvedValue(manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 0 }));
    const [a, b] = await Promise.all([runClaim(ctx()), runClaim(ctx())]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not coalesce concurrent runs for different userIds', async () => {
    fetchMock.mockResolvedValue(manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 0 }));
    const [a, b] = await Promise.all([
      runClaim(ctx({ userId: 'user-1' })),
      runClaim(ctx({ userId: 'user-2' })),
    ]);
    expect(a).not.toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('runClaim — diff quadrants', () => {
  it('only-local: enqueues a PUT for each local item not in the cloud', async () => {
    layouts.items.set('a', { id: 'a', payload: { v: 1 }, modifiedAt: 1000 });
    layouts.items.set('b', { id: 'b', payload: { v: 1 }, modifiedAt: 2000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 0 })
    );

    const result = (await runClaim(ctx())) as ClaimResult & { status: 'merged' };
    expect(result.status).toBe('merged');
    expect(result.pushed).toBe(2);
    expect(result.pulled).toBe(0);
    expect(enqueueMock).toHaveBeenCalledTimes(2);
  });

  it('only-cloud: fetches and applies each cloud item not present locally', async () => {
    fetchMock
      .mockResolvedValueOnce(
        manifestResponse({
          layouts: { a: { modifiedAt: 1000, sizeBytes: 100 } },
          designs: { d: { modifiedAt: 2000, sizeBytes: 100 } },
          indexUpdatedAt: 2000,
        })
      )
      .mockResolvedValueOnce(envelopeResponse({ layout: { v: 1 }, modifiedAt: 1000 }))
      .mockResolvedValueOnce(envelopeResponse({ design: { v: 1 }, modifiedAt: 2000 }));

    const result = (await runClaim(ctx())) as ClaimResult & { status: 'merged' };
    expect(result.pulled).toBe(2);
    expect(result.pushed).toBe(0);
    expect(layouts.applyRemote).toHaveBeenCalledWith({
      id: 'a',
      payload: { v: 1 },
      modifiedAt: 1000,
    });
    expect(designs.applyRemote).toHaveBeenCalledWith({
      id: 'd',
      payload: { v: 1 },
      modifiedAt: 2000,
    });
  });

  it('local-newer: enqueues a PUT (no fetch needed)', async () => {
    layouts.items.set('a', { id: 'a', payload: { v: 'newer' }, modifiedAt: 9000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({
        layouts: { a: { modifiedAt: 1000, sizeBytes: 100 } },
        designs: {},
        indexUpdatedAt: 1000,
      })
    );

    const result = (await runClaim(ctx())) as ClaimResult & { status: 'merged' };
    expect(result.pushed).toBe(1);
    expect(result.pulled).toBe(0);
    expect(layouts.applyRemote).not.toHaveBeenCalled();
  });

  it('cloud-newer: fetches and applies (overwrites local)', async () => {
    layouts.items.set('a', { id: 'a', payload: { v: 'old' }, modifiedAt: 1000 });
    fetchMock
      .mockResolvedValueOnce(
        manifestResponse({
          layouts: { a: { modifiedAt: 9000, sizeBytes: 100 } },
          designs: {},
          indexUpdatedAt: 9000,
        })
      )
      .mockResolvedValueOnce(envelopeResponse({ layout: { v: 'new' }, modifiedAt: 9000 }));

    const result = (await runClaim(ctx())) as ClaimResult & { status: 'merged' };
    expect(result.pulled).toBe(1);
    expect(result.pushed).toBe(0);
  });

  it('equal mtime: no-op', async () => {
    layouts.items.set('a', { id: 'a', payload: { v: 1 }, modifiedAt: 5000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({
        layouts: { a: { modifiedAt: 5000, sizeBytes: 100 } },
        designs: {},
        indexUpdatedAt: 5000,
      })
    );

    const result = (await runClaim(ctx())) as ClaimResult & { status: 'merged' };
    expect(result.pushed).toBe(0);
    expect(result.pulled).toBe(0);
  });

  it('remote tombstone newer than local: applies the delete', async () => {
    layouts.items.set('a', { id: 'a', payload: { v: 1 }, modifiedAt: 1000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({
        layouts: { a: { modifiedAt: 5000, sizeBytes: 0, deletedAt: 5000 } },
        designs: {},
        indexUpdatedAt: 5000,
      })
    );

    const result = (await runClaim(ctx())) as ClaimResult & { status: 'merged' };
    expect(result.pulled).toBe(1);
    expect(layouts.applyRemoteDelete).toHaveBeenCalledWith('a');
  });

  it('remote tombstone older than local: pushes the local edit to resurrect it', async () => {
    layouts.items.set('a', { id: 'a', payload: { v: 'fresh' }, modifiedAt: 9000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({
        layouts: { a: { modifiedAt: 5000, sizeBytes: 0, deletedAt: 5000 } },
        designs: {},
        indexUpdatedAt: 9000,
      })
    );

    const result = (await runClaim(ctx())) as ClaimResult & { status: 'merged' };
    expect(layouts.applyRemoteDelete).not.toHaveBeenCalled();
    expect(result.pushed).toBe(1);
    expect(result.pulled).toBe(0);
    expect(enqueueMock).toHaveBeenCalledWith({
      kind: 'layouts',
      id: 'a',
      modifiedAt: 9000,
      op: 'put',
    });
  });
});

describe('runClaim — account-mismatch guard', () => {
  it('does not prompt when no lastSignedInUserId is stored (silent claim)', async () => {
    layouts.items.set('a', { id: 'a', payload: { v: 1 }, modifiedAt: 1000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 0 })
    );

    await runClaim(ctx());
    expect(promptMergeMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('gflt-last-signed-in-user')).toBe('user-1');
  });

  it('does not prompt when lastSignedInUserId matches the current user', async () => {
    localStorage.setItem('gflt-last-signed-in-user', 'user-1');
    layouts.items.set('a', { id: 'a', payload: { v: 1 }, modifiedAt: 1000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 0 })
    );

    await runClaim(ctx());
    expect(promptMergeMock).not.toHaveBeenCalled();
  });

  it('does not prompt when there are no local items (nothing to leak)', async () => {
    localStorage.setItem('gflt-last-signed-in-user', 'user-other');
    fetchMock.mockResolvedValueOnce(
      manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 0 })
    );

    await runClaim(ctx());
    expect(promptMergeMock).not.toHaveBeenCalled();
  });

  it('prompts when a different account has local items; merge proceeds normally', async () => {
    localStorage.setItem('gflt-last-signed-in-user', 'user-other');
    layouts.items.set('a', { id: 'a', payload: { v: 1 }, modifiedAt: 1000 });
    fetchMock.mockResolvedValueOnce(
      manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 0 })
    );

    await runClaim(ctx({ promptAccountMismatch: promptMergeMock }));
    expect(promptMergeMock).toHaveBeenCalledWith({
      localCount: 1,
      newUserId: 'user-1',
      newAccountLabel: 'a@example.com',
    });
    expect(layouts.applyRemoteDelete).not.toHaveBeenCalled();
  });

  it('discard wipes local items and short-circuits before manifest fetch', async () => {
    localStorage.setItem('gflt-last-signed-in-user', 'user-other');
    layouts.items.set('a', { id: 'a', payload: { v: 1 }, modifiedAt: 1000 });
    layouts.items.set('b', { id: 'b', payload: { v: 1 }, modifiedAt: 1000 });

    const result = await runClaim(ctx({ promptAccountMismatch: promptDiscardMock }));
    expect(result.status).toBe('discarded');
    expect(layouts.applyRemoteDelete).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('gflt-last-signed-in-user')).toBe('user-1');
  });

  it('discard also clears the outbox so prior-user pushes do not drain under the new account', async () => {
    localStorage.setItem('gflt-last-signed-in-user', 'user-other');
    layouts.items.set('a', { id: 'a', payload: { v: 1 }, modifiedAt: 1000 });

    await runClaim(ctx({ promptAccountMismatch: promptDiscardMock }));
    expect(clearOutboxMock).toHaveBeenCalled();
  });

  it('discard clears the outbox before wipeLocal so a wipeLocal failure cannot leak prior-user pushes', async () => {
    localStorage.setItem('gflt-last-signed-in-user', 'user-other');
    const order: string[] = [];
    clearOutboxMock.mockImplementation(async () => {
      order.push('clearOutbox');
    });
    layouts.applyRemoteDelete = vi.fn(async () => {
      order.push('wipe');
    });
    layouts.items.set('a', { id: 'a', payload: { v: 1 }, modifiedAt: 1000 });

    await runClaim(ctx({ promptAccountMismatch: promptDiscardMock }));
    expect(order.indexOf('clearOutbox')).toBeLessThan(order.indexOf('wipe'));
  });
});

describe('runClaim — failure modes', () => {
  it('returns "unauthorized" when manifest GET 401s', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect((await runClaim(ctx())).status).toBe('unauthorized');
  });

  it('persists lastSignedInUserId on 401 so a transient cookie race does not re-prompt mismatch', async () => {
    localStorage.setItem('gflt-last-signed-in-user', 'user-other');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));

    await runClaim(ctx());
    expect(localStorage.getItem('gflt-last-signed-in-user')).toBe('user-1');
  });

  it('returns "error" on network failure during manifest fetch', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect((await runClaim(ctx())).status).toBe('error');
  });

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
      .mockResolvedValueOnce(envelopeResponse({ layout: { v: 1 }, modifiedAt: 1000 }));

    const result = (await runClaim(ctx())) as ClaimResult & { status: 'merged' };
    expect(result.pulled).toBe(1);
  });
});

describe('runClaim — idempotent re-run', () => {
  it('a second run after a clean merge is a no-op', async () => {
    fetchMock
      .mockResolvedValueOnce(manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 0 }))
      .mockResolvedValueOnce(manifestResponse({ layouts: {}, designs: {}, indexUpdatedAt: 0 }));

    const first = (await runClaim(ctx())) as ClaimResult & { status: 'merged' };
    const second = (await runClaim(ctx())) as ClaimResult & { status: 'merged' };
    expect(first.pushed).toBe(0);
    expect(second.pushed).toBe(0);
    expect(second.pulled).toBe(0);
  });
});
