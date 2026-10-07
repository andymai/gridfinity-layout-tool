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
import { cutoutOutlineRing, rotateAbout } from '@/shared/utils/cutoutOutline';
import { expandCutoutArray, expandCutoutGroup } from '@/shared/utils/cutoutArray';
import { pointInPolyline } from '@/shared/utils/drawerOutlineGeometry';
import { outlinesComeWithin, outlinesTouch } from '@/shared/utils/outlineSegments';
import { pathCutoutCut } from '@/shared/utils/pathCutoutOutline';
import type { Pt } from '@/shared/utils/polygonOffset';
import {
  clearedProfile,
  entryChamferWidth,
  MIN_LOFTED_CHAMFER,
  MIN_STRAIGHT_WALL_MM,
} from './cutoutFit';
import { resolveScoop } from './cutoutScoopHelpers';

/** How far past a scooped floor's fillet a flare of its own carries on (mm). */
const RISE_PAST_SCOOP_MM = 0.5;

/**
 * A pocket counts as wholly inside a floor only with room to spare: a path or
 * polygon flare can reach this many times its width at a sharp corner (the
 * offset's miter limit), plus a margin for an outline drawing an arc as chords
 * where the kernel cuts the arc itself.
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

interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface Unit {
  readonly key: string;
  readonly cutout: Cutout;
  readonly ownerId: string;
  readonly colorOwner: Cutout;
  readonly grouped: boolean;
  readonly depth: number;
  /** The outline it is cut to at its floor, clearance included. */
  readonly ring: Pt[];
  readonly bounds: Bounds;
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
  if (solidSurfaceZ <= 0 || !cutouts.some(takesChamfer)) return { sunk, flares };
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

/** Whether the builder could chamfer this cutout's opening at all. */
function takesChamfer(cutout: Cutout): boolean {
  return (
    cutout.shape !== 'mesh' &&
    (CHAMFER_SHAPES as readonly string[]).includes(cutout.shape) &&
    (cutout.chamferWidth ?? 0) > MIN_LOFTED_CHAMFER
  );
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
    const ring = cutRing(cutout, depth);
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
      bounds: boundsOf(ring),
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

/**
 * The outline a cutout is cut to below its chamfer, in the interior frame and
 * turned by `rotation`: its insertion clearance included, from the same
 * sections the builder lofts, so a pocket the clearance carries onto a floor
 * is seen to open there.
 */
function cutRing(cutout: Cutout, depth: number, rotation = cutout.rotation): Pt[] | null {
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  const { clearance, w, d } = clearedProfile(cutout);
  let ring;
  if (cutout.shape === 'path') {
    const chamfer = entryChamferWidth({ ...cutout, cutDepth: depth });
    const cut = pathCutoutCut(cutout, clearance, chamfer > MIN_LOFTED_CHAMFER ? chamfer : 0);
    if (cut) {
      return cut.base.map((p) => {
        const [x, y] = rotateAbout(cx + p.x, cy + p.y, cx, cy, rotation);
        return { x, y };
      });
    }
    // A degenerate path is cut as its bounding box.
    ring = cutoutOutlineRing({ ...cutout, shape: 'rectangle', cornerRadius: 0, rotation });
  } else {
    const size = { x: cx - w / 2, y: cy - d / 2, width: w, depth: d };
    ring = cutoutOutlineRing({ ...cutout, ...size, rotation });
  }
  return ring ? ring.map(([x, y]) => ({ x, y })) : null;
}

function pocketOpenings(unit: Unit, floors: readonly Unit[]): PocketOpenings {
  if (!takesChamfer(unit.cutout)) return { sinkTo: null, below: [] };
  const chamfer = unit.cutout.chamferWidth ?? 0;
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
  if (flare <= MIN_LOFTED_CHAMFER) return null;

  const section = lean === 0 ? unit.ring : leanedSection(unit, floor.depth, lean);
  if (!section) return null;
  // Sized by the full chamfer, not this floor's: a pocket counted as inside
  // loses its surface chamfer and any shallower flare to this floor, so those
  // have to fit inside it too.
  const slack = (FLARE_CORNER_REACH * chamfer) / cos + CONTAINMENT_MARGIN_MM;
  if (!boundsMeet(boundsOf(section), floor.bounds, slack)) return null;

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
 * Where a leaned pocket crosses the level `depth` below its mouth: its section
 * stretched along the lean by 1/cos and carried down the axis, which travels
 * toward local +Y for a positive lean.
 */
function leanedSection(unit: Unit, depth: number, lean: number): Pt[] | null {
  const { cutout } = unit;
  const flat = cutRing(cutout, unit.depth, 0);
  if (!flat) return null;
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  const shift = depth * Math.tan(lean);
  const cos = Math.cos(lean);
  return flat.map((p) => {
    const [x, y] = rotateAbout(p.x, cy + (p.y - cy) / cos + shift, cx, cy, cutout.rotation);
    return { x, y };
  });
}

function boundsOf(ring: readonly Pt[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function boundsMeet(a: Bounds, b: Bounds, slack: number): boolean {
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
  rim: readonly Pt[],
  floor: readonly Pt[],
  slack: number
): 'apart' | 'inside' | 'crossing' {
  if (outlinesTouch(rim, floor)) return 'crossing';
  if (!pointInPolyline(floor, rim[0].x, rim[0].y)) return 'apart';
  return outlinesComeWithin(rim, floor, slack) ? 'crossing' : 'inside';
}
