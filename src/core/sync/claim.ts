import { apiFetch } from './apiFetch';
import { enqueue as outboxEnqueue, clearAll as outboxClearAll } from './outbox';
import { useSyncStatusStore } from './status';
import type { SyncAdapter, SyncAdapters, SyncKind, SyncableItem } from './adapters/types';

const LAST_USER_KEY = 'gflt-last-signed-in-user';

export type AccountMismatchChoice = 'merge' | 'discard';
export type AccountMismatchPrompt = (input: {
  localCount: number;
  newUserId: string;
  newAccountLabel: string;
}) => Promise<AccountMismatchChoice>;

export type ClaimResult =
  | { status: 'merged'; pulled: number; pushed: number }
  | { status: 'discarded' }
  | { status: 'unauthorized' }
  | { status: 'error'; message?: string };

interface ClaimContext {
  adapters: SyncAdapters;
  userId: string;
  /** Display label for the new account (typically email). */
  newAccountLabel: string;
  /** UI hook for the account-mismatch prompt. Required only if local
   *  items might exist when a different user signs in. */
  promptAccountMismatch: AccountMismatchPrompt;
}

interface IndexEntry {
  modifiedAt: number;
  sizeBytes: number;
  deletedAt?: number;
}

// Indexed by SyncKind so the merge loop can read a kind's entries without a
// per-kind branch. Every kind is optional: a manifest from a server predating
// that key omits it, and the loop falls back to an empty record.
type ManifestResponse = Partial<Record<SyncKind, Record<string, IndexEntry>>> & {
  indexUpdatedAt: number;
};

interface ItemFetchResponse {
  envelope: {
    layout?: unknown;
    design?: unknown;
    baseplate?: unknown;
    designVersion?: unknown;
    modifiedAt: number;
  };
}

const inFlightByUser = new Map<string, Promise<ClaimResult>>();

/**
 * Merge local + cloud state once at sign-in. Single-flight per userId:
 * concurrent callers for the same user (auth flip + visibility refresh
 * racing) await the same run, but a different userId starts a fresh run
 * — preventing a fast sign-out / sign-in-as-other-user from coalescing
 * under the prior account's context.
 *
 * Idempotent re-run: a second invocation against an already-merged
 * device hits all three diff cases as no-ops and resolves with a
 * `merged` result whose pushed/pulled counts are 0.
 */
export async function runClaim(ctx: ClaimContext): Promise<ClaimResult> {
  const existing = inFlightByUser.get(ctx.userId);
  if (existing) return existing;
  const run = execute(ctx).finally(() => {
    inFlightByUser.delete(ctx.userId);
  });
  inFlightByUser.set(ctx.userId, run);
  return run;
}

export function __resetForTests(): void {
  inFlightByUser.clear();
}

async function execute(ctx: ClaimContext): Promise<ClaimResult> {
  const status = useSyncStatusStore.getState();
  status.beginSync();
  try {
    return await executeInner(ctx);
  } catch (e) {
    status.reportError(e instanceof Error ? e.message : 'claim failed');
    return { status: 'error', message: e instanceof Error ? e.message : undefined };
  }
}

async function executeInner(ctx: ClaimContext): Promise<ClaimResult> {
  // Keyed by kind rather than one binding per kind: every step below iterates
  // this, so adding a SyncKind cannot silently skip the claim.
  const kinds = Object.keys(ctx.adapters) as SyncKind[];
  const local = {} as Record<SyncKind, SyncableItem[]>;
  for (const kind of kinds) local[kind] = await ctx.adapters[kind].list();

  const localCount = kinds.reduce((total, kind) => total + local[kind].length, 0);
  const lastUserId = readLastSignedInUserId();
  const accountMismatch = lastUserId !== null && lastUserId !== ctx.userId && localCount > 0;
  if (accountMismatch) {
    const choice = await ctx.promptAccountMismatch({
      localCount,
      newUserId: ctx.userId,
      newAccountLabel: ctx.newAccountLabel,
    });
    if (choice === 'discard') {
      // Clear the outbox FIRST: if wipeLocal succeeds but clearOutbox
      // throws (IDB failure), the prior user's pending pushes survive
      // and would drain under the new account once the engine starts.
      // Reverse order makes the failure safe — clearing the outbox is
      // the only step that gates cross-account leakage.
      await outboxClearAll();
      await wipeLocal(ctx.adapters, local);
      persistLastSignedInUserId(ctx.userId);
      useSyncStatusStore.getState().succeed();
      return { status: 'discarded' };
    }
  }

  const manifest = await fetchManifest();
  if (manifest === null) {
    persistLastSignedInUserId(ctx.userId);
    useSyncStatusStore.getState().reportOffline('manifest fetch failed during claim');
    return { status: 'error', message: 'manifest fetch failed' };
  }
  if (manifest === 'unauthorized') {
    // Persist on 401 too: a transient cookie-propagation race shouldn't
    // make the next retry re-prompt the same user as a "different account".
    persistLastSignedInUserId(ctx.userId);
    useSyncStatusStore.getState().reportError('unauthorized during claim');
    return { status: 'unauthorized' };
  }

  let pulled = 0;
  let pushed = 0;
  for (const kind of kinds) {
    // `?? {}` covers a manifest predating this kind's key (schema skew).
    const counts = await mergeKind(ctx.adapters[kind], kind, local[kind], manifest[kind] ?? {});
    pulled += counts.pulled;
    pushed += counts.pushed;
  }

  persistLastSignedInUserId(ctx.userId);
  useSyncStatusStore.getState().succeed();

  return {
    status: 'merged',
    pulled,
    pushed,
  };
}

/**
 * Each kind's envelope names its payload differently on the wire
 * (`layout` / `design` / `baseplate` / `designVersion`), so the key is looked
 * up rather than branched on at both call sites.
 */
const ENVELOPE_KEY: Record<SyncKind, 'layout' | 'design' | 'baseplate' | 'designVersion'> = {
  layouts: 'layout',
  designs: 'design',
  baseplates: 'baseplate',
  designVersions: 'designVersion',
};

function envelopePayload(kind: SyncKind, fetched: ItemFetchResponse): unknown {
  return fetched.envelope[ENVELOPE_KEY[kind]];
}

interface MergeCounts {
  pulled: number;
  pushed: number;
}

async function mergeKind(
  adapter: SyncAdapter,
  kind: SyncKind,
  local: SyncableItem[],
  remote: Record<string, IndexEntry>
): Promise<MergeCounts> {
  const localById = new Map<string, SyncableItem>();
  for (const item of local) localById.set(item.id, item);

  let pulled = 0;
  let pushed = 0;

  for (const [id, entry] of Object.entries(remote)) {
    const localItem = localById.get(id);

    if (entry.deletedAt !== undefined) {
      if (localItem && localItem.modifiedAt < entry.deletedAt) {
        await adapter.applyRemoteDelete(id);
        pulled++;
      } else if (localItem) {
        // Local edit is newer than a remote tombstone — the user
        // deleted on another device and then re-edited here.
        // Resurrect it by pushing; without this, the only-local loop
        // below skips the push (because the id is in `remote`) and
        // the local edit never reaches cloud.
        await outboxEnqueue({
          kind,
          id,
          modifiedAt: localItem.modifiedAt,
          op: 'put',
        });
        pushed++;
      }
      continue;
    }

    if (!localItem) {
      const fetched = await fetchEnvelope(kind, id);
      if (fetched) {
        const payload = envelopePayload(kind, fetched);
        if (payload !== undefined) {
          await adapter.applyRemote({ id, payload, modifiedAt: fetched.envelope.modifiedAt });
          pulled++;
        }
      }
      continue;
    }

    if (localItem.modifiedAt < entry.modifiedAt) {
      const fetched = await fetchEnvelope(kind, id);
      if (fetched) {
        const payload = envelopePayload(kind, fetched);
        if (payload !== undefined) {
          await adapter.applyRemote({ id, payload, modifiedAt: fetched.envelope.modifiedAt });
          pulled++;
        }
      }
      continue;
    }

    if (localItem.modifiedAt > entry.modifiedAt) {
      await outboxEnqueue({ kind, id, modifiedAt: localItem.modifiedAt, op: 'put' });
      pushed++;
    }
  }

  for (const item of local) {
    // hasOwn (not `in`) so an id like "constructor" or "toString" can't
    // be falsely treated as present via Object.prototype.
    if (Object.hasOwn(remote, item.id)) continue;
    await outboxEnqueue({ kind, id: item.id, modifiedAt: item.modifiedAt, op: 'put' });
    pushed++;
  }

  return { pulled, pushed };
}

async function fetchManifest(): Promise<ManifestResponse | null | 'unauthorized'> {
  let res: Response;
  try {
    res = await apiFetch('/api/sync/manifest');
  } catch {
    return null;
  }
  if (res.status === 401) return 'unauthorized';
  if (!res.ok) return null;
  try {
    return (await res.json()) as ManifestResponse;
  } catch {
    return null;
  }
}

async function fetchEnvelope(kind: SyncKind, id: string): Promise<ItemFetchResponse | null> {
  let res: Response;
  try {
    res = await apiFetch(`/api/sync/${kind}/${id}`);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  try {
    return (await res.json()) as ItemFetchResponse;
  } catch {
    return null;
  }
}

async function wipeLocal(
  adapters: SyncAdapters,
  local: Record<SyncKind, SyncableItem[]>
): Promise<void> {
  for (const kind of Object.keys(adapters) as SyncKind[]) {
    for (const item of local[kind]) await adapters[kind].applyRemoteDelete(item.id);
  }
}

function readLastSignedInUserId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export function persistLastSignedInUserId(userId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    /* private mode / quota — silent. The mismatch guard becomes
       permissive in this case (no last user → silent claim). */
  }
}

export function clearLastSignedInUserId(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    /* same caveat as persist */
  }
}
