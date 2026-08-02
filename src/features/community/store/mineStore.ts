import { create } from 'zustand';
import { isOk } from '@/core/result';
import { useSessionStore } from '@/core/sync/session/useSession';
import type { CommunityCard } from '@/shared/types/community';
import type { CommunityClientError } from '../api/client';
import { fetchMineIndex } from '../api/client';
import { countsFromCards, saveFetchedCounts } from '../utils/communityDigest';

export const MINE_INDEX_STALE_MS = 5 * 60 * 1000;

export type MineLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The signed-in user's own published designs, from the server's `mine=1`
 * list. A separate store from browseStore because the public index
 * hard-excludes non-live designs: the owner's hidden designs only ever exist
 * here, and local `publishedId` scans would miss designs published from
 * another device.
 */
interface MineState {
  status: MineLoadStatus;
  items: readonly CommunityCard[];
  error: CommunityClientError | null;
  fetchedAt: number | null;
  /**
   * The account the cached items belong to. On a shared browser the cache
   * must never survive an account switch: hidden designs and owner-only
   * stats are visible to their owner alone.
   */
  forUserId: string | null;
  requestId: number;
}

interface MineActions {
  ensureIndex: () => Promise<void>;
  refreshIndex: () => Promise<void>;
  /** Optimistic removal after a successful unpublish. */
  removeItem: (id: string) => void;
  reset: () => void;
}

export type MineStore = MineState & MineActions;

export const INITIAL_MINE_STATE: MineState = {
  status: 'idle',
  items: [],
  error: null,
  fetchedAt: null,
  forUserId: null,
  requestId: 0,
};

export function isMineIndexStale(fetchedAt: number | null, now: number): boolean {
  return fetchedAt === null || now - fetchedAt >= MINE_INDEX_STALE_MS;
}

function sessionUserId(): string | null {
  const session = useSessionStore.getState();
  return session.status === 'authenticated' ? (session.user?.userId ?? null) : null;
}

export const useMineStore = create<MineStore>((set, get) => {
  async function load(force: boolean): Promise<void> {
    const userId = sessionUserId();
    if (userId === null) {
      get().reset();
      return;
    }
    const { status, fetchedAt, requestId, forUserId } = get();
    const userChanged = forUserId !== null && forUserId !== userId;
    if (!userChanged) {
      if (status === 'loading') return;
      if (!force && status === 'ready' && !isMineIndexStale(fetchedAt, Date.now())) return;
    }
    const thisRequest = requestId + 1;
    // An account switch drops the previous owner's cached cards before the
    // fetch, not after: their hidden designs must never paint for this user.
    set(
      userChanged
        ? { ...INITIAL_MINE_STATE, status: 'loading', requestId: thisRequest, forUserId: userId }
        : { status: 'loading', error: null, requestId: thisRequest, forUserId: userId }
    );
    const result = await fetchMineIndex();
    if (get().requestId !== thisRequest) return;
    if (isOk(result)) {
      // Keep the digest baseline in step with what the cards display:
      // without this write, activity fetched here would be shown to the
      // owner yet stay out of the committed seen counts, so the next
      // app-open digest would announce it again.
      saveFetchedCounts(userId, countsFromCards(result.value.items), Date.now());
      set({ status: 'ready', items: result.value.items, error: null, fetchedAt: Date.now() });
    } else {
      set({ status: 'error', error: result.error });
    }
  }

  return {
    ...INITIAL_MINE_STATE,
    ensureIndex: () => load(false),
    refreshIndex: () => load(true),
    removeItem: (id) => {
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
    },
    reset: () => {
      // Bumping requestId invalidates any in-flight fetch so its late
      // resolution cannot repopulate a store that was just reset (e.g. on
      // sign-out, where lingering hidden-status data would leak across
      // sessions on a shared machine).
      set({ ...INITIAL_MINE_STATE, requestId: get().requestId + 1 });
    },
  };
});
