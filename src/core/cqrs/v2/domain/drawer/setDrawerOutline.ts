/**
 * drawer.setOutline — set or clear the drawer's non-rectangular boundary
 *. The single write path for every shape-authoring surface
 * (cell paint, bin-footprint trace, corner cuts, pen editor).
 *
 * `handle()` validates the outline against the current drawer extent,
 * normalizes rectangle-equivalent shapes to "no outline", and precomputes the
 * displacement set (bins whose footprint falls outside the new shape move to
 * staging) so `apply()` and replay stay deterministic.
 */

import * as z from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutInvalidOperation } from '@/core/result';
import type { BinId, DrawerOutline } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import {
  outlineExtentMm,
  quantizeOutline,
  snapOutlineToBounds,
  validateOutline,
} from '@/shared/utils/drawerOutline';
import { defineCommand } from '../../defineCommand';
import { computeDisplacedBins } from './displacement';
import { drawerOutlineSchema } from '../../../validation/outlineSchema';

const payloadSchema = z.object({
  outline: drawerOutlineSchema.nullable(),
});

/** True when the outline traces the full rectangle (every segment straight
 * and hugging a boundary line) — stored as "no outline". */
function isRectangleEquivalent(outline: DrawerOutline, widthMm: number, depthMm: number): boolean {
  const eps = 0.05;
  const n = outline.vertices.length;
  for (let i = 0; i < n; i++) {
    const a = outline.vertices[i];
    const b = outline.vertices[(i + 1) % n];
    if (Math.abs(a.bulge ?? 0) >= 1e-9) return false;
    const onCommonLine =
      (Math.abs(a.x) <= eps && Math.abs(b.x) <= eps) ||
      (Math.abs(a.x - widthMm) <= eps && Math.abs(b.x - widthMm) <= eps) ||
      (Math.abs(a.y) <= eps && Math.abs(b.y) <= eps) ||
      (Math.abs(a.y - depthMm) <= eps && Math.abs(b.y - depthMm) <= eps);
    if (!onCommonLine) return false;
  }
  return true;
}

export const setDrawerOutline = defineCommand({
  type: 'drawer.setOutline',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'drawer.outlineSet',
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
          outline: DrawerOutline | undefined;
          previousOutline: DrawerOutline | undefined;
          binsDisplacedToStaging: number;
          displacedBinIds: ReadonlyArray<BinId>;
        };
      };
    },
    LayoutError
  > => {
    const layout = ctx.aggregate;
    const drawer = layout.drawer;
    const gridUnitMmY = effectiveGridUnitMmY(layout) as number;
    // The perimeter traces the DRAWER, so that is what bounds it; the grid is a
    // lattice inside it that the user may make smaller. "Hugs the boundary" and
    // "is the full rectangle" stay grid questions — a rectangle at the drawer's
    // size on a smaller grid trims cells rather than meaning "no outline".
    const gridWidthMm = (drawer.width as number) * (layout.gridUnitMm as number);
    const gridDepthMm = (drawer.depth as number) * gridUnitMmY;
    const { widthMm, depthMm } = outlineExtentMm(drawer, layout.gridUnitMm, gridUnitMmY);

    let outline: DrawerOutline | undefined;
    if (payload.outline !== null) {
      const cleaned = snapOutlineToBounds(
        quantizeOutline(payload.outline),
        gridWidthMm,
        gridDepthMm
      );
      const invalid = validateOutline(cleaned, widthMm, depthMm, layout.gridUnitMm, gridUnitMmY);
      if (invalid !== null) {
        return err(layoutInvalidOperation('setDrawerOutline', invalid.message));
      }
      outline = isRectangleEquivalent(cleaned, gridWidthMm, gridDepthMm) ? undefined : cleaned;
    }

    const displacedBinIds = computeDisplacedBins(
      layout.bins,
      {
        width: drawer.width,
        depth: drawer.depth,
        outline,
        fractionalEdgeX: drawer.fractionalEdgeX,
        fractionalEdgeY: drawer.fractionalEdgeY,
        gridShiftX: drawer.gridShiftX,
        gridShiftY: drawer.gridShiftY,
      },
      layout.baseplateParams,
      layout.gridUnitMm,
      gridUnitMmY
    );

    return ok({
      value: undefined,
      event: {
        payload: {
          outline,
          previousOutline: drawer.outline,
          binsDisplacedToStaging: displacedBinIds.length,
          displacedBinIds,
        },
      },
    });
  },
  apply: (event, draft) => {
    if (event.payload.outline === undefined) {
      delete draft.drawer.outline;
    } else {
      draft.drawer.outline = event.payload.outline;
    }
    if (event.payload.displacedBinIds.length > 0) {
      const idSet = new Set(event.payload.displacedBinIds);
      for (const bin of draft.bins) {
        if (idSet.has(bin.id)) bin.layerId = STAGING_ID;
      }
    }
  },
});
