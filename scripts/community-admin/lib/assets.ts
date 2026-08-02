import { deleteBlob } from '../../../api/lib/blobStore.js';
import { readCommunityDesignBlob } from '../../../api/lib/communityStore.js';

/**
 * Delete a community design's public CDN assets (thumbnails + mesh) as part of
 * an admin takedown (hide / denylist sweep).
 *
 * FAIL LOUD: any delete error propagates so the operator retries rather than
 * leaving world-readable blobs live. This is the takedown counterpart to the
 * report auto-hide, which deliberately keeps assets (reversible soft-hide). The
 * record JSON blob itself is intentionally kept so the owner still sees the
 * design in their Mine view and an admin restore brings it back whole; a full
 * `purge` is what removes the record too.
 *
 * A missing record (assets already gone, or a card-hash-only remnant) is a
 * no-op.
 */
export async function purgeCommunityAssets(designId: string): Promise<void> {
  const record = await readCommunityDesignBlob(designId);
  if (!record) return;
  const assetUrls = [...record.thumbnails, record.meshUrl].filter((url) => url !== '');
  for (const url of assetUrls) {
    await deleteBlob(url);
  }
}
