/**
 * Apply a previewed change set as one edit: all of its ops or none, one undo
 * step. `batch()` cannot do this, because a failed command in a batch leaves
 * the earlier ones applied.
 */

import { z } from 'zod';
import { err, isErr, layoutInvalidOperation, ok } from '@/core/result';
import { defineCommand } from '../../defineCommand';
import {
  applyChangeSetEvents,
  changeSetSchema,
  layoutRevision,
  simulateChangeSet,
} from '../../../changeSet';

export const applyChangeSet = defineCommand({
  type: 'layout.applyChangeSet',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: z.object({ changeSet: changeSetSchema }),
  emitted: 'layout.changeSetApplied',
  schemaVersion: 1,
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const { changeSet } = payload;
    if (layoutRevision(ctx.aggregate) !== changeSet.baseRev) {
      return err(
        layoutInvalidOperation(
          'applyChangeSet',
          'The layout changed after the preview. Preview the changes again.'
        )
      );
    }
    const simulated = simulateChangeSet(ctx.aggregate, changeSet);
    if (isErr(simulated)) {
      const { opIndex, op, reason } = simulated.error;
      return err(
        layoutInvalidOperation('applyChangeSet', `Change ${opIndex + 1} (${op}): ${reason}`)
      );
    }
    // The events carry every generated id, so apply and replay need no
    // second simulation.
    return ok({
      value: { refs: simulated.value.refs },
      event: { payload: { summary: changeSet.summary, events: simulated.value.events } },
    });
  },
  apply: (event, draft) => {
    applyChangeSetEvents(draft, event.payload.events);
  },
});
