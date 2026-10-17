/**
 * Reorder layers. Validates indices and checks the restacked layout against
 * the drawer and clearance limits before emitting; apply() does the splice on the
 * draft. Self-move (`fromIndex === toIndex`) succeeds and emits but
 * apply() short-circuits — the event in the audit log records that the
 * user attempted a reorder.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutInvalidOperation } from '@/core/result';
import { getRestingStack, newViolations, resolveRestingStack } from '@/shared/utils/restingStack';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  fromIndex: z.number().int().min(0),
  toIndex: z.number().int().min(0),
});

export const reorderLayers = defineCommand({
  type: 'layer.reorder',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layer.reordered',
  schemaVersion: 1,
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<
    { value: undefined; event: { payload: { fromIndex: number; toIndex: number } } },
    LayoutError
  > => {
    const { fromIndex, toIndex } = payload;
    const layout = ctx.aggregate;

    if (fromIndex === toIndex) {
      return ok({ value: undefined, event: { payload: { fromIndex, toIndex } } });
    }
    if (fromIndex < 0 || fromIndex >= layout.layers.length) {
      return err(layoutInvalidOperation('reorderLayers', 'Invalid source index'));
    }
    if (toIndex < 0 || toIndex >= layout.layers.length) {
      return err(layoutInvalidOperation('reorderLayers', 'Invalid target index'));
    }

    const newLayers = [...layout.layers];
    const [moved] = newLayers.splice(fromIndex, 1);
    newLayers.splice(toIndex, 0, moved);

    const violations = newViolations(
      getRestingStack(layout.bins, layout.layers),
      resolveRestingStack(layout.bins, newLayers),
      layout.drawer.height
    );
    if (violations.length > 0) {
      return err(
        layoutInvalidOperation(
          'reorderLayers',
          violations[0].kind === 'exceeds_height'
            ? 'Reordering would stack bins past the drawer top'
            : "Reordering would rest a bin inside another bin's clearance"
        )
      );
    }

    return ok({ value: undefined, event: { payload: { fromIndex, toIndex } } });
  },
  apply: (event, draft) => {
    const { fromIndex, toIndex } = event.payload;
    if (fromIndex === toIndex) return;
    const [moved] = draft.layers.splice(fromIndex, 1);
    draft.layers.splice(toIndex, 0, moved);
  },
});
