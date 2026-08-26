/**
 * Update drawer dims and cascade out-of-bounds bins to staging.
 *
 * Clamping (width/depth in [GRID_MIN, GRID_MAX] and, with a custom outline
 * active, no smaller than the outline's bounding half-unit grid on an axis the
 * recorded measurement does not already hold — a resize must never mutate the
 * user's shape; height >= sum of layer heights)
 * happens in handle() so the event's `changes` always reflects the value
 * that lands. The displaced bin set is also precomputed in handle() and
 * goes into the event as `displacedBinIds`, so apply() applies the drawer
 * change AND the displacement deterministically.
 *
 * `displacedBinIds` is optional on the event type for back-compat with
 * persisted events that predate the field (those carried only the
 * count); replay leaves bin state untouched in that case.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok } from '@/core/result';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { clamp } from '@/shared/utils/math';
import {
  drawerSizeFloors,
  isOutlineFullRectangle,
  GRID_PITCH_MM_MAX,
} from '@/shared/utils/drawerOutline';
import { drawerFrameShiftLimits } from '@/shared/utils/outlineFrame';
import type { BinId, Drawer, GridUnits, MeasuredDrawerMm } from '@/core/types';
import { effectiveGridUnitMmY, gridUnits, heightUnits, mm } from '@/core/types';
import { defineCommand } from '../../defineCommand';
import { computeDisplacedBins } from './displacement';

const measuredMmValue = z
  .number()
  .min(CONSTRAINTS.MEASURED_MM_MIN)
  .max(CONSTRAINTS.MEASURED_MM_MAX);

const payloadSchema = z
  .object({
    width: z.number().min(CONSTRAINTS.GRID_MIN).max(CONSTRAINTS.GRID_MAX),
    depth: z.number().min(CONSTRAINTS.GRID_MIN).max(CONSTRAINTS.GRID_MAX),
    height: z.number().min(0),
    fractionalEdgeX: z.enum(['start', 'end']),
    fractionalEdgeY: z.enum(['start', 'end']),
    // Static bound = half the largest settable pitch (GRID_PITCH_MM_MAX via
    // setGridUnitMm, NOT the smaller GRID_UNIT_MM_MAX); handle() re-clamps to
    // the layout's own `drawerFrameShiftLimits`, which is half a pitch until an
    // oversize perimeter gives the lattice more room than that.
    gridShiftX: z
      .number()
      .min(-GRID_PITCH_MM_MAX / 2)
      .max(GRID_PITCH_MM_MAX / 2),
    gridShiftY: z
      .number()
      .min(-GRID_PITCH_MM_MAX / 2)
      .max(GRID_PITCH_MM_MAX / 2),
    // null clears the stored measurement (same present-key-undefined dance
    // as the outline: apply() deletes it from the draft).
    measuredMm: z
      .object({
        width: measuredMmValue,
        depth: measuredMmValue,
        height: measuredMmValue.optional(),
      })
      .nullable(),
  })
  .partial();

function clampMeasuredMm(measured: MeasuredDrawerMm): MeasuredDrawerMm {
  const clampMm = (v: number): number =>
    clamp(v, CONSTRAINTS.MEASURED_MM_MIN, CONSTRAINTS.MEASURED_MM_MAX);
  return {
    width: clampMm(measured.width),
    depth: clampMm(measured.depth),
    ...(measured.height !== undefined ? { height: clampMm(measured.height) } : {}),
  };
}

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
    const gridUnitMmY = effectiveGridUnitMmY(layout);

    const changes: Partial<Drawer> = {};
    // Resolved before the size floors read it: one command may record a
    // measurement AND resize, and the floor the resize lands against is the
    // one that lands with it (the same POST-change discipline the
    // displacement below runs on).
    if (payload.measuredMm !== undefined) {
      changes.measuredMm =
        payload.measuredMm === null ? undefined : clampMeasuredMm(payload.measuredMm);
    }

    // Resolve clamped/derived values up-front so the event records
    // exactly what apply() will install. With a custom outline active the
    // shrink floor rises to the outline's bounding half-unit grid on any axis
    // whose recorded measurement does not already hold the shape: the shape is
    // user-authored and a resize must never crop or extend it — to go smaller
    // there, the user edits the shape (or records the drawer) first.
    const floors = drawerSizeFloors(
      {
        outline: drawer.outline,
        measuredMm: 'measuredMm' in changes ? changes.measuredMm : drawer.measuredMm,
      },
      layout.gridUnitMm,
      gridUnitMmY
    );
    if (payload.width !== undefined) {
      changes.width = gridUnits(clamp(payload.width, floors.width, CONSTRAINTS.GRID_MAX));
    }
    if (payload.depth !== undefined) {
      changes.depth = gridUnits(clamp(payload.depth, floors.depth, CONSTRAINTS.GRID_MAX));
    }
    if (payload.height !== undefined) {
      const totalLayerHeight = layout.layers.reduce((sum, l) => sum + (l.height as number), 0);
      changes.height = heightUnits(Math.max(totalLayerHeight, payload.height));
    }
    if (payload.fractionalEdgeX !== undefined) changes.fractionalEdgeX = payload.fractionalEdgeX;
    if (payload.fractionalEdgeY !== undefined) changes.fractionalEdgeY = payload.fractionalEdgeY;
    // Zero offset is stored as an absent key (same dance as outline /
    // measuredMm) so untouched layouts stay byte-identical.
    // Bounded by the frame's own limit, not a flat half pitch: an oversize
    // perimeter gives the lattice real room to slide, and half a pitch cannot
    // reach the edges of a drawer whose slack exceeds one cell. Resolved
    // POST-change (the same discipline the size floors above run on) so a
    // resize landing with the shift is bounded by the size it lands against.
    if (payload.gridShiftX !== undefined || payload.gridShiftY !== undefined) {
      const limits = drawerFrameShiftLimits(
        {
          ...drawer,
          width: changes.width ?? drawer.width,
          depth: changes.depth ?? drawer.depth,
        },
        layout.baseplateParams,
        layout.gridUnitMm,
        gridUnitMmY
      );
      if (payload.gridShiftX !== undefined) {
        const v = clamp(payload.gridShiftX, -limits.x, limits.x);
        changes.gridShiftX = v === 0 ? undefined : mm(v);
      }
      if (payload.gridShiftY !== undefined) {
        const v = clamp(payload.gridShiftY, -limits.y, limits.y);
        changes.gridShiftY = v === 0 ? undefined : mm(v);
      }
    }

    const newWidth: GridUnits = changes.width ?? drawer.width;
    const newDepth: GridUnits = changes.depth ?? drawer.depth;

    // The shape never changes on resize (see the clamp above) — but a shrink
    // can land exactly on the outline's bounding rectangle, and a
    // rectangle-equivalent outline is stored as "no outline" everywhere else
    // (setOutline, read-side normalize). Normalize here too, or the layout
    // keeps a redundant "shaped" flag that flips behaviour on the next load.
    const outlineBecameRectangle =
      drawer.outline !== undefined &&
      (newWidth !== drawer.width || newDepth !== drawer.depth) &&
      isOutlineFullRectangle(drawer.outline, newWidth * layout.gridUnitMm, newDepth * gridUnitMmY);
    if (outlineBecameRectangle) changes.outline = undefined;

    // Displacement runs against the POST-change frame: fractional-edge and
    // grid-shift updates move the registered frame, so they displace exactly
    // like a resize does.
    const displacedBinIds = computeDisplacedBins(
      layout.bins,
      {
        width: newWidth,
        depth: newDepth,
        outline: outlineBecameRectangle ? undefined : drawer.outline,
        fractionalEdgeX: changes.fractionalEdgeX ?? drawer.fractionalEdgeX,
        fractionalEdgeY: changes.fractionalEdgeY ?? drawer.fractionalEdgeY,
        gridShiftX: 'gridShiftX' in changes ? changes.gridShiftX : drawer.gridShiftX,
        gridShiftY: 'gridShiftY' in changes ? changes.gridShiftY : drawer.gridShiftY,
      },
      layout.baseplateParams,
      layout.gridUnitMm,
      gridUnitMmY
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
    if ('measuredMm' in event.payload.changes && event.payload.changes.measuredMm === undefined) {
      delete draft.drawer.measuredMm;
    }
    if ('gridShiftX' in event.payload.changes && event.payload.changes.gridShiftX === undefined) {
      delete draft.drawer.gridShiftX;
    }
    if ('gridShiftY' in event.payload.changes && event.payload.changes.gridShiftY === undefined) {
      delete draft.drawer.gridShiftY;
    }
    if (event.payload.displacedBinIds.length > 0) {
      const idSet = new Set(event.payload.displacedBinIds);
      for (const bin of draft.bins) {
        if (idSet.has(bin.id)) bin.layerId = STAGING_ID;
      }
    }
  },
});
