import type { Bin, BinId, Layout, SlantConfig } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { footprintsOverlap } from './collision';
import { placedSlant, rectPastSide, slantConflicts, type PlacedSlant } from './placedSlant';
import type { SlantPlan } from './slantPlan';
import { insideDrawer } from './validationPlacement';

/**
 * What is wrong with a slanted bin where it stands:
 * - `mismatch`: its top leans over a bin that does not lean the same way.
 * - `unsupported`: it ends a row with nothing past it and no end support.
 * - `pastDrawer`: it ends a row and its top leans past the drawer's edge.
 * - `blocked`: its support or its column is taken, as placement would refuse.
 */
export type SlantIssue = 'mismatch' | 'unsupported' | 'pastDrawer' | 'blocked';

const EPS = 1e-9;

function leansAlike(a: SlantPlan | undefined, b: SlantPlan): boolean {
  return a !== undefined && a.side === b.side && Math.abs(a.angleDeg - b.angleDeg) < EPS;
}

function pitchAlong(plan: SlantPlan, layout: Layout): number {
  return plan.axis === 'x' ? layout.gridUnitMm : effectiveGridUnitMmY(layout);
}

/** Room past the bin's leading edge, to the drawer wall, in mm. */
function roomPastMm(bin: Bin, plan: SlantPlan, layout: Layout): number {
  const { drawer, baseplateParams: pad } = layout;
  const pitch = pitchAlong(plan, layout);
  switch (plan.side) {
    case 'back':
      return (drawer.depth - bin.y - bin.depth) * pitch + Math.max(0, pad?.paddingBack ?? 0);
    case 'front':
      return bin.y * pitch + Math.max(0, pad?.paddingFront ?? 0);
    case 'right':
      return (drawer.width - bin.x - bin.width) * pitch + Math.max(0, pad?.paddingRight ?? 0);
    case 'left':
      return bin.x * pitch + Math.max(0, pad?.paddingLeft ?? 0);
  }
}

export function slantIssue(
  bin: Bin,
  layout: Layout,
  own: PlacedSlant | null = placedSlant(bin, layout)
): SlantIssue | null {
  if (!own || bin.layerId === STAGING_ID) return null;
  if (own.support && !insideDrawer(own.support, layout).valid) return 'blocked';
  if (slantConflicts(bin, own, layout).length > 0) return 'blocked';
  if (own.support) return null;

  const { plan, topOffsetMm } = own;
  const lean = rectPastSide(bin, plan.side, topOffsetMm / pitchAlong(plan, layout));
  const ahead = layout.bins.filter(
    (other) =>
      other.id !== bin.id && other.layerId === bin.layerId && footprintsOverlap(other, lean)
  );
  if (ahead.some((other) => !leansAlike(placedSlant(other, layout)?.plan, plan))) return 'mismatch';
  if (ahead.length > 0) return null;
  return roomPastMm(bin, plan, layout) + EPS < topOffsetMm ? 'pastDrawer' : 'unsupported';
}

/**
 * The row `bin` stands in along `axis`: bins on its layer edge to edge with
 * it, each with its cross extent, ordered by position along the axis. Derived
 * from adjacency on every call, since share import gives bins new ids.
 */
export function slantRowOf(bin: Bin, axis: 'x' | 'y', layout: Pick<Layout, 'bins'>): Bin[] {
  const along = (b: Bin): number => (axis === 'x' ? b.x : b.y);
  const length = (b: Bin): number => (axis === 'x' ? b.width : b.depth);
  const sameCross = (b: Bin): boolean =>
    axis === 'x'
      ? Math.abs(b.y - bin.y) < EPS && Math.abs(b.depth - bin.depth) < EPS
      : Math.abs(b.x - bin.x) < EPS && Math.abs(b.width - bin.width) < EPS;
  const peers = layout.bins.filter((b) => b.layerId === bin.layerId && sameCross(b));

  const row = [bin];
  for (let cur = bin; ;) {
    const next = peers.find((b) => Math.abs(along(b) - (along(cur) + length(cur))) < EPS);
    if (!next || row.includes(next)) break;
    row.push(next);
    cur = next;
  }
  for (let cur = bin; ;) {
    const prev = peers.find((b) => Math.abs(along(b) + length(b) - along(cur)) < EPS);
    if (!prev || row.includes(prev)) break;
    row.unshift(prev);
    cur = prev;
  }
  return row;
}

export interface RowSlant {
  readonly id: BinId;
  readonly slant: SlantConfig;
}

/**
 * The slant every bin in `bin`'s row takes to lean the way `bin` does, the
 * end support on the bin at the leading end. Listed with that bin last, so a
 * caller can drop its support alone when there is no room for it.
 */
export function matchRowSlants(bin: Bin, layout: Layout): RowSlant[] {
  const own = placedSlant(bin, layout);
  if (!own) return [];
  const { angleDeg, side, axis, sign } = own.plan;
  const row = slantRowOf(bin, axis, layout);
  const lead = sign === 1 ? row[row.length - 1] : row[0];
  return [
    ...row.filter((b) => b !== lead).map((b) => ({ id: b.id, slant: { angleDeg, side } })),
    { id: lead.id, slant: { angleDeg, side, endSupport: true } },
  ];
}
