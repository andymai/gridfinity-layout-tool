import { isOk } from '@/core/result';
import type { DesignId } from '@/core/types';
import { loadDesign, setActiveDesignId } from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '@/features/bin-designer/store';

/**
 * Open the design a variant follows.
 *
 * Every surface that tells the user a value belongs to the parent offers this,
 * because the alternative is telling them where to go and making them find it
 * in the Designs list themselves.
 */
export async function openParentDesign(parentId: DesignId | null): Promise<void> {
  if (!parentId) return;
  const parent = await loadDesign(parentId);
  if (!isOk(parent)) return;
  setActiveDesignId(parentId);
  useDesignerStore.getState().loadDesign(parent.value);
}
