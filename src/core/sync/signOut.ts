import { signOut as apiSignOut } from './session/sessionApi';
import { flushNow, getPendingEntries } from './engine';
import { clearAll as clearOutbox } from './outbox';
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
 * Best-effort outbox flush before logout: gives in-flight pushes 5s
 * to land. After that the cookie is gone, so any items still pending
 * just stay queued until the next sign-in.
 */
export async function runSignOut(ctx: SignOutContext): Promise<SignOutResult> {
  await flushOutboxBestEffort();

  const localCount = await countLocalItems(ctx.adapters);
  const choice = await ctx.promptKeepLocal({ localCount });
  if (!isChoice(choice)) return { status: 'cancelled' };

  if (choice === 'wipe') {
    await wipeLocal(ctx.adapters);
    await clearOutbox();
    clearLastSignedInUserId();
  }

  try {
    await apiSignOut();
  } catch {
    /* server-side logout best-effort; client state still flips below */
  }

  ctx.onAnonymous();
  return { status: choice === 'wipe' ? 'wiped' : 'kept' };
}

async function flushOutboxBestEffort(): Promise<void> {
  const pending = await getPendingEntries();
  if (pending.length === 0) return;
  await Promise.race([
    flushNow(),
    new Promise<void>((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS)),
  ]);
}

async function countLocalItems(adapters: SyncAdapters): Promise<number> {
  const [layouts, designs] = await Promise.all([adapters.layouts.list(), adapters.designs.list()]);
  return layouts.length + designs.length;
}

async function wipeLocal(adapters: SyncAdapters): Promise<void> {
  const [layouts, designs] = await Promise.all([adapters.layouts.list(), adapters.designs.list()]);
  for (const item of layouts) await adapters.layouts.applyRemoteDelete(item.id);
  for (const item of designs) await adapters.designs.applyRemoteDelete(item.id);
}

function isChoice(value: unknown): value is KeepLocalChoice {
  return value === 'keep' || value === 'wipe';
}
