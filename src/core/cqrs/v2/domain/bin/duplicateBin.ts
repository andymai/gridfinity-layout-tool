/**
 * Duplicate a bin. handle() runs the placement search (right → below →
 * left → above → staging fallback) and emits the resolved {newBin} so
 * apply() is a deterministic push — replay won't re-run the search
 * against possibly-divergent layout state. Staging-source bins always
 * duplicate to staging at (0, 0).
 */

import { z } from 'zod';
import type { Result, ValidationError, LayoutError } from '@/core/result';
import { ok, err } from '@/core/result';
import { generateBinId, STAGING_ID } from '@/core/constants';
import { canPlaceBin } from '@/shared/utils/validation';
import { layoutInvalidOperation } from '@/core/result';
import { trackBinCreated } from '@/shared/analytics/posthog';
import type { Bin, BinId, GridUnits, LayerId } from '@/core/types';
import { binId as toBinId, gridUnits } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ id: z.string().min(1) });

interface Placement {
  layerId: LayerId;
  x: GridUnits;
  y: GridUnits;
}

/** Try the four cardinal offsets in v1's search order. Returns the first
 * placement that passes canPlaceBin, or null if none fit. */
function findAdjacentPlacement(
  bin: Bin,
  layout: Parameters<typeof canPlaceBin>[2]
): Placement | null {
  const offsets: Array<{ dx: number; dy: number }> = [
    { dx: bin.width, dy: 0 }, // right
    { dx: 0, dy: -(bin.depth as number) }, // below (y decreases visually)
    { dx: -(bin.width as number), dy: 0 }, // left
    { dx: 0, dy: bin.depth }, // above
  ];

  for (const { dx, dy } of offsets) {
    const x = ((bin.x as number) + dx) as GridUnits;
    const y = ((bin.y as number) + dy) as GridUnits;
    const result = canPlaceBin(
      { x, y, width: bin.width, depth: bin.depth, height: bin.height },
      bin.layerId,
      layout
    );
    if (result.valid) return { layerId: bin.layerId, x, y };
  }
  return null;
}

export const duplicateBin = defineCommand({
  type: 'bin.duplicate',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.duplicated',
  schemaVersion: 1,
  descriptionKey: 'undo.action.binDuplicate',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<
    { value: BinId; event: { payload: { sourceId: BinId; newBin: Bin } } },
    ValidationError | LayoutError
  > => {
    const sourceId = toBinId(payload.id);
    const source = ctx.aggregate.bins.find((b) => b.id === sourceId);
    if (!source) {
      return err(layoutInvalidOperation('duplicateBin', `Bin ${sourceId} not found`));
    }

    // Resolve placement: staging bins always copy to staging (0, 0); grid
    // bins try the 4 adjacent slots and fall back to staging if none fit.
    //
    // Note: the staging slot at (0, 0) is NOT validated against existing
    // staging bins — duplicates can silently overlap there. This matches
    // v1's behavior (binActions.duplicateBin via store.addBin, which also
    // skips placement validation for STAGING_ID). Staging is a free-form
    // bucket; callers don't rely on collision-free staging coordinates.
    const placement: Placement =
      source.layerId === STAGING_ID
        ? { layerId: STAGING_ID, x: gridUnits(0), y: gridUnits(0) }
        : (findAdjacentPlacement(source, ctx.aggregate) ?? {
            layerId: STAGING_ID,
            x: gridUnits(0),
            y: gridUnits(0),
          });

    const newBin: Bin = {
      ...source,
      id: generateBinId(),
      layerId: placement.layerId,
      x: placement.x,
      y: placement.y,
    };

    // Mirror v1 behaviour: emit the granular bin-creation analytics event.
    // The cqrs analytics middleware also tracks the command dispatch, but
    // the per-method aggregation (added vs duplicated vs filled) lives in
    // trackBinCreated. Future refinement: move this to a subscriber on
    // bin.duplicated.
    trackBinCreated({
      method: 'duplicate',
      count: 1,
      width: source.width,
      depth: source.depth,
      height: source.height,
    });

    return ok({
      value: newBin.id,
      event: { payload: { sourceId, newBin } },
    });
  },
  apply: (event, draft) => {
    draft.bins.push(event.payload.newBin);
  },
});
