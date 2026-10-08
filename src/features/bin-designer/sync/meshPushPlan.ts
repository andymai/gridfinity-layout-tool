import type { PushPlan, SyncableItem } from '@/core/sync/adapters/types';
import { uploadMeshFiles } from '@/shared/generation/meshCloud';
import { holderMeshHashes } from '@/shared/generation/meshRefs';
import type { MeshHolder } from '@/shared/generation/meshRefs';
import type { MissingMeshPushes } from './missingMeshPushes';

const SKIP = { status: 'skip' } as const;

/**
 * Push `item`, refs and all, once the account holds every mesh file `holder`
 * names. A server without a mesh store is sent `inline()`, every mesh inline;
 * one that will not take some files gets those inline and the rest as refs.
 * A file on neither the server nor this device holds the push until it arrives,
 * so the server's copy keeps its mesh.
 */
export async function planMeshPush<T>(
  item: SyncableItem<T>,
  holder: MeshHolder,
  inline: (only?: ReadonlySet<string>) => Promise<SyncableItem<T> | null>,
  waits: MissingMeshPushes,
  session: number
): Promise<PushPlan<T>> {
  const upload = await uploadMeshFiles(holderMeshHashes(holder), session);
  if (upload.status === 'held') return { status: 'send', item };
  if (upload.status === 'failed') return { status: 'defer', reason: upload.reason };
  if (upload.status === 'throttled') {
    return { status: 'throttle', retryAfterMs: upload.retryAfterMs };
  }
  if (upload.status === 'missing') {
    waits.skip(upload.hash, item.id);
    return SKIP;
  }
  const inlined = await inline(upload.status === 'refused' ? new Set(upload.hashes) : undefined);
  return inlined ? { status: 'send', item: inlined } : SKIP;
}
