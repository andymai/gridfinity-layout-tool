import type { Cutout, PathPoint } from '@/shared/types/bin';
import { maxEntryChamfer } from '@/shared/types/bin';
import { labelPart, pocketPart, type ToolSetPart, type ToolSetSpec } from '@/shared/types/toolSet';
import { textElementFootprint } from '@/shared/utils/cutoutLabel';
import { ringBounds, type OutlineRing } from '@/shared/utils/cutoutOutline';
import { onSideB, toSplitFrame, type SplitPt } from '@/shared/utils/cutoutSplit';
import { FINGER_WIDTH_MM } from '@/shared/utils/fingerAccess';
import { sizeEntries, type ToolFamily, type WrenchSizeEntry, type WrenchTable } from './catalog';
import {
  closerThan,
  nestHeadToTailCompact,
  placeRing,
  type NestPlacement,
  type NestResult,
} from './nestLayout';
import { combinationWrenchOutline } from './wrenchOutline';

/**
 * A text cutout's own depth field; its engraving depth comes from the text
 * style, as for a text element the editor places.
 */
const TEXT_CUT_DEPTH_MM = 5;
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
const LABEL_GAP_MM = 1.5;
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
  /** A channel was asked for, but no layout leaves the handles a common stretch. */
  readonly channelDropped: boolean;
}

interface GenerateOptions {
  readonly setId: string;
  /** The id for a part: a rebuild passes the old part's id back. */
  readonly idFor: (part: ToolSetPart) => string;
  readonly names: ToolSetNames;
  /** The widest a set may be to stay on the print bed, when the bed is known. */
  readonly maxWidthMm?: number;
}

interface Placed {
  readonly entry: WrenchSizeEntry;
  readonly placement: NestPlacement;
}

interface Row extends Placed {
  readonly placed: OutlineRing;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Where a point at `x` along a wrench (box tip = 0) lands in the set frame. */
function alongToSet(row: Placed, x: number, y = 0): [number, number] {
  return placeRing([[x, y]], row.entry.lengthMm, row.placement)[0];
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
  const bounds = ringBounds(path.map((p): [number, number] => [p.x, p.y]));
  const { entry } = row;
  const shallow = entry.openThicknessMm;
  const part = pocketPart(entry.key);
  const pocket: Cutout = {
    id: opts.idFor(part),
    shape: 'path',
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    depth: bounds.maxY - bounds.minY,
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
    toolSetPart: part,
  };
  if (entry.boxHeightMm <= shallow) return pocket;

  // The box end is the thicker part, so its well goes deeper and the wrench
  // lies level with its top flush.
  const splitPoint = (x: number, y = 0): SplitPt => {
    const [sx, sy] = alongToSet(row, x, y);
    return toSplitFrame(pocket, sx, sy);
  };
  const reach = entry.boxWidthMm * 2;
  const a = splitPoint(entry.boxWidthMm, -reach);
  const b = splitPoint(entry.boxWidthMm, reach);
  const boxCentre = splitPoint(entry.boxWidthMm / 2);
  const line = onSideB({ a, b }, boxCentre) ? { a, b } : { a: b, b: a };
  return {
    ...pocket,
    split: {
      a: { x: round2(line.a.x), y: round2(line.a.y) },
      b: { x: round2(line.b.x), y: round2(line.b.y) },
      cutDepth: entry.boxHeightMm,
    },
  };
}

/** The stretch along x that every handle shares, clear of the heads, or null. */
function commonHandleSpan(rows: readonly Placed[]): { lo: number; hi: number } | null {
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
  return hi - lo >= MIN_CHANNEL_MM ? { lo, hi } : null;
}

function channelFor(rows: readonly Row[], opts: GenerateOptions): Cutout | null {
  const span = commonHandleSpan(rows);
  if (!span) return null;
  const width = Math.min(FINGER_WIDTH_MM, span.hi - span.lo);
  const extent = ringBounds(rows.flatMap((r) => r.placed));
  const depth = Math.max(
    MIN_CHANNEL_DEPTH_MM,
    Math.min(...rows.map((r) => r.entry.openThicknessMm)) - CHANNEL_FLOOR_LIFT_MM
  );
  return {
    id: opts.idFor('channel'),
    shape: 'slot',
    x: round2((span.lo + span.hi) / 2 - width / 2),
    y: round2(extent.minY),
    width: round2(width),
    depth: round2(extent.maxY - extent.minY),
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
    toolSetPart: 'channel',
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

const outlineCache = new WeakMap<WrenchSizeEntry, OutlineRing | null>();

function outlineOf(entry: WrenchSizeEntry, jawAngleDeg: number): OutlineRing | null {
  const cached = outlineCache.get(entry);
  if (cached !== undefined) return cached;
  const ring = combinationWrenchOutline({
    lengthMm: entry.lengthMm,
    openWidthMm: entry.openWidthMm,
    boxWidthMm: entry.boxWidthMm,
    shankWidthMm: entry.shankWidthMm,
    jawAngleDeg,
    minLengthMm: entry.minLengthMm,
  });
  outlineCache.set(entry, ring);
  return ring;
}

/**
 * The layout search is most of a set's cost, and the dialog asks again on every
 * change, most of which (engraving, the channel) cannot move a pocket. Keyed
 * per table, so a test table never reads a real one's layout.
 */
const nestCache = new WeakMap<WrenchTable, Map<string, NestResult>>();
const NEST_CACHE_SIZE = 16;

function nestOf(
  table: WrenchTable,
  outlines: readonly { readonly entry: WrenchSizeEntry; readonly ring: OutlineRing }[],
  gap: number,
  maxWidthMm: number,
  wantsChannel: boolean
): NestResult {
  const keys = outlines.map((o) => o.entry.key).join(',');
  const key = `${keys}|${gap}|${maxWidthMm}|${wantsChannel}`;
  let byKey = nestCache.get(table);
  if (!byKey) {
    byKey = new Map();
    nestCache.set(table, byKey);
  }
  const hit = byKey.get(key);
  if (hit) return hit;
  const nest = nestHeadToTailCompact(
    outlines.map((o) => ({ ring: o.ring, length: o.entry.lengthMm })),
    gap,
    maxWidthMm,
    wantsChannel
      ? (r) =>
          commonHandleSpan(
            outlines.map((o, i) => ({ entry: o.entry, placement: r.placements[i] }))
          ) !== null
      : undefined
  );
  if (byKey.size >= NEST_CACHE_SIZE) {
    const oldest = byKey.keys().next().value;
    if (oldest !== undefined) byKey.delete(oldest);
  }
  byKey.set(key, nest);
  return nest;
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
  const outlines = sizeEntries(family, spec.units, spec.sizes).flatMap((entry) => {
    const ring = outlineOf(entry, family.table.jawAngleDeg);
    return ring ? [{ entry, ring }] : [];
  });
  if (outlines.length === 0) return null;

  const flare = spec.clearanceMm + TOOL_SET_ENTRY_MM;
  const gap = TOOL_SET_WALL_MM + 2 * flare + ROUNDING_MARGIN_MM;
  const labelGap = LABEL_GAP_MM + flare;
  // Sizes past the box tips widen the set after the layout is chosen, on
  // either side, so the bed limit the layout sees leaves room for them.
  const widestLabel = Math.max(
    0,
    ...outlines.map((o) => textElementFootprint(o.entry.key, spec.labelSizeMm).width)
  );
  const labelRoom = spec.labelSizeMm > 0 ? 2 * (widestLabel + labelGap) : 0;
  const nest = nestOf(
    family.table,
    outlines,
    gap,
    (opts.maxWidthMm ?? Infinity) - labelRoom,
    spec.fingerChannel
  );
  const rows: Row[] = outlines.map((o, i) => {
    const placement = nest.placements[i];
    return { entry: o.entry, placement, placed: placeRing(o.ring, o.entry.lengthMm, placement) };
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
      const spot = labelSpot(row, size, blockers, labelGap);
      if (!spot) {
        pockets[i] = { ...pockets[i], label: caption, engraveLabel: true, textAnchor: 'center' };
        return;
      }
      const [cx, cy] = spot;
      const part = labelPart(caption);
      labels.push({
        id: opts.idFor(part),
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
        toolSetPart: part,
      });
      blockers.push(rectRing(cx, cy, size.width, size.depth));
    });
  }

  const all = [...pockets, ...(channel ? [channel] : []), ...labels];
  const b = ringBounds(
    all.flatMap((c): OutlineRing => {
      const pad = c.clearance ?? 0;
      return [
        [c.x - pad, c.y - pad],
        [c.x + c.width + pad, c.y + c.depth + pad],
      ];
    })
  );
  return {
    cutouts: all.map((c) => shiftCutout(c, -b.minX, -b.minY)),
    width: b.maxX - b.minX,
    depth: b.maxY - b.minY,
    deepestCutMm: Math.max(
      ...rows.map(({ entry }) => Math.max(entry.boxHeightMm, entry.openThicknessMm))
    ),
    channelDropped: spec.fingerChannel && channel === null,
  };
}

/** Moves a cutout and its path, rounded to 0.01 mm as the generator writes it. */
export function shiftCutout(c: Cutout, dx: number, dy: number): Cutout {
  const move = (p: PathPoint): PathPoint => ({ ...p, x: round2(p.x + dx), y: round2(p.y + dy) });
  return {
    ...c,
    x: round2(c.x + dx),
    y: round2(c.y + dy),
    ...(c.path ? { path: c.path.map(move) } : {}),
    ...(c.holes ? { holes: c.holes.map((ring) => ring.map(move)) } : {}),
  };
}
