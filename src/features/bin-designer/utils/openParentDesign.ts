import { isOk } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import type { DesignId } from '@/core/types';
import { getStaticTranslation } from '@/i18n';
import { loadDesign, setActiveDesignId } from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '@/features/bin-designer/store';
import { settleDesignSaves } from '@/features/bin-designer/hooks/designSaveGate';

/**
 * Open the design a variant follows.
 *
 * Every surface that tells the user a value belongs to the parent offers this,
 * because the alternative is telling them where to go and making them find it
 * in the Designs list themselves.
 */
export async function openParentDesign(parentId: DesignId | null): Promise<void> {
  if (!parentId) return;
  // The parent is read after the variant's edits land, like any other switch.
  if (!(await settleDesignSaves())) {
    useToastStore.getState().addToast({
      message: getStaticTranslation('header.saveFailed'),
      type: 'error',
      duration: 4000,
    });
    return;
  }
  const parent = await loadDesign(parentId);
  if (!isOk(parent)) return;
  setActiveDesignId(parentId);
  useDesignerStore.getState().loadDesign(parent.value);
}
