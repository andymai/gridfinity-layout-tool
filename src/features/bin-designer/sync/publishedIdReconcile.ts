/**
 * Reconcile a loaded design's cached `publishedId` against the community
 * API. Fired (and forgotten) from the store's `loadDesign` so a record that
 * was unpublished, removed, or lost elsewhere self-heals locally instead of
 * the UI claiming a publish that no longer exists.
 */

import { isOk } from '@/core/result';
import { probeCommunityDesign } from '@/core/api/communityClient';
import { getMe } from '@/core/sync/session/sessionApi';
import { useSessionStore } from '@/core/sync/session/useSession';
import type { SavedDesign } from '@/features/bin-designer/types';
import { clearDesignPublishedId } from '@/features/bin-designer/storage/DesignerStorage';

const probed = new Set<string>();

export async function reconcilePublishedId(
  design: Pick<SavedDesign, 'id' | 'publishedId'>
): Promise<void> {
  const { publishedId } = design;
  if (typeof publishedId !== 'string' || publishedId === '') return;
  // A 404 is only definitive from the owner's perspective: the API answers
  // 404 for a hidden-but-recoverable design whenever the caller is not
  // recognized as owner (signed out, expired cookie), and clearing on that
  // would lose the link and mint a duplicate on re-publish.
  if (useSessionStore.getState().status !== 'authenticated') return;
  // Keyed by id + publishedId so a re-publish in the same session probes
  // again while repeat loads of the same design don't.
  const key = `${design.id}:${publishedId}`;
  if (probed.has(key)) return;
  probed.add(key);
  const result = await probeCommunityDesign(publishedId);
  if (!isOk(result)) {
    // Indeterminate (network/5xx): let a later load retry the probe.
    probed.delete(key);
    return;
  }
  if (result.value === 'missing') {
    // The client-side session flag can be stale: with an expired cookie the
    // API 404s a hidden-but-recoverable design too. Only clear when the
    // server confirms the session is live, so the 404 really means gone.
    const sessionLive = await getMe().then(
      (user) => user !== null,
      () => false
    );
    if (!sessionLive) {
      probed.delete(key);
      return;
    }
    await clearDesignPublishedId(design.id);
  }
}

export function __resetPublishedIdReconcileForTests(): void {
  probed.clear();
}
