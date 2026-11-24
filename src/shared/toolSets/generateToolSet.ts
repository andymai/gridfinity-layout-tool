import type { Cutout, PathPoint } from '@/shared/types/bin';
import type { ToolSetSpec } from '@/shared/types/toolSet';
import { maxEntryChamfer } from '@/shared/types/bin';
import { textElementFootprint } from '@/shared/utils/cutoutLabel';
import { onSideB, toSplitFrame } from '@/shared/utils/cutoutSplit';
import type { OutlineRing } from '@/shared/utils/cutoutOutline';
import { sizeEntries, type ToolFamily, type WrenchSizeEntry } from './catalog';
import { closerThan, nestHeadToTailCompact, placeRing, type NestPlacement } from './nestLayout';
import { combinationWrenchOutline } from './wrenchOutline';

/**
 * A text cutout's own depth field; its engraving depth comes from the text
 * style, as for a text element the editor places.
 */
const TEXT_CUT_DEPTH_MM = 5;
/** As wide as the editor's own finger cut. */
const CHANNEL_WIDTH_MM = 20;
/** Plastic left between two pockets at the top surface, where they are widest. */
export const TOOL_SET_WALL_MM = 2;
/**
 * The rounded-off lead-in at each pocket's top edge. Fixed rather than the
 * editor's size-based default, because the layout has to know how far each
 * pocket flares to keep the wall between neighbours.
 */
export const TOOL_SET_ENTRY_MM = 0.6;
/** Path points round to 0.01 mm, which must not eat into the wall. */
const ROUNDING_MARGIN_MM = 0.05;
/** Room kept around an engraved size. */
const LABEL_GAP_MM = 1.5;
/** A channel narrower than this has no room for a finger. */
const MIN_CHANNEL_MM = 12;
/** The channel stops this far above each pocket floor, as a finger cut does. */
const CHANNEL_FLOOR_LIFT_MM = 1;
const MIN_CHANNEL_DEPTH_MM = 2;
const CHANNEL_ENTRY_MM = 1;
/** Handle length kept clear of the heads at each end when placing the channel. */
const HEAD_CLEAR_RATIO = 1.1;

export interface ToolSetNames {
  /** Shape-list name of the pocket for one size label, e.g. "13 mm". */
  readonly pocket: (sizeLabel: string) => string;
  readonly channel: string;
}

export interface GeneratedToolSet {
  /** Every cutout of the set, its lowest corner at the origin, all in container `setId`. */
  readonly cutouts: Cutout[];
  readonly width: number;
  readonly depth: number;
  /** The deepest pocket, so the caller can check the fill is deep enough. */
  readonly deepestCutMm: number;
}

interface GenerateOptions {
  readonly setId: string;
  readonly idFactory: () => string;
  readonly names: ToolSetNames;
  /** The widest a set may be to stay on the print bed, when the bed is known. */
  readonly maxWidthMm?: number;
}

interface Row {
  readonly entry: WrenchSizeEntry;
  readonly ring: OutlineRing;
  readonly placement: NestPlacement;
  readonly placed: OutlineRing;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function boundsOf(rings: readonly OutlineRing[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

/** Where a point at `x` along a wrench (box tip = 0) lands in the set frame. */
function alongToSet(row: Row, x: number, y = 0): [number, number] {
  const u = x - row.entry.lengthMm / 2;
  const { cx, cy, flipped } = row.placement;
  return flipped ? [cx - u, cy - y] : [cx + u, cy + y];
}

function rectRing(cx: number, cy: number, w: number, h: number): OutlineRing {
  return [
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ];
}

function pocketFor(row: Row, spec: ToolSetSpec, opts: GenerateOptions): Cutout {
  const path: PathPoint[] = row.placed.map(([x, y]) => ({
    x: round2(x),
    y: round2(y),
    handleIn: null,
    handleOut: null,
    symmetric: false,
  }));
  const b = boundsOf([path.map((p): [number, number] => [p.x, p.y])]);
  const { entry } = row;
  const shallow = entry.openThicknessMm;
  const pocket: Cutout = {
    id: opts.idFactory(),
    shape: 'path',
    x: b.minX,
    y: b.minY,
    width: b.maxX - b.minX,
    depth: b.maxY - b.minY,
    cutDepth: shallow,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    parentGroups: [opts.setId],
    path,
    name: opts.names.pocket(entry.key),
    clearance: spec.clearanceMm,
    chamferWidth: Math.min(TOOL_SET_ENTRY_MM, maxEntryChamfer(shallow)),
  };
  if (entry.boxHeightMm <= shallow) return pocket;

  // The box end is the thicker part, so its well goes deeper and the wrench
  // lies level with its top flush.
  const reach = entry.boxWidthMm * 2;
  const [ax, ay] = alongToSet(row, entry.boxWidthMm, -reach);
  const [bx, by] = alongToSet(row, entry.boxWidthMm, reach);
  const a = toSplitFrame(pocket, ax, ay);
  const bPt = toSplitFrame(pocket, bx, by);
  const [boxX, boxY] = alongToSet(row, entry.boxWidthMm / 2);
  const boxCentre = toSplitFrame(pocket, boxX, boxY);
  const line = onSideB({ a, b: bPt }, boxCentre) ? { a, b: bPt } : { a: bPt, b: a };
  return {
    ...pocket,
    split: {
      a: { x: round2(line.a.x), y: round2(line.a.y) },
      b: { x: round2(line.b.x), y: round2(line.b.y) },
      cutDepth: entry.boxHeightMm,
    },
  };
}

/** The channel across every handle, or null when the heads leave no common stretch. */
function channelFor(rows: readonly Row[], opts: GenerateOptions): Cutout | null {
  let lo = -Infinity;
  let hi = Infinity;
  for (const row of rows) {
    const { entry } = row;
    const [x1] = alongToSet(row, entry.boxWidthMm * HEAD_CLEAR_RATIO);
    const shortest = entry.minLengthMm ?? entry.lengthMm;
    const [x2] = alongToSet(row, shortest - entry.openWidthMm * HEAD_CLEAR_RATIO);
    lo = Math.max(lo, Math.min(x1, x2));
    hi = Math.min(hi, Math.max(x1, x2));
  }
  const width = Math.min(CHANNEL_WIDTH_MM, hi - lo);
  if (width < MIN_CHANNEL_MM) return null;

  const span = boundsOf(rows.map((r) => r.placed));
  const depth = Math.max(
    MIN_CHANNEL_DEPTH_MM,
    Math.min(...rows.map((r) => r.entry.openThicknessMm)) - CHANNEL_FLOOR_LIFT_MM
  );
  return {
    id: opts.idFactory(),
    shape: 'slot',
    x: round2((lo + hi) / 2 - width / 2),
    y: round2(span.minY),
    width: round2(width),
    depth: round2(span.maxY - span.minY),
    cutDepth: depth,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    parentGroups: [opts.setId],
    name: opts.names.channel,
    finger: { bottom: 'curved' },
    entryProfile: 'round',
    chamferWidth: Math.min(CHANNEL_ENTRY_MM, maxEntryChamfer(depth)),
  };
}

/**
 * The size engraved on the top beside the box end: past its tip, else beside
 * its ring, else past the open end. Null when every spot is taken, and the
 * caller engraves it on the pocket floor instead.
 */
function labelSpot(
  row: Row,
  size: { readonly width: number; readonly depth: number },
  blockers: readonly OutlineRing[],
  gap: number
): [number, number] | null {
  const { entry } = row;
  const boxR = entry.boxWidthMm / 2;
  const along = size.width / 2 + gap;
  const across = boxR + size.depth / 2 + gap;
  const candidates: [number, number][] = [
    alongToSet(row, -along),
    alongToSet(row, boxR, across),
    alongToSet(row, boxR, -across),
    alongToSet(row, entry.lengthMm + along),
  ];
  return (
    candidates.find(([cx, cy]) => {
      const ring = rectRing(cx, cy, size.width, size.depth);
      return blockers.every((other) => !closerThan(other, ring, gap));
    }) ?? null
  );
}

/**
 * The cutouts for one tool set: a shaped pocket per tool nested head to tail,
 * an engraved size beside each, and a finger channel across the handles. Null
 * when no size in the spec is in the family's table.
 */
export function generateToolSet(
  spec: ToolSetSpec,
  family: ToolFamily,
  opts: GenerateOptions
): GeneratedToolSet | null {
  const entries = sizeEntries(family, spec.units, spec.sizes);
  const outlines = entries.flatMap((entry) => {
    const outline = combinationWrenchOutline({
      lengthMm: entry.lengthMm,
      openWidthMm: entry.openWidthMm,
      boxWidthMm: entry.boxWidthMm,
      shankWidthMm: entry.shankWidthMm,
      jawAngleDeg: family.table.jawAngleDeg,
      minLengthMm: entry.minLengthMm,
    });
    return outline ? [{ entry, ring: outline.ring }] : [];
  });
  if (outlines.length === 0) return null;

  const flare = spec.clearanceMm + TOOL_SET_ENTRY_MM;
  const gap = TOOL_SET_WALL_MM + 2 * flare + ROUNDING_MARGIN_MM;
  const nest = nestHeadToTailCompact(
    outlines.map((o) => ({ ring: o.ring, length: o.entry.lengthMm })),
    gap,
    opts.maxWidthMm
  );
  const rows: Row[] = outlines.map((o, i) => {
    const placement = nest.placements[i];
    return { ...o, placement, placed: placeRing(o.ring, o.entry.lengthMm, placement) };
  });

  const pockets = rows.map((row) => pocketFor(row, spec, opts));
  const channel = spec.fingerChannel ? channelFor(rows, opts) : null;

  const blockers: OutlineRing[] = rows.map((r) => r.placed);
  if (channel) {
    blockers.push(
      rectRing(
        channel.x + channel.width / 2,
        channel.y + channel.depth / 2,
        channel.width,
        channel.depth
      )
    );
  }
  const labels: Cutout[] = [];
  if (spec.labelSizeMm > 0) {
    rows.forEach((row, i) => {
      const caption = row.entry.key;
      const size = textElementFootprint(caption, spec.labelSizeMm);
      const spot = labelSpot(row, size, blockers, LABEL_GAP_MM + flare);
      if (!spot) {
        pockets[i] = { ...pockets[i], label: caption, engraveLabel: true, textAnchor: 'center' };
        return;
      }
      const [cx, cy] = spot;
      labels.push({
        id: opts.idFactory(),
        shape: 'text',
        x: round2(cx - size.width / 2),
        y: round2(cy - size.depth / 2),
        width: size.width,
        depth: size.depth,
        cutDepth: TEXT_CUT_DEPTH_MM,
        rotation: 0,
        cornerRadius: 0,
        label: caption,
        groupId: null,
        parentGroups: [opts.setId],
        engraveLabel: true,
        textAnchor: 'center',
        textStyle: { sizeMode: 'fixed', fixedSize: spec.labelSizeMm },
      });
      blockers.push(rectRing(cx, cy, size.width, size.depth));
    });
  }

  const all = [...pockets, ...(channel ? [channel] : []), ...labels];
  const b = boundsOf(
    all.map((c) => [
      [c.x - (c.clearance ?? 0), c.y - (c.clearance ?? 0)],
      [c.x + c.width + (c.clearance ?? 0), c.y + c.depth + (c.clearance ?? 0)],
    ])
  );
  const shifted = all.map((c) => shiftCutout(c, -b.minX, -b.minY));
  return {
    cutouts: shifted,
    width: b.maxX - b.minX,
    depth: b.maxY - b.minY,
    deepestCutMm: Math.max(...entries.map((e) => Math.max(e.boxHeightMm, e.openThicknessMm))),
  };
}

export function shiftCutout(c: Cutout, dx: number, dy: number): Cutout {
  return {
    ...c,
    x: round2(c.x + dx),
    y: round2(c.y + dy),
    ...(c.path
      ? { path: c.path.map((p) => ({ ...p, x: round2(p.x + dx), y: round2(p.y + dy) })) }
      : {}),
  };
}
