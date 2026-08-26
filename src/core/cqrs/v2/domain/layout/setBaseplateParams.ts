/**
 * Set baseplate params. handle() clamps padding (≥ 0), magnet diameter
 * ([0.5, 20] mm), magnet depth ([0.5, 10] mm), and optional baseplate
 * grid dims ([0.5, 50]). The normalized object goes into the event
 * alongside `previousParams` for undo.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { clamp } from '@/shared/utils/math';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { SOLID_FLOOR_MIN_MM, SOLID_FLOOR_MAX_MM } from '@/core/baseplateDefaults';
import type { StoredBaseplateParams, GridUnits, Mm } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import { BASEPLATE_CONNECTOR_STYLES } from '@/shared/types/bin';
import { defineCommand } from '../../defineCommand';
import { computeDisplacedBins } from '../drawer/displacement';

/**
 * Chunk sizes for one axis of a custom split plan. A plate caps at
 * GRID_MAX units and a chunk is at least a half unit, so twice GRID_MAX covers
 * every legal plan while bounding what a crafted payload can ask for.
 */
const splitChunkSizes = z
  .array(z.number().min(0.5).max(CONSTRAINTS.GRID_MAX))
  .min(1)
  .max(CONSTRAINTS.GRID_MAX * 2);

// StoredBaseplateParams has many fields, most optional; the schema is permissive
// (passes shape through). Validation focuses on the required boolean +
// numeric fields v1 always supplies.
const payloadSchema = z.object({
  params: z.object({
    magnetHoles: z.boolean(),
    magnetDiameter: z.number(),
    magnetDepth: z.number(),
    paddingLeft: z.number(),
    paddingRight: z.number(),
    paddingFront: z.number(),
    paddingBack: z.number(),
    paddingAnchor: z
      .enum(['tl', 'tc', 'tr', 'ml', 'c', 'mr', 'bl', 'bc', 'br', 'custom'])
      .optional(),
    wholeCellsOnly: z.boolean().optional(),
    connectorNubs: z.boolean().optional(),
    connectorStyle: z.enum(BASEPLATE_CONNECTOR_STYLES).optional(),
    lightweight: z.boolean().optional(),
    solidFloor: z.boolean().optional(),
    solidFloorThickness: z.number().optional(),
    syncWithLayout: z.boolean().optional(),
    baseplateWidth: z.number().optional(),
    baseplateDepth: z.number().optional(),
    invertDovetails: z.boolean().optional(),
    fractionalEdgeX: z.enum(['start', 'end']).optional(),
    fractionalEdgeY: z.enum(['start', 'end']).optional(),
    cornerRadius: z.number().optional(),
    cornerRadii: z
      .object({
        tl: z.number(),
        tr: z.number(),
        bl: z.number(),
        br: z.number(),
      })
      .optional(),
    // Bounds only. Whether the plan still describes the plate is decided at
    // resolve time by `normalizeSplitOverride`, which knows the dimensions.
    // Both length and value are capped: an unbounded plan would bloat the
    // stored layout and, since `splitOverride` is a generation trigger, ask the
    // worker to build a piece per entry.
    splitOverride: z.object({ cols: splitChunkSizes, rows: splitChunkSizes }).optional(),
  }),
});

export const setBaseplateParams = defineCommand({
  type: 'layout.setBaseplateParams',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.baseplateParamsSet',
  schemaVersion: 1,
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const previousParams = ctx.aggregate.baseplateParams
      ? { ...ctx.aggregate.baseplateParams }
      : undefined;

    const p = payload.params;
    const params: StoredBaseplateParams = {
      ...p,
      paddingLeft: Math.max(0, p.paddingLeft) as Mm,
      paddingRight: Math.max(0, p.paddingRight) as Mm,
      paddingFront: Math.max(0, p.paddingFront) as Mm,
      paddingBack: Math.max(0, p.paddingBack) as Mm,
      magnetDiameter: clamp(p.magnetDiameter, 0.5, 20) as Mm,
      magnetDepth: clamp(p.magnetDepth, 0.5, 10) as Mm,
      ...(p.solidFloorThickness !== undefined
        ? {
            solidFloorThickness: clamp(
              p.solidFloorThickness,
              SOLID_FLOOR_MIN_MM,
              SOLID_FLOOR_MAX_MM
            ) as Mm,
          }
        : {}),
      ...(p.baseplateWidth !== undefined
        ? { baseplateWidth: clamp(p.baseplateWidth, 0.5, 50) as GridUnits }
        : {}),
      ...(p.baseplateDepth !== undefined
        ? { baseplateDepth: clamp(p.baseplateDepth, 0.5, 50) as GridUnits }
        : {}),
    } as StoredBaseplateParams;

    // Padding (and sync mode) participates in the grid↔perimeter frame
    //: recompute displacement against the NEW params so bins whose
    // sockets the re-based plate loses move to staging, undoably, exactly
    // like a resize. A rectangle drawer has no frame, so this is a no-op.
    const layout = ctx.aggregate;
    const displacedBinIds =
      layout.drawer.outline !== undefined
        ? computeDisplacedBins(
            layout.bins,
            layout.drawer,
            params,
            layout.gridUnitMm,
            effectiveGridUnitMmY(layout)
          )
        : [];

    return ok({
      value: undefined,
      event: { payload: { params, previousParams, displacedBinIds } },
    });
  },
  apply: (event, draft) => {
    draft.baseplateParams = event.payload.params;
    const displaced = event.payload.displacedBinIds ?? [];
    if (displaced.length > 0) {
      const idSet = new Set(displaced);
      for (const bin of draft.bins) {
        if (idSet.has(bin.id)) bin.layerId = STAGING_ID;
      }
    }
  },
});
