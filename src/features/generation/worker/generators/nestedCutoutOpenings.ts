/**
 * Where a pocket opens onto the floor of a shallower pocket around it.
 *
 * An entry chamfer is cut at the fill surface, but inside a shallower pocket
 * that surface is already gone: the deeper pocket opens at the shallower one's
 * floor, so its chamfer belongs there. A pocket wholly inside a floor is cut
 * with its chamfer sunk to the deepest such floor, since above that floor the
 * other pocket has taken everything, the surface chamfer included. A pocket
 * that crosses a floor's outline keeps its chamfer at the surface and gets a
 * flare of its own at that floor, trimmed to the floor's outline, for each
 * floor it crosses deeper than any it sinks to.
 *
 * What takes part, either way round: ungrouped cutouts with every instance of
 * their repeat, and union group members with every copy of the group (a
 * union's cavity is its members' union, so each member's floor and rim are
 * real). What does not:
 * - Subtract, intersect and exclude groups, whose cavity outline is no
 *   member's.
 * - A leaned pocket as the floor: it is tilted, so nothing opens onto it at one
 *   height. A leaned pocket still opens onto a level floor around it.
 * - Mesh imprints. They are cut after tessellation, so a pocket inside one
 *   never sees its floor, which is contoured relief in any case. An imprint
 *   inside a pocket keeps its chamfer at the surface: the mesh domain holds no
 *   exact copy of the pocket's outline to trim a flare against, and an
 *   approximate one leaves a sliver along the wall.
 */

import type { Cutout } from '@/shared/types/bin';
import { CHAMFER_SHAPES, DEFAULT_GROUP_OP, resolveCutoutLeanDeg } from '@/shared/types/bin';
import { cutoutOutlineRing, ringBounds, rotateAbout } from '@/shared/utils/cutoutOutline';
import type { OutlineBounds, OutlinePoint, OutlineRing } from '@/shared/utils/cutoutOutline';
import { expandCutoutArray, expandCutoutGroup } from '@/shared/utils/cutoutArray';
import { resolveScoop } from './cutoutScoopHelpers';

/** The straight wall the builder keeps under any entry chamfer (mm). */
const MIN_STRAIGHT_WALL_MM = 0.2;

/** Narrowest flare worth a tool; the builder skips a top chamfer below it too. */
const MIN_FLARE_MM = 0.05;

/** How far past a scooped floor's fillet a flare of its own carries on (mm). */
const RISE_PAST_SCOOP_MM = 0.5;

/**
 * The outlines here are nominal, so a pocket counts as wholly inside a floor
 * only with room to spare: a path or polygon flare can reach this many times
 * its width at a sharp corner (the offset's miter limit), plus a margin for
 * the worker flattening a curve differently from the outline sampled here.
 */
const FLARE_CORNER_REACH = 4;
const CONTAINMENT_MARGIN_MM = 0.25;

/** A pocket's chamfer sunk to a floor, `depth` below the fill surface (mm). */
export interface SunkMouth {
  readonly depth: number;
  readonly flare: number;
}

/** A floor the flare is trimmed to, keyed so each is built once. */
export interface FloorTrim {
  readonly key: string;
  readonly cutout: Cutout;
}

/** A flare cut as a tool of its own. */
export interface NestedOpening {
  /** One placed pocket, its repeat already applied. */
  readonly pocket: Cutout;
  /** The id the pocket's cavity tools are registered under. */
  readonly ownerId: string;
  /** The cutout whose colour unit the pocket's cavity takes. */
  readonly colorOwner: Cutout;
  /** Depth of the floor below the fill surface (mm). */
  readonly floorDepth: number;
  /** Chamfer width at that floor (mm). */
  readonly flare: number;
  /**
   * How far above the floor the flare's rim must carry on (mm): past a scooped
   * floor's fillet, so none of it is left overhanging the flare. Zero for a
   * flat floor, where a trimmed flare carried on would only split the
   * enclosing wall's face along its top.
   */
  readonly rise: number;
  /** Null when the flare lies wholly inside the floor's outline. */
  readonly trimTo: FloorTrim | null;
}

export interface NestedOpeningPlan {
  /**
   * Chamfers sunk to a floor, by placed pocket: a repeat instance's own id, or
   * a group member's id when every copy of the group sinks it alike.
   */
  readonly sunk: ReadonlyMap<string, SunkMouth>;
  readonly flares: readonly NestedOpening[];
}

interface Unit {
  readonly key: string;
  readonly cutout: Cutout;
  readonly ownerId: string;
  readonly colorOwner: Cutout;
  readonly grouped: boolean;
  readonly depth: number;
  readonly ring: OutlineRing;
  readonly bounds: OutlineBounds;
}

interface PocketOpenings {
  /** The deepest floor wholly around the pocket. */
  readonly sinkTo: NestedOpening | null;
  /** Floors it opens onto deeper than that; shallower ones lie inside its void. */
  readonly below: readonly NestedOpening[];
}

/**
 * Where a set of cutouts open below the fill surface. Takes the cutouts the
 * cavity builder cuts; text elements and mesh imprints are skipped here.
 */
export function planNestedOpenings(
  cutouts: readonly Cutout[],
  solidSurfaceZ: number
): NestedOpeningPlan {
  const sunk = new Map<string, SunkMouth>();
  const flares: NestedOpening[] = [];
  if (solidSurfaceZ <= 0) return { sunk, flares };
  const units = collectUnits(cutouts, solidSurfaceZ);
  const floors = units.filter((u) => resolveCutoutLeanDeg(u.cutout) === 0);

  // A group is built once and copied, so a member sinks only if every copy
  // sinks it alike; otherwise each copy's sunk chamfer becomes a flare.
  const memberCopies = new Map<string, PocketOpenings[]>();
  for (const unit of units) {
    const found = pocketOpenings(unit, floors);
    if (!unit.grouped) {
      if (found.sinkTo) sunk.set(unit.key, mouthAt(found.sinkTo));
      flares.push(...found.below);
      continue;
    }
    const copies = memberCopies.get(unit.ownerId);
    if (copies) copies.push(found);
    else memberCopies.set(unit.ownerId, [found]);
  }
  for (const [memberId, copies] of memberCopies) {
    const mouths = copies.map((c) => (c.sinkTo ? mouthAt(c.sinkTo) : null));
    const alike = mouths.every((m) => sameMouth(m, mouths[0]));
    const first = mouths[0];
    if (alike && first) sunk.set(memberId, first);
    for (const copy of copies) {
      if (!alike && copy.sinkTo) flares.push(copy.sinkTo);
      flares.push(...copy.below);
    }
  }
  return { sunk, flares };
}

function mouthAt(opening: NestedOpening): SunkMouth {
  return { depth: opening.floorDepth, flare: opening.flare };
}

function sameMouth(a: SunkMouth | null, b: SunkMouth | null): boolean {
  if (!a || !b) return a === b;
  return a.depth === b.depth && a.flare === b.flare;
}

function collectUnits(cutouts: readonly Cutout[], solidSurfaceZ: number): Unit[] {
  const units: Unit[] = [];
  const add = (cutout: Cutout, ownerId: string, colorOwner: Cutout, grouped: boolean): void => {
    const depth = Math.min(cutout.cutDepth, solidSurfaceZ);
    // The builder cuts nothing for a zero box, though a path still has a ring.
    if (depth <= 0 || cutout.width <= 0 || cutout.depth <= 0) return;
    const ring = cutoutOutlineRing(cutout);
    if (!ring || ring.length < 3) return;
    const { array: _array, ...placed } = cutout;
    units.push({
      key: cutout.id,
      cutout: placed,
      ownerId,
      colorOwner,
      grouped,
      depth,
      ring,
      bounds: ringBounds(ring),
    });
  };

  const groups = new Map<string, Cutout[]>();
  for (const c of cutouts) {
    if (c.shape === 'text' || c.shape === 'mesh') continue;
    if (c.groupId === null) {
      for (const instance of expandCutoutArray(c)) add(instance, c.id, c, false);
      continue;
    }
    const members = groups.get(c.groupId);
    if (members) members.push(c);
    else groups.set(c.groupId, [c]);
  }
  for (const members of groups.values()) {
    if ((members[0].groupOp ?? DEFAULT_GROUP_OP) !== 'union') continue;
    for (const copy of expandCutoutGroup(members)) {
      copy.forEach((m, i) => add(m, members[i].id, members[0], true));
    }
  }
  return units;
}

function pocketOpenings(unit: Unit, floors: readonly Unit[]): PocketOpenings {
  const chamfer = unit.cutout.chamferWidth ?? 0;
  if (
    !(CHAMFER_SHAPES as readonly string[]).includes(unit.cutout.shape) ||
    chamfer <= MIN_FLARE_MM
  ) {
    return { sinkTo: null, below: [] };
  }
  const openings: NestedOpening[] = [];
  for (const floor of floors) {
    if (floor === unit) continue;
    const opening = openingOnto(unit, chamfer, floor);
    if (opening) openings.push(opening);
  }
  let sinkTo: NestedOpening | null = null;
  for (const o of openings) {
    if (o.trimTo === null && (!sinkTo || o.floorDepth > sinkTo.floorDepth)) sinkTo = o;
  }
  const floorDepth = sinkTo?.floorDepth ?? 0;
  return { sinkTo, below: openings.filter((o) => o.floorDepth > floorDepth) };
}

function openingOnto(unit: Unit, chamfer: number, floor: Unit): NestedOpening | null {
  const lean = (resolveCutoutLeanDeg(unit.cutout) * Math.PI) / 180;
  const cos = Math.cos(lean);
  const scoop = resolveScoop(unit.cutout, unit.depth);
  const reserve = Math.max(MIN_STRAIGHT_WALL_MM, scoop.w, scoop.d);
  const flare = Math.min(chamfer, unit.depth - floor.depth / cos - reserve);
  if (flare <= MIN_FLARE_MM) return null;

  const section = lean === 0 ? unit.ring : leanedSection(unit.cutout, floor.depth, lean);
  if (!section) return null;
  // Sized by the full chamfer, not this floor's: a pocket counted as inside
  // loses its surface chamfer and any shallower flare to this floor, so those
  // have to fit inside it too.
  const reach = (Math.max(0, unit.cutout.clearance ?? 0) + chamfer) / cos;
  const slack = FLARE_CORNER_REACH * reach + CONTAINMENT_MARGIN_MM;
  if (!boundsMeet(ringBounds(section), floor.bounds, slack)) return null;

  const relation = relate(section, floor.ring, slack);
  if (relation === 'apart') return null;
  // A leaned flare's extension sweeps sideways as it rises, so only a vertical
  // one stays inside the outline it starts in.
  const trimTo =
    relation === 'inside' && lean === 0 ? null : { key: floor.key, cutout: floor.cutout };
  const fillet = resolveScoop(floor.cutout, floor.depth);
  const floorScoop = Math.max(fillet.w, fillet.d);
  return {
    pocket: unit.cutout,
    ownerId: unit.ownerId,
    colorOwner: unit.colorOwner,
    floorDepth: floor.depth,
    flare,
    rise: floorScoop > 0 ? Math.min(floor.depth, floorScoop + RISE_PAST_SCOOP_MM) : 0,
    trimTo,
  };
}

/**
 * Where a leaned pocket crosses the level `depth` below its mouth: its drawn
 * section stretched along the lean by 1/cos and carried down the axis, which
 * travels toward local +Y for a positive lean.
 */
function leanedSection(cutout: Cutout, depth: number, lean: number): OutlineRing | null {
  const flat = cutoutOutlineRing({ ...cutout, rotation: 0 });
  if (!flat) return null;
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  const shift = depth * Math.tan(lean);
  const cos = Math.cos(lean);
  return flat.map(([x, y]) => rotateAbout(x, cy + (y - cy) / cos + shift, cx, cy, cutout.rotation));
}

function boundsMeet(a: OutlineBounds, b: OutlineBounds, slack: number): boolean {
  return (
    a.minX - slack <= b.maxX &&
    a.maxX + slack >= b.minX &&
    a.minY - slack <= b.maxY &&
    a.maxY + slack >= b.minY
  );
}

/**
 * How a pocket's rim sits against a floor's outline: `apart` when it never
 * enters it (disjoint, or the floor lies inside the pocket), `inside` when it
 * stays more than `slack` clear of the floor's edge, `crossing` otherwise.
 */
function relate(
  rim: OutlineRing,
  floor: OutlineRing,
  slack: number
): 'apart' | 'inside' | 'crossing' {
  if (ringsCross(rim, floor)) return 'crossing';
  if (!pointInRing(floor, rim[0])) return 'apart';
  return ringsCloserThan(rim, floor, slack) ? 'crossing' : 'inside';
}

function pointInRing(ring: OutlineRing, [x, y]: OutlinePoint): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function cross(o: OutlinePoint, a: OutlinePoint, b: OutlinePoint): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function segmentsCross(
  a: OutlinePoint,
  b: OutlinePoint,
  c: OutlinePoint,
  d: OutlinePoint
): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 <= 0 && d3 * d4 <= 0 && !(d1 === 0 && d2 === 0);
}

type Edge = readonly [OutlinePoint, OutlinePoint];

/** The ring's edges whose box comes within `slack` of `bounds`. */
function edgesNear(ring: OutlineRing, bounds: OutlineBounds, slack: number): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    if (segmentMeetsBounds(p, q, bounds, slack)) edges.push([p, q]);
  }
  return edges;
}

function ringsCross(a: OutlineRing, b: OutlineRing): boolean {
  const others = edgesNear(b, ringBounds(a), 0);
  for (const [p, q] of edgesNear(a, ringBounds(b), 0)) {
    for (const [c, d] of others) if (segmentsCross(p, q, c, d)) return true;
  }
  return false;
}

function segmentMeetsBounds(
  p: OutlinePoint,
  q: OutlinePoint,
  bounds: OutlineBounds,
  slack: number
): boolean {
  return (
    Math.min(p[0], q[0]) - slack <= bounds.maxX &&
    Math.max(p[0], q[0]) + slack >= bounds.minX &&
    Math.min(p[1], q[1]) - slack <= bounds.maxY &&
    Math.max(p[1], q[1]) + slack >= bounds.minY
  );
}

function pointSegmentDistance(p: OutlinePoint, a: OutlinePoint, b: OutlinePoint): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Whether two rings that do not cross come within `gap` of each other. */
function ringsCloserThan(a: OutlineRing, b: OutlineRing, gap: number): boolean {
  const others = edgesNear(b, ringBounds(a), gap);
  for (const [p, q] of edgesNear(a, ringBounds(b), gap)) {
    for (const [c, d] of others) {
      const near =
        pointSegmentDistance(p, c, d) < gap ||
        pointSegmentDistance(q, c, d) < gap ||
        pointSegmentDistance(c, p, q) < gap ||
        pointSegmentDistance(d, p, q) < gap;
      if (near) return true;
    }
  }
  return false;
}
