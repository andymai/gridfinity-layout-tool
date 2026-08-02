import { saveDesign, setActiveDesignId } from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { SavedDesign } from '@/features/bin-designer/types';
import { remixHintId } from '@/features/bin-designer/utils/remixHintId';
import { isOk } from '@/core/result';
import type { Result, StorageError } from '@/core/result';
import { useSettingsStore } from '@/core/store';
import type { CommunityDesign, CommunityDesignLineage } from '@/shared/types/community';

/**
 * Mirrors the server's resolveLineage (api/community.ts): the fetched record
 * IS the parent, so its own name/author are the parent snapshots and its
 * lineage (when itself a remix) supplies the root chain.
 */
export function lineageFromParent(design: CommunityDesign): CommunityDesignLineage {
  return {
    parentId: design.id,
    rootId: design.lineage?.rootId ?? design.id,
    parentName: design.name,
    parentAuthorName: design.authorName,
    rootAuthorName: design.lineage?.rootAuthorName ?? design.authorName,
  };
}

/**
 * Create a brand-new saved design from a published community design (Remix /
 * Duplicate as new) and make it active. Always a fresh design with lineage
 * recorded and no publishedId: a remix is never implicitly linked to its
 * parent's community record. Not merged with exampleToDesign, which never
 * sets lineage and resolves its name through an i18n key rather than the
 * free-form community name.
 */
export async function communityToDesign(
  design: CommunityDesign,
  options?: { ownDuplicate?: boolean }
): Promise<Result<SavedDesign, StorageError>> {
  const result = await saveDesign({
    name: design.name,
    params: design.params,
    thumbnail: null,
    exportFileNameConfig: null,
    lineage: lineageFromParent(design),
  });
  if (isOk(result)) {
    if (options?.ownDuplicate === true) {
      // Owner duplicating their own published design: lineage is still
      // recorded for provenance, but the remix banner would misread as
      // "Remixing {their design} by {them}", so pre-dismiss it.
      const { settings, updateSettings } = useSettingsStore.getState();
      updateSettings({
        dismissedHints: [...settings.dismissedHints, remixHintId(result.value.id)],
      });
    }
    setActiveDesignId(result.value.id);
    useDesignerStore.getState().loadDesign(result.value);
  }
  return result;
}
