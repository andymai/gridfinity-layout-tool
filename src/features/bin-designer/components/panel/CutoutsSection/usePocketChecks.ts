import { useCallback, useMemo } from 'react';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { useCutoutSelection } from '@/features/bin-designer/store';
import { groupChain, sameChain } from '@/features/bin-designer/utils/cutoutHierarchy';
import { checkPockets, type PocketIssue } from './pocketChecks';
import type { CutoutBoard } from './offBoardCutouts';
import type { PocketChecksView } from './PocketIssueList';

export interface PocketChecks {
  /** Undefined when nothing needs a warning. */
  readonly view: PocketChecksView | undefined;
  readonly issueInstanceIds: ReadonlySet<string>;
}

/**
 * The pocket checks for an editor, and what acting on one does: selecting an
 * issue selects the shapes it names, inside their group when they share one so
 * the shapes themselves are picked rather than the group around them.
 */
export function usePocketChecks(
  cutouts: readonly Cutout[],
  params: BinParams,
  board: CutoutBoard,
  enabled: boolean,
  selectIds: (ids: readonly string[], additive: boolean) => void,
  onUpdate: (id: string, patch: Partial<Cutout>) => void
): PocketChecks {
  const issues = useMemo(
    () => (enabled ? checkPockets(cutouts, params, board) : []),
    [enabled, cutouts, params, board]
  );
  const issueInstanceIds = useMemo(
    () => new Set(issues.flatMap((issue) => issue.instanceIds)),
    [issues]
  );
  const onSelect = useCallback(
    (ids: readonly string[]) => {
      const chains = ids.flatMap((id) => {
        const c = cutouts.find((cutout) => cutout.id === id);
        return c ? [groupChain(c)] : [];
      });
      const first = chains.at(0) ?? [];
      useCutoutSelection
        .getState()
        .setGroupContext(chains.every((chain) => sameChain(chain, first)) ? first : []);
      selectIds(ids, false);
    },
    [cutouts, selectIds]
  );
  const onFix = useCallback(
    (issue: PocketIssue) => {
      if (issue.fix) onUpdate(issue.ids[0], issue.fix);
    },
    [onUpdate]
  );
  const view = useMemo(
    () => (issues.length > 0 ? { issues, cutouts, onSelect, onFix } : undefined),
    [issues, cutouts, onSelect, onFix]
  );
  return { view, issueInstanceIds };
}
