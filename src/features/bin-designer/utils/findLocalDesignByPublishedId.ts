import { listDesigns } from '@/features/bin-designer/storage/DesignerStorage';
import type { SavedDesign } from '@/features/bin-designer/types';
import { isOk } from '@/core/result';

/**
 * Locate the local design that produced a published community record. No
 * publishedId index exists in storage, so this is a linear scan over
 * listDesigns(): the same order of magnitude the design-list dialog already
 * loads. Null when no local copy carries the id (cross-device, or deleted
 * locally), which callers treat as the duplicate-as-new fallback.
 */
export async function findLocalDesignByPublishedId(
  publishedId: string
): Promise<SavedDesign | null> {
  const result = await listDesigns();
  if (!isOk(result)) return null;
  return result.value.find((design) => design.publishedId === publishedId) ?? null;
}
