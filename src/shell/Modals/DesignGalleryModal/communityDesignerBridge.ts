/**
 * Shell-side implementations of the community detail's designer actions
 * (shared/types/communityDetail contract). The shell composes both features,
 * so this is where community requests cross into the bin designer; dynamic
 * imports keep the designer's storage/store graph out of the modal chunk
 * until an action actually runs.
 */

import { isOk } from '@/core/result';
import type { CommunityDesign } from '@/shared/types/community';
import type { CommunityEditOriginalOutcome } from '@/shared/types/communityDetail';

export async function remixCommunityDesign(
  design: CommunityDesign,
  options?: { ownDuplicate?: boolean }
): Promise<boolean> {
  try {
    const { communityToDesign } = await import('@/features/bin-designer/utils/communityToDesign');
    return isOk(await communityToDesign(design, options));
  } catch {
    return false;
  }
}

export async function openPublishForActiveDesign(): Promise<boolean> {
  try {
    const [
      { getActiveDesignId, loadDesign: loadStoredDesign },
      { useDesignerStore },
      { openCommunityPublish },
    ] = await Promise.all([
      import('@/features/bin-designer/storage/DesignerStorage'),
      import('@/features/bin-designer/store/designer'),
      import('@/features/bin-designer/hooks/useCommunityPublish'),
    ]);

    const activeId = getActiveDesignId();
    if (activeId === null) return false;
    const saved = await loadStoredDesign(activeId);
    if (!isOk(saved)) return false;

    // Load into the store here instead of waiting for the designer page:
    // openCommunityPublish reads the live designer state, which may not have
    // loaded the active design yet right after switch-to-designer.
    useDesignerStore.getState().loadDesign(saved.value);
    await openCommunityPublish(null);
    return true;
  } catch {
    return false;
  }
}

export async function editOriginalCommunityDesign(
  // Only the published id is consulted, so Mine cards (which have no full
  // record) can share this path with the detail view's owner action.
  design: Pick<CommunityDesign, 'id'>
): Promise<CommunityEditOriginalOutcome> {
  try {
    const { findLocalDesignByPublishedId } =
      await import('@/features/bin-designer/utils/findLocalDesignByPublishedId');
    const local = await findLocalDesignByPublishedId(design.id);
    if (local === null) return 'missing';

    const [{ setActiveDesignId }, { useDesignerStore }, { openCommunityPublish }] =
      await Promise.all([
        import('@/features/bin-designer/storage/DesignerStorage'),
        import('@/features/bin-designer/store/designer'),
        import('@/features/bin-designer/hooks/useCommunityPublish'),
      ]);

    setActiveDesignId(local.id);
    useDesignerStore.getState().loadDesign(local);
    // Re-derives update mode from the freshly loaded design's own
    // publishedId; no mode is passed anywhere in the dialog-open path.
    await openCommunityPublish(null);
    return 'opened';
  } catch {
    return 'error';
  }
}

/**
 * Best-effort cleanup after an unpublish performed outside the publish
 * dialog (the Mine card action): without it the local design keeps a
 * dangling publishedId and would reopen the publish dialog in update mode
 * against a deleted record.
 */
export async function clearLocalPublishedId(publishedId: string): Promise<void> {
  try {
    const [{ findLocalDesignByPublishedId }, { clearDesignPublishedId }] = await Promise.all([
      import('@/features/bin-designer/utils/findLocalDesignByPublishedId'),
      import('@/features/bin-designer/storage/DesignerStorage'),
    ]);
    const local = await findLocalDesignByPublishedId(publishedId);
    if (local !== null) {
      await clearDesignPublishedId(local.id);
    }
  } catch {
    // The published record is already gone server-side; the reconcile pass
    // (publishedIdReconcile) self-heals any pointer this failed to clear.
  }
}
