/**
 * Which walls a pocket opens through, and the channel each opening cuts.
 *
 * One computation for four readers: the worker's breach channels, the
 * lip-gap plan (which rails yield), the canvas overlay and the inspector's
 * chips. The knife slot's `openEnd` is the precedent (`knifeSlotWallExits`),
 * and this mirrors its host rules plus a taper gate: the worker skips every
 * breach under a tapered wall, so a plan that reported one there would yield
 * a rail to a notch that does not exist.
 *
 * A channel is measured from the shape's outline (`cutoutOutlineRing`), not a
 * bounding rectangle, so a turned slot exits at its true width and a circle
 * leaves a half-round notch. A group's extent is the interval its members'
 * extents combine to under the group's op: exact for a union whose members
 * overlap across the exit, an upper bound otherwise, which the worker shares
 * so the readers can never disagree.
 *
 * Pure and kernel-free: the inspector and the overlay run on the main thread,
 * which cannot import brepjs.
 */

import type { BinParams, Cutout, CutoutOpenSide, CutoutOpenSideSpec } from '@/shared/types/bin';
import {
  CHAMFER_SHAPES,
  CUTOUT_OPEN_SIDES,
  DEFAULT_GROUP_OP,
  MIN_OPEN_SIDE_WIDTH_MM,
  resolveCutoutLeanDeg,
} from '@/shared/types/bin';
import {
  arrayInstanceCount,
  expandCutoutArray,
  groupRepeatConfig,
} from '@/shared/utils/cutoutArray';
import { isPartialMask } from '@/shared/utils/cellMask';
import { cutoutOutlineRing, ringBounds, type OutlineBounds } from '@/shared/utils/cutoutOutline';
import { resolveOverhang } from '@/shared/utils/overhang';

/** Why a cutout's open sides stay enclosed. */
export type OpenSideBlocker = 'shape' | 'grouped' | 'lean' | 'host' | 'taper';

export type OpenSideHost = Pick<BinParams, 'base' | 'overhang' | 'cellMask'> & {
  readonly cutouts: readonly Cutout[];
};

/**
 * The first reason `cutout` cannot breach a wall on this host, or null.
 * Per-cutout reasons come first so the chips explain the thing the user can
 * change on the shape before the thing they would have to change on the bin.
 */
export function openSideBlocker(cutout: Cutout, host: OpenSideHost): OpenSideBlocker | null {
  if (cutout.shape === 'text' || cutout.shape === 'mesh') return 'shape';
  // A repeated group copies one fused solid; its channels would have to be
  // planned per copy of the group, which nothing else in the pipeline does. A
  // repeat of one copy is the plain group the builder emits, so it passes.
  if (cutout.groupId !== null) {
    const repeat = groupRepeatConfig(groupMembers(host, cutout.groupId));
    if (repeat && arrayInstanceCount(repeat) > 1) return 'grouped';
  }
  if (resolveCutoutLeanDeg(cutout) !== 0) return 'lean';
  if (!host.base.solid) return 'host';
  if (resolveOverhang(isPartialMask(host.cellMask) ? undefined : host.overhang).taper) {
    return 'taper';
  }
  return null;
}

function groupMembers(host: OpenSideHost, groupId: string): Cutout[] {
  return host.cutouts.filter((c) => c.groupId === groupId);
}

function isOpenSide(value: unknown): value is CutoutOpenSide {
  return (CUTOUT_OPEN_SIDES as readonly unknown[]).includes(value);
}

/**
 * Valid specs, one per side, in canonical side order; `undefined` for none.
 * Accepts the bare wall names the first release wrote as well as spec objects.
 */
export function normalizeOpenSides(raw: unknown): CutoutOpenSideSpec[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const bySide = new Map<CutoutOpenSide, CutoutOpenSideSpec>();
  for (const entry of raw as unknown[]) {
    const side = typeof entry === 'string' ? entry : (entry as { side?: unknown } | null)?.side;
    if (!isOpenSide(side) || bySide.has(side)) continue;
    const spec: { side: CutoutOpenSide; widthMm?: number; tunnel?: boolean } = { side };
    if (typeof entry === 'object' && entry !== null) {
      const { widthMm, tunnel } = entry as { widthMm?: unknown; tunnel?: unknown };
      if (
        typeof widthMm === 'number' &&
        Number.isFinite(widthMm) &&
        widthMm >= MIN_OPEN_SIDE_WIDTH_MM
      ) {
        spec.widthMm = widthMm;
      }
      if (tunnel === true) spec.tunnel = true;
    }
    bySide.set(side, spec);
  }
  const sides = CUTOUT_OPEN_SIDES.flatMap((s) => bySide.get(s) ?? []);
  return sides.length > 0 ? sides : undefined;
}

export function sameOpenSides(a: readonly CutoutOpenSideSpec[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((spec, i) => {
    const other = b[i];
    if (typeof other !== 'object' || other === null) return false;
    const o = other as Record<string, unknown>;
    return (
      Object.keys(o).length === Object.keys(spec).length &&
      o.side === spec.side &&
      o.widthMm === spec.widthMm &&
      o.tunnel === spec.tunnel
    );
  });
}

/** The sides the builder will actually open: the stored set, or none when gated. */
export function effectiveOpenSides(
  cutout: Cutout,
  host: OpenSideHost
): readonly CutoutOpenSideSpec[] {
  if (cutout.hidden === true) return [];
  if (openSideBlocker(cutout, host) !== null) return [];
  return normalizeOpenSides(cutout.openSides) ?? [];
}

/** One channel through one wall, in the interior's mm frame (origin bottom-left). */
export interface OpenSideChannel {
  /** The cutout whose colour tag the channel's faces take. */
  readonly ownerId: string;
  readonly side: CutoutOpenSide;
  /** Extent across the exit axis. */
  readonly lo: number;
  readonly hi: number;
  /** Where the channel starts along the exit axis: the shape's centre. */
  readonly start: number;
  /** The shape's own extent toward the wall, where the overlay's strip begins. */
  readonly edge: number;
  readonly tunnel: boolean;
  /** Entry chamfer the pocket carries, to flare the channel's mouth (mm). */
  readonly chamferMm: number;
  /** Nominal pocket depth; the worker clamps it to the fill height. */
  readonly cutDepth: number;
}

interface Opening {
  readonly ownerId: string;
  readonly bounds: OutlineBounds;
  readonly specs: readonly CutoutOpenSideSpec[];
  readonly chamferMm: number;
  readonly cutDepth: number;
}

function chamferOf(cutout: Cutout): number {
  return CHAMFER_SHAPES.includes(cutout.shape) ? Math.max(0, cutout.chamferWidth ?? 0) : 0;
}

function hull(bs: readonly OutlineBounds[]): OutlineBounds {
  return {
    minX: Math.min(...bs.map((x) => x.minX)),
    minY: Math.min(...bs.map((x) => x.minY)),
    maxX: Math.max(...bs.map((x) => x.maxX)),
    maxY: Math.max(...bs.map((x) => x.maxY)),
  };
}

/** True when `inner` lies entirely within `outer`. */
function contains(outer: OutlineBounds, inner: OutlineBounds): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY
  );
}

/**
 * The result the group's op leaves, as the interval its members combine to:
 * union and exclude take the hull; intersect the common interval; subtract the
 * hull of everything but the top z-indexed cutter, which mirrors
 * `applyGroupOp`'s reading of the members. An interval cannot tell an empty
 * boolean from a full one, so the cases it can see are refused here (a cutter
 * that swallows its base, an exclude of identical extents) and the worker
 * skips any group whose boolean built nothing; the rest is an upper bound.
 */
function groupBounds(members: readonly Cutout[]): OutlineBounds | null {
  const outlined: { c: Cutout; i: number; b: OutlineBounds }[] = [];
  members.forEach((c, i) => {
    const ring = cutoutOutlineRing(c);
    if (ring) outlined.push({ c, i, b: ringBounds(ring) });
  });
  if (outlined.length === 0) return null;
  const op = members[0].groupOp ?? DEFAULT_GROUP_OP;
  let pool = outlined;
  if (op === 'subtract' && outlined.length > 1) {
    const sorted = [...outlined].sort((a, b) => {
      const za = a.c.zIndex ?? 0;
      const zb = b.c.zIndex ?? 0;
      return za !== zb ? zb - za : b.i - a.i;
    });
    pool = sorted.slice(1);
    if (contains(sorted[0].b, hull(pool.map((e) => e.b)))) return null;
  }
  const bs = pool.map((e) => e.b);
  if (
    op === 'exclude' &&
    bs.length > 1 &&
    bs.every((b) => contains(b, bs[0]) && contains(bs[0], b))
  ) {
    return null;
  }
  if (op === 'intersect') {
    const b = {
      minX: Math.max(...bs.map((x) => x.minX)),
      minY: Math.max(...bs.map((x) => x.minY)),
      maxX: Math.min(...bs.map((x) => x.maxX)),
      maxY: Math.min(...bs.map((x) => x.maxY)),
    };
    return b.maxX > b.minX && b.maxY > b.minY ? b : null;
  }
  return hull(bs);
}

/** Every pocket that opens a wall, with the outline extent its channels measure from. */
function openings(params: OpenSideHost): Opening[] {
  const out: Opening[] = [];
  const seenGroups = new Set<string>();
  for (const master of params.cutouts) {
    if (master.groupId === null) {
      const specs = effectiveOpenSides(master, params);
      if (specs.length === 0) continue;
      for (const inst of master.array ? expandCutoutArray(master) : [master]) {
        const ring = cutoutOutlineRing(inst);
        if (!ring) continue;
        out.push({
          ownerId: master.id,
          bounds: ringBounds(ring),
          specs,
          chamferMm: chamferOf(inst),
          cutDepth: inst.cutDepth,
        });
      }
      continue;
    }
    if (seenGroups.has(master.groupId)) continue;
    seenGroups.add(master.groupId);
    // The same members the worker extrudes into the group's cavity: text and
    // mesh members add no profile solid, and a depthless member adds nothing.
    const members = groupMembers(params, master.groupId).filter(
      (c) => c.hidden !== true && c.shape !== 'text' && c.shape !== 'mesh' && c.cutDepth > 0
    );
    if (members.length === 0) continue;
    const bySide = new Map<CutoutOpenSide, CutoutOpenSideSpec>();
    let ownerId: string | null = null;
    for (const m of members) {
      for (const spec of effectiveOpenSides(m, params)) {
        if (bySide.has(spec.side)) continue;
        bySide.set(spec.side, spec);
        ownerId ??= m.id;
      }
    }
    if (ownerId === null) continue;
    const bounds = groupBounds(members);
    if (!bounds) continue;
    // An intersected cavity stops at its shallowest member; every other op
    // reaches its deepest.
    const depths = members.map((m) => m.cutDepth);
    const op = members[0].groupOp ?? DEFAULT_GROUP_OP;
    out.push({
      ownerId,
      bounds,
      specs: CUTOUT_OPEN_SIDES.flatMap((s) => bySide.get(s) ?? []),
      chamferMm: Math.max(...members.map(chamferOf)),
      cutDepth: op === 'intersect' ? Math.min(...depths) : Math.max(...depths),
    });
  }
  return out;
}

/**
 * Every channel the design's open sides cut, gated exactly as the builder
 * gates them. `emptyOwners` names cutouts whose cavity boolean built nothing
 * (the worker knows, the plan cannot), so their channels are dropped too.
 */
export function openSideChannels(
  params: OpenSideHost,
  emptyOwners: ReadonlySet<string> = new Set()
): readonly OpenSideChannel[] {
  const out: OpenSideChannel[] = [];
  for (const o of openings(params)) {
    if (emptyOwners.has(o.ownerId)) continue;
    const b = o.bounds;
    for (const spec of o.specs) {
      const alongX = spec.side === 'left' || spec.side === 'right';
      const full = alongX ? b.maxY - b.minY : b.maxX - b.minX;
      const centre = alongX ? (b.minY + b.maxY) / 2 : (b.minX + b.maxX) / 2;
      const width = spec.widthMm === undefined ? full : Math.min(spec.widthMm, full);
      if (width <= 0) continue;
      const edge =
        spec.side === 'right'
          ? b.maxX
          : spec.side === 'left'
            ? b.minX
            : spec.side === 'back'
              ? b.maxY
              : b.minY;
      out.push({
        ownerId: o.ownerId,
        side: spec.side,
        lo: centre - width / 2,
        hi: centre + width / 2,
        start: alongX ? (b.minX + b.maxX) / 2 : (b.minY + b.maxY) / 2,
        edge,
        tunnel: spec.tunnel === true,
        chamferMm: o.chamferMm,
        cutDepth: o.cutDepth,
      });
    }
  }
  return out;
}

/** One pocket breach through a perimeter wall, as the lip-gap plan reads it. */
export interface OpenSideExit {
  readonly side: CutoutOpenSide;
  /** Along-wall centre, in the bin's centred interior frame. */
  readonly centre: number;
  /** Opening width along the wall (mm). */
  readonly width: number;
}

/**
 * Every wall opening that reaches the lip. A tunnel keeps the wall above the
 * pocket, so it takes nothing from the lip and is not an exit here.
 */
export function openSideWallExits(
  params: OpenSideHost,
  innerW: number,
  innerD: number
): readonly OpenSideExit[] {
  return openSideChannels(params)
    .filter((c) => !c.tunnel)
    .map((c) => {
      const alongX = c.side === 'left' || c.side === 'right';
      const half = alongX ? innerD / 2 : innerW / 2;
      return { side: c.side, centre: (c.lo + c.hi) / 2 - half, width: c.hi - c.lo };
    });
}
