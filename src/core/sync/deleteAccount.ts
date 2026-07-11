import { deleteAccount as apiDeleteAccount } from './session/sessionApi';
import { stop as stopEngine } from './engine';
import { clearAll as clearOutbox } from './outbox';
import { clearLastSignedInUserId } from './claim';
import type { SyncAdapters } from './adapters/types';

export type DeleteAccountConfirmResult = 'confirm' | 'cancel';
export type DeleteAccountConfirmPrompt = (input: {
  localCount: number;
}) => Promise<DeleteAccountConfirmResult>;

interface DeleteAccountContext {
  adapters: SyncAdapters;
  /** UI hook: ConfirmDialog asking the user to confirm the irreversible delete. */
  promptConfirm: DeleteAccountConfirmPrompt;
  /** Called after the server cascade returns; the session store flips to anonymous. */
  onAnonymous: () => void;
}

export type DeleteAccountResult =
  { status: 'deleted' } | { status: 'cancelled' } | { status: 'error'; message: string };

/**
 * Permanently delete the signed-in account. Cloud data (sessions,
 * synced layouts, synced designs, account profile) is removed by the
 * server cascade. Local browser data is intentionally left alone:
 * the user keeps any locally-stored layouts on this device, the
 * same way Sign Out's "Keep" path does. They can clear browser data
 * separately if they want a fully clean slate.
 *
 * Order matters: stop engine + clear outbox BEFORE the server call,
 * so an in-flight push can't race the cascade and re-create state
 * after deletion. clearLastSignedInUserId() runs after, since the
 * userId is permanently gone — silent re-claim has nothing to match.
 */
export async function runDeleteAccount(ctx: DeleteAccountContext): Promise<DeleteAccountResult> {
  const localCount = await countLocalItems(ctx.adapters);
  const choice = await ctx.promptConfirm({ localCount });
  if (choice !== 'confirm') return { status: 'cancelled' };

  stopEngine();
  await clearOutbox();

  try {
    await apiDeleteAccount();
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  clearLastSignedInUserId();
  ctx.onAnonymous();
  return { status: 'deleted' };
}

async function countLocalItems(adapters: SyncAdapters): Promise<number> {
  const [layouts, designs, baseplates] = await Promise.all([
    adapters.layouts.list(),
    adapters.designs.list(),
    adapters.baseplates.list(),
  ]);
  return layouts.length + designs.length + baseplates.length;
}
