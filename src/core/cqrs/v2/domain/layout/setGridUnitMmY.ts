/**
 * Set (or clear) the depth-axis (Y) grid pitch for a non-square grid.
 * A number clamps to the pitch range; `null` clears back to a square grid
 * (`gridUnitMmY === undefined`). With a custom drawer outline active the
 * floor rises so the mm extent keeps containing the shape, and a clear is
 * refused when the square pitch would not — the outline is absolute mm and
 * nothing may mutate it implicitly. Captures `previousMmY` for undo.
 */

import { z } from 'zod';
import { ok, err, layoutInvalidOperation } from '@/core/result';
import { clamp } from '@/shared/utils/validation';
import { mm } from '@/core/types';
import { GRID_PITCH_MM_MAX, gridPitchFloors } from '@/shared/utils/drawerOutline';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ mm: z.number().nullable() });

export const setGridUnitMmY = defineCommand({
  type: 'layout.setGridUnitMmY',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.gridUnitMmYSet',
  schemaVersion: 1,
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const layout = ctx.aggregate;
    const prev = layout.gridUnitMmY as number | undefined;
    const previousMmY = prev === undefined ? null : prev;
    const floorY = gridPitchFloors(layout).y;
    if (payload.mm === null && (layout.gridUnitMm as number) < floorY) {
      return err(
        layoutInvalidOperation(
          'setGridUnitMmY',
          'clearing the Y pitch would leave the drawer shape outside the grid'
        )
      );
    }
    const newMm: number | null =
      payload.mm === null ? null : clamp(payload.mm, floorY, GRID_PITCH_MM_MAX);
    return ok({
      value: undefined,
      event: { payload: { mm: newMm, previousMmY } },
    });
  },
  apply: (event, draft) => {
    draft.gridUnitMmY = event.payload.mm === null ? undefined : mm(event.payload.mm);
  },
});
