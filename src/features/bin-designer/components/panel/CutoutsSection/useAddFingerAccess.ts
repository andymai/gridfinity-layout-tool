import { useCallback } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import { useCutoutSelection, useDesignerStore } from '@/features/bin-designer/store';
import { parentGroups } from '@/features/bin-designer/utils/cutoutHierarchy';
import { generateUUID } from '@/shared/utils/uuid';
import { planFingerAccess } from './fingerAccessPlan';
import type { CutoutBoard } from './offBoardCutouts';

/**
 * "Add finger access" for an editor: places the cut beside the pocket and
 * selects it inside the group that binds the two, so its own controls show.
 * The cut is read back from the store, since the editor's cutout list is a
 * render behind the write.
 */
export function useAddFingerAccess(
  cutouts: readonly Cutout[],
  board: CutoutBoard,
  maxCutDepth: number,
  selectIds: (ids: readonly string[], additive: boolean) => void
): (pocketId: string) => void {
  const addFingerAccess = useDesignerStore((s) => s.addFingerAccess);
  return useCallback(
    (pocketId: string) => {
      const pocket = cutouts.find((c) => c.id === pocketId);
      if (!pocket) return;
      const plan = planFingerAccess(pocket, board, maxCutDepth);
      if (!plan) return;
      const id = generateUUID();
      if (!addFingerAccess(pocketId, { ...plan, id })) return;
      const added = useDesignerStore.getState().params.cutouts.find((c) => c.id === id);
      if (!added) return;
      useCutoutSelection.getState().setGroupContext(parentGroups(added));
      selectIds([id], false);
    },
    [cutouts, board, maxCutDepth, addFingerAccess, selectIds]
  );
}
