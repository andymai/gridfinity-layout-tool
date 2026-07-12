/**
 * Update drawer dims and cascade out-of-bounds bins to staging.
 *
 * Clamping (width/depth in [GRID_MIN, GRID_MAX], height >= sum of layer
 * heights) happens in handle() so the event's `changes` always reflects
 * the value that lands. The displaced bin set is also precomputed in
 * handle() and goes into the event as `displacedBinIds`, so apply()
 * applies the drawer change AND the displacement deterministically.
 *
 * `displacedBinIds` is optional on the event type for back-compat with
 * persisted events that predate the field (those carried only the
 * count); replay leaves bin state untouched in that case.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok } from '@/core/result';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { clamp } from '@/shared/utils/validation';
import { resizeDrawerOutline } from '@/shared/utils/drawerOutline';
import type { BinId, Drawer, GridUnits } from '@/core/types';
import { gridUnits, heightUnits } from '@/core/types';
import { defineCommand } from '../../defineCommand';
import { computeDisplacedBins } from './displacement';

const payloadSchema = z
  .object({
    width: z.number().min(CONSTRAINTS.GRID_MIN).max(CONSTRAINTS.GRID_MAX),
    depth: z.number().min(CONSTRAINTS.GRID_MIN).max(CONSTRAINTS.GRID_MAX),
    height: z.number().min(0),
    fractionalEdgeX: z.enum(['start', 'end']),
    fractionalEdgeY: z.enum(['start', 'end']),
  })
  .partial();

function capturePrevious(drawer: Drawer, changes: Partial<Drawer>): Partial<Drawer> {
  const previous: Partial<Drawer> = {};
  for (const key of Object.keys(changes) as Array<keyof Drawer>) {
    (previous as Record<string, unknown>)[key as string] = drawer[key];
  }
  return previous;
}

export const updateDrawer = defineCommand({
  type: 'drawer.update',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'drawer.updated',
  schemaVersion: 1,
  descriptionKey: 'undo.action.drawerUpdate',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<
    {
      value: undefined;
      event: {
        payload: {
          changes: Partial<Drawer>;
          previous: Partial<Drawer>;
          binsDisplacedToStaging: number;
          displacedBinIds: ReadonlyArray<BinId>;
        };
      };
    },
    LayoutError
  > => {
    const layout = ctx.aggregate;
    const drawer = layout.drawer;

    // Resolve clamped/derived values up-front so the event records
    // exactly what apply() will install.
    const changes: Partial<Drawer> = {};
    if (payload.width !== undefined) {
      changes.width = gridUnits(clamp(payload.width, CONSTRAINTS.GRID_MIN, CONSTRAINTS.GRID_MAX));
    }
    if (payload.depth !== undefined) {
      changes.depth = gridUnits(clamp(payload.depth, CONSTRAINTS.GRID_MIN, CONSTRAINTS.GRID_MAX));
    }
    if (payload.height !== undefined) {
      const totalLayerHeight = layout.layers.reduce((sum, l) => sum + (l.height as number), 0);
      changes.height = heightUnits(Math.max(totalLayerHeight, payload.height));
    }
    if (payload.fractionalEdgeX !== undefined) changes.fractionalEdgeX = payload.fractionalEdgeX;
    if (payload.fractionalEdgeY !== undefined) changes.fractionalEdgeY = payload.fractionalEdgeY;

    const newWidth: GridUnits = changes.width ?? drawer.width;
    const newDepth: GridUnits = changes.depth ?? drawer.depth;

    // A resize adapts the outline (cropped where the drawer shrank, extended
    // where it grew); a degenerate result falls back to the full rectangle.
    // The derived change rides in the event so replay stays deterministic.
    const dimsChanged = newWidth !== drawer.width || newDepth !== drawer.depth;
    let newOutline = drawer.outline;
    if (drawer.outline !== undefined && dimsChanged) {
      const u = layout.gridUnitMm as number;
      newOutline = resizeDrawerOutline(
        drawer.outline,
        (drawer.width as number) * u,
        (drawer.depth as number) * u,
        (newWidth as number) * u,
        (newDepth as number) * u,
        u
      );
      changes.outline = newOutline;
    }

    // Displacement against the post-update drawer (dims AND adapted outline).
    const displacedBinIds = computeDisplacedBins(
      layout.bins,
      { width: newWidth, depth: newDepth, outline: newOutline },
      layout.gridUnitMm
    );

    const previous = capturePrevious(drawer, changes);

    return ok({
      value: undefined,
      event: {
        payload: {
          changes,
          previous,
          binsDisplacedToStaging: displacedBinIds.length,
          displacedBinIds,
        },
      },
    });
  },
  apply: (event, draft) => {
    Object.assign(draft.drawer, event.payload.changes);
    // Object.assign keeps an explicitly-undefined outline as a present key;
    // reset-to-rectangle must delete it so downstream `!== undefined` guards
    // and serialization see a truly absent field.
    if ('outline' in event.payload.changes && event.payload.changes.outline === undefined) {
      delete draft.drawer.outline;
    }
    if (event.payload.displacedBinIds.length > 0) {
      const idSet = new Set(event.payload.displacedBinIds);
      for (const bin of draft.bins) {
        if (idSet.has(bin.id)) bin.layerId = STAGING_ID;
      }
    }
  },
});
