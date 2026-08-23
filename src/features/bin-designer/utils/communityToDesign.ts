import { saveDesign, setActiveDesignId } from '@/features/bin-designer/storage/DesignerStorage';
import { assemblyDescriptor } from '@/shared/items/assembly/descriptor';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { SavedDesign } from '@/features/bin-designer/types';
import { remixHintId } from '@/features/bin-designer/utils/remixHintId';
import { isOk } from '@/core/result';
import type { Result, StorageError } from '@/core/result';
import { useSettingsStore } from '@/core/store';
import { recordCommunityOpen } from '@/shared/api/communityAttribution';
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
    ...(design.kind === 'assembly' && design.envelope && design.structure
      ? {
          kind: 'assembly' as const,
          envelope: design.envelope,
          // Migration is the trust boundary for remote structures, exactly as
          // in the sync adapter — the server validated shape, this clamps.
          structure: assemblyDescriptor.migrate(design.structure, design.envelope),
        }
      : { params: design.params }),
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
    if (options?.ownDuplicate !== true) {
      // Owner-only "opens" stat (plan §2.4): a genuine remix open counts, an
      // owner duplicating their own design does not. Fire-and-forget.
      void recordCommunityOpen(design.id);
    }
  }
  return result;
}
