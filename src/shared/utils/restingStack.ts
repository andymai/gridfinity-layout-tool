/**
 * Where every placed bin physically sits. A loose bin falls until something
 * stops it, so each one rests on the tallest bin from a lower layer that its
 * footprint overlaps, or on the plate. Layers are only the stacking order.
 *
 * Clearance a bin reserves for tall contents counts as part of its stack: a
 * bin above lands on top of it, never inside it, but a bin carried by
 * clearance alone is a violation, since it presses on the contents.
 *
 * All values are height units above the plate.
 */

import type { Bin, BinId, BlockedZone, Layer, LayerId } from '@/core/types';
import { gridUnits } from '@/core/types';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { footprintsOverlap, linkedExcessUnits, linkedExcessCacheKey } from './collision';

const EPSILON = 1e-9;
// Footprints sit on the half-unit lattice, so sampling cell centres at this
// pitch measures coverage exactly.
const COVERAGE_STEP = 0.5;

export interface RestingBin {
  zStart: number;
  /** Top of the bin's material, including a linked design's extra rise. */
  materialTop: number;
  /** Top of everything the bin claims, clearance included: where a bin above lands. */
  stackTop: number;
  /** Lower-layer bins whose stack top is exactly this bin's base. Empty on the plate. */
  restsOn: BinId[];
}

export interface ClearanceRest {
  binId: BinId;
  /** The lower bin whose reserved clearance `binId` rests on. */
  clearanceOf: BinId;
}

export interface RestingStack {
  bins: ReadonlyMap<BinId, RestingBin>;
  /** Highest `stackTop` in the layout; 0 when nothing is placed. */
  tallest: number;
  onClearance: readonly ClearanceRest[];
}

export type StackViolation =
  | { kind: 'exceeds_height'; binId: BinId }
  | { kind: 'clearance'; binId: BinId; clearanceOf: BinId };

function hasClearance(rest: RestingBin): boolean {
  return rest.stackTop > rest.materialTop + EPSILON;
}

interface Placed {
  bin: Bin;
  layer: number;
}

function placedInStackOrder(bins: readonly Bin[], layers: readonly Layer[]): Placed[] {
  const layerIndex = new Map(layers.map((l, i) => [l.id, i]));
  const placed: Placed[] = [];
  for (const bin of bins) {
    if (bin.layerId === STAGING_ID) continue;
    const layer = layerIndex.get(bin.layerId);
    if (layer !== undefined) placed.push({ bin, layer });
  }
  return placed.sort((a, b) => a.layer - b.layer);
}

/**
 * Rests `entry` on the already-resolved bins among `unders` (any order, may
 * include bins that do not overlap or share its layer).
 */
function restOne(
  entry: Placed,
  unders: Iterable<Placed>,
  resolved: ReadonlyMap<BinId, RestingBin>,
  onClearance: ClearanceRest[]
): RestingBin {
  const { bin, layer } = entry;
  let zStart = 0;
  let restsOn: BinId[] = [];

  for (const under of unders) {
    if (under.layer >= layer || !footprintsOverlap(bin, under.bin)) continue;
    const top = (resolved.get(under.bin.id) as RestingBin).stackTop;
    if (top > zStart + EPSILON) {
      zStart = top;
      restsOn = [under.bin.id];
    } else if (Math.abs(top - zStart) <= EPSILON) {
      restsOn.push(under.bin.id);
    }
  }

  // Contents that reach exactly the base of a bin held up by something solid
  // are not pressed on; only a bin carried by clearance alone is.
  const supporters = restsOn.map((id) => resolved.get(id) as RestingBin);
  if (supporters.length > 0 && supporters.every(hasClearance)) {
    for (const id of restsOn) onClearance.push({ binId: bin.id, clearanceOf: id });
  }

  const excess = linkedExcessUnits(bin);
  return {
    zStart,
    materialTop: zStart + bin.height + excess,
    stackTop: zStart + bin.height + Math.max(bin.clearanceHeight ?? 0, excess),
    restsOn,
  };
}

function tallestOf(resolved: ReadonlyMap<BinId, RestingBin>): number {
  let tallest = 0;
  for (const rest of resolved.values()) tallest = Math.max(tallest, rest.stackTop);
  return tallest;
}

function cellKeys(bin: Bin): string[] {
  const keys: string[] = [];
  for (let x = Math.floor(bin.x); x < Math.ceil(bin.x + bin.width); x++) {
    for (let y = Math.floor(bin.y); y < Math.ceil(bin.y + bin.depth); y++) keys.push(`${x},${y}`);
  }
  return keys;
}

/**
 * Two footprints that overlap share at least one whole grid cell, so a bin
 * only needs testing against the bins already filed under its own cells.
 */
export function resolveRestingStack(bins: readonly Bin[], layers: readonly Layer[]): RestingStack {
  const placed = placedInStackOrder(bins, layers);
  const resolved = new Map<BinId, RestingBin>();
  const onClearance: ClearanceRest[] = [];
  const byCell = new Map<string, Placed[]>();
  for (const entry of placed) {
    const keys = cellKeys(entry.bin);
    const unders = new Set<Placed>();
    for (const key of keys) for (const under of byCell.get(key) ?? []) unders.add(under);
    resolved.set(entry.bin.id, restOne(entry, unders, resolved, onClearance));
    for (const key of keys) {
      const filed = byCell.get(key);
      if (filed) filed.push(entry);
      else byCell.set(key, [entry]);
    }
  }
  return { bins: resolved, tallest: tallestOf(resolved), onClearance };
}

/**
 * `before` (resolved from `bins`) after removing `remove` and adding `add`;
 * an added bin replaces any bin with its id. Only bins the change can move
 * are re-rested: a bin moves only if something under it changed, so the
 * dirty set spreads upward through overlapping footprints and everything
 * else keeps its old values. A drag check or an import step then costs the
 * layout size times the few bins it moves, not the layout size squared.
 */
export function restack(
  before: RestingStack,
  bins: readonly Bin[],
  layers: readonly Layer[],
  remove: ReadonlySet<BinId>,
  add: readonly Bin[]
): RestingStack {
  const addIds = new Set(add.map((b) => b.id));
  const kept = bins.filter((b) => !remove.has(b.id) && !addIds.has(b.id));
  const departed = placedInStackOrder(
    bins.filter((b) => remove.has(b.id) || addIds.has(b.id)),
    layers
  );
  const placed = placedInStackOrder([...kept, ...add], layers);

  const resolved = new Map<BinId, RestingBin>();
  const onClearance: ClearanceRest[] = [];
  const dirty: Placed[] = [];

  for (let i = 0; i < placed.length; i++) {
    const entry = placed[i];
    const above = (other: Placed): boolean =>
      other.layer < entry.layer && footprintsOverlap(other.bin, entry.bin);
    const old = before.bins.get(entry.bin.id);
    if (addIds.has(entry.bin.id) || !old || departed.some(above) || dirty.some(above)) {
      dirty.push(entry);
      resolved.set(entry.bin.id, restOne(entry, placed.slice(0, i), resolved, onClearance));
    } else {
      resolved.set(entry.bin.id, old);
    }
  }

  const dirtyIds = new Set(dirty.map((d) => d.bin.id));
  for (const rest of before.onClearance) {
    if (dirtyIds.has(rest.binId) || !resolved.has(rest.binId)) continue;
    if (!resolved.has(rest.clearanceOf)) continue;
    onClearance.push(rest);
  }

  return { bins: resolved, tallest: tallestOf(resolved), onClearance };
}

let cache: {
  bins: readonly Bin[];
  length: number;
  layers: readonly Layer[];
  key: string;
  stack: RestingStack;
} | null = null;

/**
 * Cached by reference, like the store's arrays, plus the linked-rise key: a
 * design re-save can move bins without touching either array. The length
 * check catches an array grown in place, which would otherwise read stale.
 */
export function getRestingStack(
  bins: readonly Bin[],
  layers: readonly Layer[],
  key: string = linkedExcessCacheKey()
): RestingStack {
  if (
    cache?.bins === bins &&
    cache.length === bins.length &&
    cache.layers === layers &&
    cache.key === key
  ) {
    return cache.stack;
  }
  const stack = resolveRestingStack(bins, layers);
  cache = { bins, length: bins.length, layers, key, stack };
  return stack;
}

export function findStackViolations(stack: RestingStack, drawerHeight: number): StackViolation[] {
  const violations: StackViolation[] = [];
  for (const [binId, rest] of stack.bins) {
    if (rest.stackTop > drawerHeight + EPSILON) violations.push({ kind: 'exceeds_height', binId });
  }
  for (const rest of stack.onClearance) violations.push({ kind: 'clearance', ...rest });
  return violations;
}

function violationKey(v: StackViolation): string {
  return v.kind === 'clearance' ? `c:${v.binId}:${v.clearanceOf}` : `h:${v.binId}`;
}

/**
 * Violations `after` has that `before` did not, counting a stack that was
 * already over the drawer only if it rose further. A layout that already
 * overflows (a shrunk drawer, a re-saved linked design) must not freeze every
 * unrelated edit, nor let one push it further over.
 */
export function newViolations(
  before: RestingStack,
  after: RestingStack,
  drawerHeight: number
): StackViolation[] {
  const existing = new Set(findStackViolations(before, drawerHeight).map(violationKey));
  return findStackViolations(after, drawerHeight).filter((v) => {
    if (!existing.has(violationKey(v))) return true;
    if (v.kind !== 'exceeds_height') return false;
    const was = before.bins.get(v.binId)?.stackTop ?? 0;
    return (after.bins.get(v.binId)?.stackTop ?? 0) > was + EPSILON;
  });
}

/**
 * The lowest the drawer can go: the tallest stack. A layout already taller
 * than its drawer keeps its current height rather than being raised by an
 * attempt to shrink it.
 */
export function drawerHeightFloor(
  bins: readonly Bin[],
  layers: readonly Layer[],
  currentHeight: number
): number {
  const tallest = Math.max(getRestingStack(bins, layers).tallest, CONSTRAINTS.MIN_LAYER_HEIGHT);
  return Math.min(tallest, currentHeight);
}

/**
 * The tallest `candidate` can be before it, or anything stacked on it,
 * passes the drawer top. The candidate replaces any bin with the same id.
 * Every chain of bins resting on the candidate rises one-for-one with its
 * top, so the room is the drawer minus the longest such chain. This only
 * knows the drawer; `maxPlaceableHeight` also respects clearance.
 *
 * `clearanceGivesWay` is for an edit that keeps height plus clearance fixed,
 * as the inspector's height field does: the bin can then grow into its own
 * clearance without raising anything. Otherwise the clearance rides on top.
 * A linked design's extra rise always rides on top: resizing the bin resizes
 * the design, which keeps its lid or extra wall above the new height.
 */
export function maxBinHeight(
  candidate: Bin,
  bins: readonly Bin[],
  layers: readonly Layer[],
  drawerHeight: number,
  options: { clearanceGivesWay?: boolean; stack?: RestingStack } = {}
): number {
  const current = options.stack ?? getRestingStack(bins, layers);
  const stack = bins.includes(candidate)
    ? current
    : restack(current, bins, layers, new Set([candidate.id]), [candidate]);
  const self = stack.bins.get(candidate.id);
  if (!self) return drawerHeight;

  // Each stack may reach the drawer top, or stay where it already stands if
  // that is higher: an existing overflow is allowed as long as it does not
  // rise. `rise` is how far above the candidate's stack top a chain reaches.
  const ceilingOf = (id: BinId): number =>
    Math.max(drawerHeight, current.bins.get(id)?.stackTop ?? 0);
  let room = ceilingOf(candidate.id) - self.zStart;
  const placed = placedInStackOrder(
    [...bins.filter((b) => b.id !== candidate.id), candidate],
    layers
  );
  const selfEntry = placed.find((p) => p.bin === candidate);
  const reached: { entry: Placed; rise: number }[] = selfEntry
    ? [{ entry: selfEntry, rise: 0 }]
    : [];
  for (const entry of placed) {
    if (!selfEntry || entry.layer <= selfEntry.layer) continue;
    let base = -Infinity;
    for (const r of reached) {
      if (r.entry.layer >= entry.layer || !footprintsOverlap(entry.bin, r.entry.bin)) continue;
      base = Math.max(base, r.rise);
    }
    if (base === -Infinity) continue;
    const rest = stack.bins.get(entry.bin.id) as RestingBin;
    const rise = base + rest.stackTop - rest.zStart;
    reached.push({ entry, rise });
    room = Math.min(room, ceilingOf(entry.bin.id) - self.zStart - rise);
  }

  const excess = self.materialTop - self.zStart - candidate.height;
  const clearance = options.clearanceGivesWay ? 0 : (candidate.clearanceHeight ?? 0);
  return room - Math.max(excess, clearance);
}

/**
 * The most clearance `bin` can reserve: up to the drawer top, and no higher
 * than the base of any bin above it, which would otherwise end up resting on
 * the clearance. Never below what it reserves now, so a bin in a stack that
 * is already over the drawer can still give its clearance back.
 */
export function maxClearanceHeight(
  bin: Bin,
  bins: readonly Bin[],
  layers: readonly Layer[],
  drawerHeight: number,
  stack: RestingStack = getRestingStack(bins, layers)
): number {
  const self = stack.bins.get(bin.id);
  if (!self) return Math.max(0, drawerHeight - bin.height);
  const layerIndex = new Map(layers.map((l, i) => [l.id, i]));
  const own = layerIndex.get(bin.layerId) ?? 0;
  let ceiling = drawerHeight;
  for (const other of bins) {
    const index = layerIndex.get(other.layerId);
    if (index === undefined || index <= own || !footprintsOverlap(bin, other)) continue;
    ceiling = Math.min(ceiling, stack.bins.get(other.id)?.zStart ?? ceiling);
  }
  return Math.max(bin.clearanceHeight ?? 0, ceiling - self.zStart - bin.height);
}

function coverage(
  rect: { x: number; y: number; width: number; depth: number },
  covers: readonly Bin[]
): number {
  if (covers.length === 0) return 0;
  let total = 0;
  let covered = 0;
  for (let cx = rect.x + COVERAGE_STEP / 2; cx < rect.x + rect.width; cx += COVERAGE_STEP) {
    for (let cy = rect.y + COVERAGE_STEP / 2; cy < rect.y + rect.depth; cy += COVERAGE_STEP) {
      total++;
      if (covers.some((c) => cx > c.x && cx < c.x + c.width && cy > c.y && cy < c.y + c.depth)) {
        covered++;
      }
    }
  }
  return total === 0 ? 0 : covered / total;
}

interface Area {
  x: number;
  y: number;
  width: number;
  depth: number;
}

/**
 * The parts of `rect` no cover overlaps, as rectangles on the half-unit
 * lattice: runs of open cells per row, merged down while the next row has
 * the same run.
 */
function uncoveredAreas(rect: Area, covers: readonly Bin[]): Area[] {
  const cols = Math.round(rect.width / COVERAGE_STEP);
  const rows = Math.round(rect.depth / COVERAGE_STEP);
  const open = (i: number, j: number): boolean => {
    const cx = rect.x + (i + 0.5) * COVERAGE_STEP;
    const cy = rect.y + (j + 0.5) * COVERAGE_STEP;
    return !covers.some((c) => cx > c.x && cx < c.x + c.width && cy > c.y && cy < c.y + c.depth);
  };
  const active = new Map<string, { i0: number; i1: number; j0: number }>();
  const areas: Area[] = [];
  for (let j = 0; j <= rows; j++) {
    const runs = new Set<string>();
    for (let i = 0; j < rows && i < cols; i++) {
      if (!open(i, j)) continue;
      const i0 = i;
      while (i + 1 < cols && open(i + 1, j)) i++;
      runs.add(`${String(i0)}:${String(i + 1)}`);
    }
    for (const [key, run] of active) {
      if (runs.has(key)) continue;
      areas.push({
        x: rect.x + run.i0 * COVERAGE_STEP,
        y: rect.y + run.j0 * COVERAGE_STEP,
        width: (run.i1 - run.i0) * COVERAGE_STEP,
        depth: (j - run.j0) * COVERAGE_STEP,
      });
      active.delete(key);
    }
    for (const key of runs) {
      if (active.has(key)) continue;
      const [i0, i1] = key.split(':').map(Number);
      active.set(key, { i0, i1, j0: j });
    }
  }
  return areas;
}

/**
 * Bins lifted off the plate whose base is not fully carried at their resting
 * height: they lean on a taller neighbour or overhang empty space. Placement
 * allows it; the UI flags it.
 */
export function findUnevenlySupported(
  bins: readonly Bin[],
  stack: RestingStack
): ReadonlySet<BinId> {
  const byId = new Map(bins.map((b) => [b.id, b]));
  const uneven = new Set<BinId>();
  for (const [binId, rest] of stack.bins) {
    if (rest.restsOn.length === 0) continue;
    const bin = byId.get(binId);
    if (!bin) continue;
    // A supporter that only meets the base with its clearance carries nothing.
    const supporters = rest.restsOn.flatMap((id) => {
      const supporter = stack.bins.get(id);
      return supporter && !hasClearance(supporter) ? (byId.get(id) ?? []) : [];
    });
    if (coverage(bin, supporters) < 1 - EPSILON) uneven.add(binId);
  }
  return uneven;
}

let unevenCache: { stack: RestingStack; result: ReadonlySet<BinId> } | null = null;

/** `findUnevenlySupported`, cached on the resting stack it was given. */
export function getUnevenlySupported(
  bins: readonly Bin[],
  stack: RestingStack
): ReadonlySet<BinId> {
  if (unevenCache?.stack !== stack) {
    unevenCache = { stack, result: findUnevenlySupported(bins, stack) };
  }
  return unevenCache.result;
}

/**
 * Areas a bin on `targetLayerId` cannot use because a lower bin reserves
 * clearance above itself there. A tall bin blocks nothing: a bin above rests
 * on it. Where bins on intermediate layers cover the clearance, anything
 * higher rests on them instead, so each zone is only the part left exposed.
 */
export function getBlockedZones(
  targetLayerId: LayerId,
  bins: readonly Bin[],
  layers: readonly Layer[],
  stack: RestingStack = getRestingStack(bins, layers)
): BlockedZone[] {
  const targetIndex = layers.findIndex((l) => l.id === targetLayerId);
  if (targetIndex === -1) return [];
  const layerIndex = new Map(layers.map((l, i) => [l.id, i]));
  const zones: BlockedZone[] = [];

  for (const bin of bins) {
    const index = layerIndex.get(bin.layerId);
    if (index === undefined || index >= targetIndex) continue;
    const rest = stack.bins.get(bin.id);
    if (!rest || !hasClearance(rest)) continue;
    const between = bins.filter((b) => {
      const i = layerIndex.get(b.layerId);
      return i !== undefined && i > index && i < targetIndex && footprintsOverlap(b, bin);
    });
    for (const area of uncoveredAreas(bin, between)) {
      zones.push({
        x: gridUnits(area.x),
        y: gridUnits(area.y),
        width: gridUnits(area.width),
        depth: gridUnits(area.depth),
        sourceBinId: bin.id,
        sourceLayerId: bin.layerId,
      });
    }
  }
  return zones;
}
