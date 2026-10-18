import type { Bin, BinId, Layout, Rect, SlantConfig } from '@/core/types';
import { effectiveGridUnitMmY, gridUnits } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { footprintsOverlap, linkedExcessCacheKey } from './collision';
import {
  placedSlant,
  rectPastSide,
  slantConflicts,
  slantHeldUprightBy,
  type PlacedSlant,
  type slantZone,
} from './placedSlant';
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

/** The part of `rect` inside the drawer's bounding grid, if any. */
function withinGrid(rect: Rect, layout: Layout): Rect | null {
  const x = Math.max(0, rect.x);
  const y = Math.max(0, rect.y);
  const width = Math.min(layout.drawer.width, rect.x + rect.width) - x;
  const depth = Math.min(layout.drawer.depth, rect.y + rect.depth) - y;
  if (width <= EPS || depth <= EPS) return null;
  return { x: gridUnits(x), y: gridUnits(y), width: gridUnits(width), depth: gridUnits(depth) };
}

/** Slant lookups for one pass over a layout, so each bin's slant is resolved once. */
interface SlantLookup {
  readonly slantOf: (bin: Bin) => PlacedSlant | null;
  readonly zoneOf: (bin: Bin) => ReturnType<typeof slantZone>;
}

function lookupFor(layout: Layout): SlantLookup {
  const slants = new Map<BinId, PlacedSlant | null>();
  const slantOf = (bin: Bin): PlacedSlant | null => {
    if (!slants.has(bin.id)) slants.set(bin.id, placedSlant(bin, layout));
    return slants.get(bin.id) ?? null;
  };
  return {
    slantOf,
    zoneOf: (bin) => {
      const slant = slantOf(bin);
      return { slanted: slant !== null, rects: slant?.support ? [bin, slant.support] : [bin] };
    },
  };
}

export function slantIssue(
  bin: Bin,
  layout: Layout,
  lookup: SlantLookup = lookupFor(layout)
): SlantIssue | null {
  const own = lookup.slantOf(bin);
  if (!own || bin.layerId === STAGING_ID) return null;
  if (own.support && !insideDrawer(own.support, layout).valid) return 'blocked';
  if (slantConflicts(bin, own, layout, undefined, lookup.zoneOf).length > 0) return 'blocked';
  if (own.support) return null;

  const { plan, topOffsetMm } = own;
  const ahead = binsLeanedOver(bin, own, layout);
  if (ahead.some((other) => !leansAlike(lookup.slantOf(other)?.plan, plan))) return 'mismatch';
  if (ahead.length > 0) return null;
  // A shaped drawer's wall can stand inside its bounding box, where no padding reaches.
  const inGrid = withinGrid(leanStrip(bin, own, layout), layout);
  const pastWall =
    roomPastMm(bin, plan, layout) + EPS < topOffsetMm ||
    (inGrid !== null && !insideDrawer(inGrid, layout).valid);
  return pastWall ? 'pastDrawer' : 'unsupported';
}

function leanStrip(bin: Bin, own: PlacedSlant, layout: Layout): Rect {
  return rectPastSide(bin, own.plan.side, own.topOffsetMm / pitchAlong(own.plan, layout));
}

function binsLeanedOver(bin: Bin, own: PlacedSlant, layout: Layout): Bin[] {
  const lean = leanStrip(bin, own, layout);
  return layout.bins.filter(
    (other) =>
      other.id !== bin.id && other.layerId === bin.layerId && footprintsOverlap(other, lean)
  );
}

let issueCache: {
  layout: Layout;
  key: string;
  issues: ReadonlyMap<BinId, SlantIssue>;
} | null = null;

/** Every bin's issue at once, cached on the layout and the linked designs, for per-bin readers. */
export function getSlantIssues(
  layout: Layout,
  key: string = linkedExcessCacheKey()
): ReadonlyMap<BinId, SlantIssue> {
  if (issueCache?.layout === layout && issueCache.key === key) return issueCache.issues;
  const issues = new Map<BinId, SlantIssue>();
  const lookup = lookupFor(layout);
  for (const bin of layout.bins) {
    const issue = slantIssue(bin, layout, lookup);
    if (issue) issues.set(bin.id, issue);
  }
  issueCache = { layout, key, issues };
  return issues;
}

export function rowCanMatch(bin: Bin, layout: Layout): boolean {
  const own = placedSlant(bin, layout);
  if (!own) return false;
  const rowBins = slantRowOf(bin, own.plan.axis, layout);
  if (rowBins.some((b) => b.id !== bin.id && slantHeldUprightBy(b, layout) !== null)) return false;
  const row = new Set(rowBins.map((b) => b.id));
  return binsLeanedOver(bin, own, layout).every(
    (other) => leansAlike(placedSlant(other, layout)?.plan, own.plan) || row.has(other.id)
  );
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
