import { SHARED_PREVIEW_ID } from '@/core/constants';
import { layoutRevision, simulateChangeSet } from '@/core/cqrs/changeSet';
import type { ChangeSet, SimulatedChangeSet } from '@/core/cqrs/changeSet';
import { isErr } from '@/core/result';
import type { Layout } from '@/core/types';
import { proposeChangesInput } from '@/agent/contract';
import type { ProposeChangesData } from '@/agent/contract';

/**
 * A proposal from propose_changes, run on the reader's open layout: a
 * preview to show, or what the app refused, which goes back to the model
 * without a question to the reader.
 */
export type PreparedChanges =
  | { readonly kind: 'preview'; readonly changeSet: ChangeSet; readonly result: SimulatedChangeSet }
  | { readonly kind: 'refused'; readonly data: ProposeChangesData }
  | { readonly kind: 'unavailable' };

/** The layout that the editor shows, and its id there. */
export interface OpenLayout {
  readonly id: string;
  readonly layout: Layout;
}

function refused(change: number | null, reason: string): PreparedChanges {
  return { kind: 'refused', data: { outcome: 'refused', change, reason: reason.slice(0, 400) } };
}

/**
 * Builds the change set for the open layout, with its id and revision, and
 * runs it with the same checks as a real edit. A shared preview is not the
 * reader's own layout, so it takes no changes.
 */
export function prepareChanges(open: OpenLayout | null, input: unknown): PreparedChanges {
  if (open === null || open.id === SHARED_PREVIEW_ID) return { kind: 'unavailable' };
  const parsed = proposeChangesInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues.at(0);
    const at = issue?.path[0] === 'ops' ? issue.path[1] : undefined;
    return refused(
      typeof at === 'number' ? at + 1 : null,
      issue?.message ?? 'The changes are malformed.'
    );
  }
  const changeSet: ChangeSet = {
    v: 1,
    layoutId: open.id,
    baseRev: layoutRevision(open.layout),
    summary: parsed.data.summary,
    ops: parsed.data.ops,
  };
  const simulated = simulateChangeSet(open.layout, changeSet);
  if (isErr(simulated)) {
    const { opIndex, op, reason } = simulated.error;
    return refused(op === null ? null : opIndex + 1, reason);
  }
  return { kind: 'preview', changeSet, result: simulated.value };
}

/** What goes back to the model once the reader applied the changes. */
export function appliedChanges(refs: Readonly<Record<string, string>>): ProposeChangesData {
  return { outcome: 'applied', added: { ...refs } };
}
