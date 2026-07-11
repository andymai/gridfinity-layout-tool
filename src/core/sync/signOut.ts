import { signOut as apiSignOut } from './session/sessionApi';
import { flushNow, getPendingEntries, stop as stopEngine } from './engine';
import { clearAll as clearOutbox } from './outbox';
import { resetPullState } from './poller';
import { clearLastSignedInUserId } from './claim';
import type { SyncAdapters } from './adapters/types';

const FLUSH_TIMEOUT_MS = 5_000;

export type KeepLocalChoice = 'keep' | 'wipe';
export type KeepLocalPromptResult = KeepLocalChoice | 'cancel';
export type KeepLocalPrompt = (input: { localCount: number }) => Promise<KeepLocalPromptResult>;

interface SignOutContext {
  adapters: SyncAdapters;
  /** UI hook: ConfirmDialog asking whether to keep local data on this device. */
  promptKeepLocal: KeepLocalPrompt;
  /** Called after server logout completes; the session store flips to anonymous. */
  onAnonymous: () => void;
}

export type SignOutResult = { status: 'kept' } | { status: 'wiped' } | { status: 'cancelled' };

/**
 * Explicit sign-out triggered from the user menu. Distinct from the
 * forced-401 path (which is silent and never wipes — see useSession's
 * forced-sign-out handler).
 *
 * Order: prompt first (dialog renders immediately so the user gets
 * feedback within a frame), then flush only on the keep path. The
 * wipe path is going to clearOutbox() anyway, so flushing before
 * the prompt would be wasted work and a 5s dead zone for the user.
 */
export async function runSignOut(ctx: SignOutContext): Promise<SignOutResult> {
  const localCount = await countLocalItems(ctx.adapters);
  const choice = await ctx.promptKeepLocal({ localCount });
  if (!isChoice(choice)) return { status: 'cancelled' };

  if (choice === 'wipe') {
    // Stop the engine FIRST. Otherwise a periodic poll or visibility
    // flush running in parallel can applyRemote() new items between
    // wipeLocal's list() snapshot and its delete loop, leaving the
    // prior user's data behind in storage.
    stopEngine();
    // Clear outbox before wipeLocal: if clearOutbox throws (IDB failure),
    // wipeLocal hasn't run yet so the engine has nothing to drain. Same
    // safety order as claim.ts's discard path.
    await clearOutbox();
    await wipeLocal(ctx.adapters);
    clearLastSignedInUserId();
  } else {
    // Keep path: give in-flight pushes 5s to land before the cookie
    // disappears. Anything still pending stays queued for next sign-in.
    await flushOutboxBestEffort();
  }

  try {
    await apiSignOut();
  } catch {
    /* server-side logout best-effort; client state still flips below */
  }

  resetPullState();

  ctx.onAnonymous();
  return { status: choice === 'wipe' ? 'wiped' : 'kept' };
}

async function flushOutboxBestEffort(): Promise<void> {
  // Best-effort: an IndexedDB read failure or push rejection here must
  // never block sign-out. Any unflushed entries stay queued for the
  // next session.
  try {
    const pending = await getPendingEntries();
    if (pending.length === 0) return;
    await Promise.race([
      flushNow().catch(() => {}),
      new Promise<void>((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS)),
    ]);
  } catch {
    /* swallow — see comment above */
  }
}

async function countLocalItems(adapters: SyncAdapters): Promise<number> {
  const [layouts, designs, baseplates] = await Promise.all([
    adapters.layouts.list(),
    adapters.designs.list(),
    adapters.baseplates.list(),
  ]);
  return layouts.length + designs.length + baseplates.length;
}

async function wipeLocal(adapters: SyncAdapters): Promise<void> {
  const [layouts, designs, baseplates] = await Promise.all([
    adapters.layouts.list(),
    adapters.designs.list(),
    adapters.baseplates.list(),
  ]);
  for (const item of layouts) await adapters.layouts.applyRemoteDelete(item.id);
  for (const item of designs) await adapters.designs.applyRemoteDelete(item.id);
  for (const item of baseplates) await adapters.baseplates.applyRemoteDelete(item.id);
}

function isChoice(value: unknown): value is KeepLocalChoice {
  return value === 'keep' || value === 'wipe';
}
