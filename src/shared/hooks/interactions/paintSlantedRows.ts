import { isOk } from '@/core/result';
import type { LayoutError, Result, ValidationError } from '@/core/result';
import { CONSTRAINTS, snapToGrid } from '@/core/constants';
import { gridUnits, heightUnits } from '@/core/types';
import type { BinId, CategoryId, Coord, LayerId, Layout, Rect, SlantConfig } from '@/core/types';
import type { AddBinParams } from './types';
import { edgeForPosition } from '@/shared/utils/fractionalEdge';
import { slantPlanFor } from '@/shared/utils/slantPlan';
import { planSlantedRows, type SlantedRow } from '@/shared/utils/slantRowFill';
import { ensureSlantRowDesign } from '@/shared/utils/slantRowDesign';
import { trackBinCreated } from '@/shared/analytics/posthog';
import { canPlaceBin } from '@/shared/utils/validation';

export interface PaintSlantedRowsArgs {
  readonly layout: Layout;
  readonly layerId: LayerId;
  readonly categoryId: CategoryId;
  readonly size: { readonly width: number; readonly depth: number };
  readonly slant: SlantConfig;
  readonly start: Coord;
  readonly current: Coord;
  /** The smallest step on the grid: 0.5 in half-grid mode. */
  readonly minSize: number;
  readonly addBin: (bin: AddBinParams) => Result<BinId, ValidationError | LayoutError>;
  readonly execute: (fn: () => void) => void;
  readonly onPlaced: (ids: BinId[]) => void;
  readonly onFailed: (reason: 'noRoom' | 'saveFailed') => void;
  readonly designName: (height: number) => string;
}

type PaintGesture = Pick<
  PaintSlantedRowsArgs,
  'start' | 'current' | 'size' | 'minSize' | 'slant' | 'layout'
>;

/**
 * The area a paint gesture fills. A click places one bin, so its area runs
 * from the clicked cell to the drawer edge it leans toward, for the support,
 * and across the lean is centred on the click and kept inside the drawer, as
 * the upright brush places it.
 */
export function slantedPaintArea(args: PaintGesture): Rect {
  const { start, current, size, minSize, layout } = args;
  if (start.x !== current.x || start.y !== current.y) {
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    return {
      x: gridUnits(x),
      y: gridUnits(y),
      width: gridUnits(Math.max(start.x, current.x) - x + minSize),
      depth: gridUnits(Math.max(start.y, current.y) - y + minSize),
    };
  }
  const plan = slantPlanFor(args.slant);
  const { width: drawerW, depth: drawerD } = layout.drawer;
  const from = (at: number, along: number, edge: number): [number, number] =>
    plan?.sign === -1 ? [0, at + along] : [at, edge - at];
  const across = (at: number, length: number, edge: number): [number, number] => {
    const centred = snapToGrid(at - (length - minSize) / 2, minSize === 0.5);
    return [Math.max(0, Math.min(centred, edge - length)), length];
  };
  const [x, width] =
    plan?.axis === 'x' ? from(start.x, size.width, drawerW) : across(start.x, size.width, drawerW);
  const [y, depth] =
    plan?.axis === 'y' ? from(start.y, size.depth, drawerD) : across(start.y, size.depth, drawerD);
  return { x: gridUnits(x), y: gridUnits(y), width: gridUnits(width), depth: gridUnits(depth) };
}

/** Shallow drawers are what a slant is for, so a row stands as tall as the drawer allows. */
export function slantedRowHeight(layout: Pick<Layout, 'drawer'>): number {
  return Math.max(CONSTRAINTS.MIN_BIN_HEIGHT, Math.floor(layout.drawer.height));
}

export function planPaintedRows(args: PaintGesture): SlantedRow[] {
  const singleClick = args.start.x === args.current.x && args.start.y === args.current.y;
  return planSlantedRows(
    slantedPaintArea(args),
    args.size,
    slantedRowHeight(args.layout),
    args.slant,
    args.layout,
    singleClick ? 1 : undefined
  );
}

/**
 * Fill a paint gesture with slanted rows: every bin linked to one design of
 * the row's size and slant, saved or reused first, and each row's leading bin
 * carrying the end support. The bins land in one undo step; the design save
 * is not undone with them.
 */
export async function paintSlantedRows(args: PaintSlantedRowsArgs): Promise<void> {
  const { layout, size, slant } = args;
  const height = slantedRowHeight(layout);
  const rows = planPaintedRows(args);
  // Checked before the design is saved, so a gesture over taken cells saves nothing.
  const anyFits = rows.some((row) =>
    row.bins.some(
      (rect) => canPlaceBin({ ...rect, height: heightUnits(height) }, args.layerId, layout).valid
    )
  );
  if (!anyFits) {
    args.onFailed('noRoom');
    return;
  }
  const first = rows[0].bins[0];

  const designId = await ensureSlantRowDesign({
    name: args.designName(height),
    width: size.width,
    depth: size.depth,
    height,
    slant: { angleDeg: slant.angleDeg, side: slant.side },
    gridUnitMm: layout.gridUnitMm,
    ...(layout.gridUnitMmY !== undefined ? { gridUnitMmY: layout.gridUnitMmY } : {}),
    heightUnitMm: layout.heightUnitMm,
    fractionalEdgeX: edgeForPosition(first.x, layout.drawer.width, layout.drawer.fractionalEdgeX),
    fractionalEdgeY: edgeForPosition(first.y, layout.drawer.depth, layout.drawer.fractionalEdgeY),
  });
  if (!designId) {
    args.onFailed('saveFailed');
    return;
  }

  const leadSlant = { angleDeg: slant.angleDeg, side: slant.side, endSupport: true };
  const placed: BinId[] = [];
  args.execute(() => {
    for (const row of rows) {
      row.bins.forEach((rect, i) => {
        const bin: AddBinParams = {
          ...rect,
          layerId: args.layerId,
          height: heightUnits(height),
          category: args.categoryId,
          label: '',
          notes: '',
          linkedDesignId: designId,
        };
        const lead = i === row.bins.length - 1;
        const supported = lead ? args.addBin({ ...bin, slant: leadSlant }) : undefined;
        // Without room for its support it still joins the row; the inspector says what it needs.
        const result = supported && isOk(supported) ? supported : args.addBin(bin);
        if (isOk(result)) placed.push(result.value);
      });
    }
  });

  if (placed.length === 0) {
    args.onFailed('noRoom');
    return;
  }
  trackBinCreated({
    method: 'paint',
    count: placed.length,
    width: size.width,
    depth: size.depth,
    height,
  });
  args.onPlaced(placed);
}
