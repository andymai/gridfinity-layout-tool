/**
 * Group and Ungroup resolved at the level the editor has been drilled into.
 *
 * The sidebar editor and the full-screen workspace share one canvas and one
 * drill-in context, so they share the actions that read it: wiring the raw
 * store actions into either would group at the top level and flat-ungroup a
 * nested selection.
 *
 * Also keeps the context honest — see {@link useGroupLevel} — because the level
 * outlives the editor that entered it.
 */

import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Cutout, GroupOp } from '@/features/bin-designer/types';
import { useCutoutSelection, useDesignerStore } from '@/features/bin-designer/store';
import { isWithin, unitTagGroupId, unitTags } from '@/features/bin-designer/utils/cutoutHierarchy';

export interface GroupLevelOptions {
  readonly cutouts: readonly Cutout[];
  /**
   * Collapse a multi-group Ungroup into one undo step. Omitted, each group
   * peeled lands its own step.
   */
  readonly transaction?: { readonly start: () => void; readonly commit: () => void };
}

export interface GroupLevel {
  /** Groups the editor is inside, outermost first; `[]` at the top level. */
  readonly groupContext: readonly string[];
  readonly handleGroup: (ids: readonly string[], op?: GroupOp) => void;
  readonly handleUngroup: (ids: readonly string[]) => void;
}

export function useGroupLevel({ cutouts, transaction }: GroupLevelOptions): GroupLevel {
  const groupContext = useCutoutSelection((state) => state.groupContext);
  const { groupCutouts, ungroupCutouts, peelGroup } = useDesignerStore(
    useShallow((s) => ({
      groupCutouts: s.groupCutouts,
      ungroupCutouts: s.ungroupCutouts,
      peelGroup: s.peelGroup,
    }))
  );
  const startTransaction = transaction?.start;
  const commitTransaction = transaction?.commit;

  /**
   * `op` must be forwarded: the Pathfinder buttons share this handler, and
   * swallowing their op turns Subtract/Intersect/Exclude into four Union
   * buttons — a silent geometry difference with nothing on screen to show it.
   */
  const handleGroup = useCallback(
    (ids: readonly string[], op?: GroupOp) => {
      groupCutouts(ids, op, useCutoutSelection.getState().groupContext);
    },
    [groupCutouts]
  );

  /**
   * Ungroup peels ONE level: the groups the selection resolves to at the
   * current depth dissolve, and anything nested inside them survives as its own
   * row. Flattening the whole subtree instead would silently destroy boolean
   * groups the user spent effort building.
   *
   * With nothing grouped at this level — a selection already drilled down to
   * bare shapes — it falls back to pulling those shapes out of their own
   * boolean group, which is what Ungroup meant before nesting.
   */
  const handleUngroup = useCallback(
    (ids: readonly string[]) => {
      const context = useCutoutSelection.getState().groupContext;
      const selected = cutouts.filter((c) => ids.includes(c.id));
      const groups = [...unitTags(selected, context)]
        .map(unitTagGroupId)
        .filter((id): id is string => id !== null);
      if (groups.length === 0) {
        ungroupCutouts(ids);
        return;
      }
      // One undo step however many sibling groups the selection spans.
      startTransaction?.();
      for (const groupId of groups) peelGroup(groupId);
      commitTransaction?.();
    },
    [cutouts, ungroupCutouts, peelGroup, startTransaction, commitTransaction]
  );

  // Undo, a delete, or switching between the bin and the lid can leave the
  // editor drilled into a group that no longer exists, and the context lives in
  // a module-global store that outlives any one editor. Left stale, `unitTag`
  // answers null for everything and every arrange button silently no-ops.
  useEffect(() => {
    const { groupContext: live, setGroupContext } = useCutoutSelection.getState();
    if (live.length === 0) return;
    // Tested as a PATH, not as a set of surviving ids: moving a group to a
    // different parent leaves its id present while the prefix that reached it
    // no longer describes anything, and `isWithin` would then answer false for
    // every cutout — the same silent no-op as a deleted group.
    let keep = live.length;
    while (keep > 0 && !cutouts.some((c) => isWithin(c, live.slice(0, keep)))) keep--;
    if (keep !== live.length) setGroupContext(live.slice(0, keep));
  }, [cutouts]);

  return { groupContext, handleGroup, handleUngroup };
}
