import { apiFetch } from './apiFetch';
import { enqueue as outboxEnqueue } from './outbox';
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

interface ManifestResponse {
  layouts: Record<string, IndexEntry>;
  designs: Record<string, IndexEntry>;
  indexUpdatedAt: number;
}

interface ItemFetchResponse {
  envelope: { layout?: unknown; design?: unknown; modifiedAt: number };
}

let inFlight: Promise<ClaimResult> | null = null;

/**
 * Merge local + cloud state once at sign-in. Single-flight: concurrent
 * callers (auth flip + visibility refresh racing) await the same run.
 *
 * Idempotent re-run: a second invocation against an already-merged
 * device hits all three diff cases as no-ops and resolves with a
 * `merged` result whose pushed/pulled counts are 0.
 */
export async function runClaim(ctx: ClaimContext): Promise<ClaimResult> {
  if (inFlight) return inFlight;
  inFlight = execute(ctx).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function __resetForTests(): void {
  inFlight = null;
}

async function execute(ctx: ClaimContext): Promise<ClaimResult> {
  useSyncStatusStore.getState().beginSync();

  const localLayouts = await ctx.adapters.layouts.list();
  const localDesigns = await ctx.adapters.designs.list();

  const lastUserId = readLastSignedInUserId();
  const accountMismatch =
    lastUserId !== null &&
    lastUserId !== ctx.userId &&
    localLayouts.length + localDesigns.length > 0;
  if (accountMismatch) {
    const choice = await ctx.promptAccountMismatch({
      localCount: localLayouts.length + localDesigns.length,
      newUserId: ctx.userId,
      newAccountLabel: ctx.newAccountLabel,
    });
    if (choice === 'discard') {
      await wipeLocal(ctx.adapters, localLayouts, localDesigns);
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
    return { status: 'unauthorized' };
  }

  const layoutCounts = await mergeKind(
    ctx.adapters.layouts,
    'layouts',
    localLayouts,
    manifest.layouts
  );
  const designCounts = await mergeKind(
    ctx.adapters.designs,
    'designs',
    localDesigns,
    manifest.designs
  );

  persistLastSignedInUserId(ctx.userId);
  useSyncStatusStore.getState().succeed();

  return {
    status: 'merged',
    pulled: layoutCounts.pulled + designCounts.pulled,
    pushed: layoutCounts.pushed + designCounts.pushed,
  };
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
      }
      continue;
    }

    if (!localItem) {
      const fetched = await fetchEnvelope(kind, id);
      if (fetched) {
        const payload = kind === 'layouts' ? fetched.envelope.layout : fetched.envelope.design;
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
        const payload = kind === 'layouts' ? fetched.envelope.layout : fetched.envelope.design;
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
    if (item.id in remote) continue;
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
  layouts: SyncableItem[],
  designs: SyncableItem[]
): Promise<void> {
  for (const item of layouts) await adapters.layouts.applyRemoteDelete(item.id);
  for (const item of designs) await adapters.designs.applyRemoteDelete(item.id);
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
