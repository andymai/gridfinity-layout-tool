import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ok, err } from '@/core/result';
import { useSessionStore } from '@/core/sync/session/useSession';
import type { CommunityCard } from '@/shared/types/community';
import { fetchMineIndex } from '../api/client';
import { saveFetchedCounts } from '../utils/communityDigest';
import {
  INITIAL_MINE_STATE,
  MINE_INDEX_STALE_MS,
  isMineIndexStale,
  useMineStore,
} from './mineStore';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return { ...actual, fetchMineIndex: vi.fn() };
});

vi.mock('../utils/communityDigest', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return { ...actual, saveFetchedCounts: vi.fn() };
});

const mineMock = vi.mocked(fetchMineIndex);
const saveFetchedCountsMock = vi.mocked(saveFetchedCounts);

function card(id: string, overrides: Partial<CommunityCard> = {}): CommunityCard {
  return {
    id,
    name: `Bin ${id}`,
    authorName: 'Andy',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: ['compartments'],
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    thumbnailUrl: `https://blob/${id}.webp`,
    isRemix: false,
    featured: false,
    counts: { likes: 0, remixes: 0, exports: 0, opens: 0, views: 0 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

function authenticate(userId: string): void {
  useSessionStore.setState({
    status: 'authenticated',
    user: { userId, provider: 'google', email: 'a@b.c' },
  });
}

beforeEach(() => {
  mineMock.mockReset();
  saveFetchedCountsMock.mockReset();
  useMineStore.setState({ ...INITIAL_MINE_STATE });
  authenticate('user-1');
});

afterEach(() => {
  useSessionStore.setState({ status: 'unknown', user: null });
  vi.restoreAllMocks();
});

describe('ensureIndex', () => {
  it('loads the mine list, including hidden designs, and stores fetch time', async () => {
    mineMock.mockResolvedValue(
      ok({
        items: [card('a'), card('b', { status: 'hidden', hiddenReason: 'reports' })],
        capped: false,
      })
    );
    await useMineStore.getState().ensureIndex();
    const state = useMineStore.getState();
    expect(state.status).toBe('ready');
    expect(state.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(state.items[1].status).toBe('hidden');
    expect(state.items[1].hiddenReason).toBe('reports');
    expect(state.fetchedAt).not.toBeNull();
    expect(state.forUserId).toBe('user-1');
    expect(state.error).toBeNull();
  });

  it('writes the fetched counts as the digest latest baseline', async () => {
    mineMock.mockResolvedValue(
      ok({
        items: [card('a', { counts: { likes: 3, remixes: 1, exports: 2, opens: 5, views: 9 } })],
        capped: false,
      })
    );
    await useMineStore.getState().ensureIndex();
    expect(saveFetchedCountsMock).toHaveBeenCalledWith(
      'user-1',
      { a: { likes: 3, remixes: 1, exports: 2 } },
      expect.any(Number)
    );
  });

  it('skips the digest write when the fetch fails', async () => {
    mineMock.mockResolvedValue(err({ kind: 'network' }));
    await useMineStore.getState().ensureIndex();
    expect(saveFetchedCountsMock).not.toHaveBeenCalled();
  });

  it('skips a refetch while the index is fresh, refetches once stale', async () => {
    mineMock.mockResolvedValue(ok({ items: [card('a')], capped: false }));
    await useMineStore.getState().ensureIndex();
    await useMineStore.getState().ensureIndex();
    expect(mineMock).toHaveBeenCalledTimes(1);

    useMineStore.setState({ fetchedAt: Date.now() - MINE_INDEX_STALE_MS });
    await useMineStore.getState().ensureIndex();
    expect(mineMock).toHaveBeenCalledTimes(2);
  });

  it('stores the client error on failure and recovers on refresh', async () => {
    mineMock.mockResolvedValue(err({ kind: 'needsAuth' }));
    await useMineStore.getState().ensureIndex();
    expect(useMineStore.getState().status).toBe('error');
    expect(useMineStore.getState().error).toEqual({ kind: 'needsAuth' });

    mineMock.mockResolvedValue(ok({ items: [card('a')], capped: false }));
    await useMineStore.getState().refreshIndex();
    expect(useMineStore.getState().status).toBe('ready');
    expect(useMineStore.getState().error).toBeNull();
  });

  it('refreshIndex refetches even when fresh', async () => {
    mineMock.mockResolvedValue(ok({ items: [card('a')], capped: false }));
    await useMineStore.getState().ensureIndex();
    await useMineStore.getState().refreshIndex();
    expect(mineMock).toHaveBeenCalledTimes(2);
  });

  it('resets instead of fetching while signed out', async () => {
    mineMock.mockResolvedValue(ok({ items: [card('a')], capped: false }));
    await useMineStore.getState().ensureIndex();
    expect(useMineStore.getState().items).toHaveLength(1);

    useSessionStore.setState({ status: 'anonymous', user: null });
    await useMineStore.getState().ensureIndex();
    expect(mineMock).toHaveBeenCalledTimes(1);
    expect(useMineStore.getState().status).toBe('idle');
    expect(useMineStore.getState().items).toEqual([]);
    expect(useMineStore.getState().forUserId).toBeNull();
  });

  it('discards the previous account cache and refetches on a user switch', async () => {
    mineMock.mockResolvedValue(
      ok({ items: [card('a', { status: 'hidden', hiddenReason: 'reports' })], capped: false })
    );
    await useMineStore.getState().ensureIndex();
    expect(useMineStore.getState().forUserId).toBe('user-1');

    type MineResult = Awaited<ReturnType<typeof fetchMineIndex>>;
    let resolve: (value: MineResult) => void = () => {};
    mineMock.mockReturnValue(
      new Promise<MineResult>((r) => {
        resolve = r;
      })
    );
    authenticate('user-2');
    // Fresh cache would normally short-circuit ensureIndex; the user switch
    // must both clear the items synchronously and force the refetch.
    const pending = useMineStore.getState().ensureIndex();
    expect(useMineStore.getState().items).toEqual([]);
    expect(useMineStore.getState().status).toBe('loading');
    expect(useMineStore.getState().forUserId).toBe('user-2');

    resolve(ok({ items: [card('b')], capped: false }));
    await pending;
    expect(useMineStore.getState().items.map((item) => item.id)).toEqual(['b']);
    expect(saveFetchedCountsMock).toHaveBeenLastCalledWith(
      'user-2',
      expect.any(Object),
      expect.any(Number)
    );
  });
});

describe('removeItem', () => {
  it('drops only the unpublished card', async () => {
    mineMock.mockResolvedValue(ok({ items: [card('a'), card('b')], capped: false }));
    await useMineStore.getState().ensureIndex();
    useMineStore.getState().removeItem('a');
    expect(useMineStore.getState().items.map((item) => item.id)).toEqual(['b']);
  });
});

describe('reset', () => {
  it('discards an in-flight fetch so it cannot repopulate the store', async () => {
    type MineResult = Awaited<ReturnType<typeof fetchMineIndex>>;
    let resolve: (value: MineResult) => void = () => {};
    mineMock.mockReturnValue(
      new Promise<MineResult>((r) => {
        resolve = r;
      })
    );
    const pending = useMineStore.getState().ensureIndex();
    useMineStore.getState().reset();
    resolve(ok({ items: [card('a')], capped: false }));
    await pending;
    expect(useMineStore.getState().items).toEqual([]);
    expect(useMineStore.getState().status).toBe('idle');
  });
});

describe('isMineIndexStale', () => {
  it('treats a null fetch time as stale', () => {
    expect(isMineIndexStale(null, Date.now())).toBe(true);
  });
});
