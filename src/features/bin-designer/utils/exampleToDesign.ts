import { saveDesign, setActiveDesignId } from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import type { SavedDesign } from '@/features/bin-designer/types';
import { isOk } from '@/core/result';
import type { Result, StorageError } from '@/core/result';

/**
 * Create a brand-new saved design from a gallery example and make it active.
 * Always a fresh design (no id) — never overwrites current work. `thumbnail:
 * null` lets the existing background regen produce the real thumbnail.
 * `saveDesign` emits a `put` event the custom-bin registry already consumes.
 *
 * `loadDesign` hydrates the LIVE designer store (params + currentDesignId +
 * regen epoch) so an already-mounted designer immediately switches to the new
 * design — `setActiveDesignId` alone only updates the persisted active id and
 * leaves the on-screen designer showing the previous design.
 */
export async function exampleToDesign(
  example: ExampleDesign,
  t: (key: string) => string
): Promise<Result<SavedDesign, StorageError>> {
  const result = await saveDesign({
    name: t(example.nameKey),
    params: example.params,
    thumbnail: null,
    exportFileNameConfig: null,
  });
  if (isOk(result)) {
    setActiveDesignId(result.value.id);
    useDesignerStore.getState().loadDesign(result.value);
  }
  return result;
}
