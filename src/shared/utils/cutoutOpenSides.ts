/**
 * Which walls a rectangle pocket opens through, and whether it can.
 *
 * One gate for four readers: the worker's breach channels, the lip-gap plan
 * (which rails yield), the canvas overlay and the inspector's chips. The
 * knife slot's `openEnd` is the precedent (`knifeSlotWallExits`), and this
 * mirrors its host rules so a breach the plan reports is always one the
 * builder cuts. The one addition is the taper gate: the worker skips every
 * breach under a tapered wall, so a plan that reported one there would yield
 * a rail to a notch that does not exist.
 *
 * Pure and kernel-free: the inspector and the overlay run on the main thread,
 * which cannot import brepjs.
 */

import type {
  BinParams,
  Cutout,
  CutoutOpenSide,
  CutoutScoopEdges,
  LidCompatibilitySide,
} from '@/shared/types/bin';
import { CUTOUT_OPEN_SIDES, resolveCutoutLeanDeg } from '@/shared/types/bin';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import { isPartialMask } from '@/shared/utils/cellMask';
import { resolveOverhang } from '@/shared/utils/overhang';

/** Why a cutout's open sides stay enclosed. */
export type OpenSideBlocker = 'shape' | 'grouped' | 'rotation' | 'lean' | 'host' | 'taper';

export type OpenSideHost = Pick<BinParams, 'base' | 'overhang' | 'cellMask'>;

/**
 * The first reason `cutout` cannot breach a wall on this host, or null.
 * Per-cutout reasons come first so the chips explain the thing the user can
 * change on the shape before the thing they would have to change on the bin.
 */
export function openSideBlocker(cutout: Cutout, host: OpenSideHost): OpenSideBlocker | null {
  if (cutout.shape !== 'rectangle') return 'shape';
  if (cutout.groupId !== null) return 'grouped';
  if (cutout.rotation % 90 !== 0) return 'rotation';
  if (resolveCutoutLeanDeg(cutout) !== 0) return 'lean';
  if (!host.base.solid) return 'host';
  if (resolveOverhang(isPartialMask(host.cellMask) ? undefined : host.overhang).taper) {
    return 'taper';
  }
  return null;
}

/** Valid, de-duplicated sides in canonical order; `undefined` for none. */
export function normalizeOpenSides(raw: unknown): CutoutOpenSide[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const wanted = new Set(raw as unknown[]);
  const sides = CUTOUT_OPEN_SIDES.filter((s) => wanted.has(s));
  return sides.length > 0 ? sides : undefined;
}

/** The sides the builder will actually open: the stored set, or none when gated. */
export function effectiveOpenSides(cutout: Cutout, host: OpenSideHost): readonly CutoutOpenSide[] {
  if (cutout.hidden === true) return [];
  if (openSideBlocker(cutout, host) !== null) return [];
  return normalizeOpenSides(cutout.openSides) ?? [];
}

/**
 * World-axis half extents of an upright rectangle rotated in 90° steps. The
 * builder turns the tool by `-rotation` about Z, so a quarter turn swaps the
 * axes and nothing else.
 */
export function rectangleWorldHalfExtents(cutout: Pick<Cutout, 'width' | 'depth' | 'rotation'>): {
  readonly halfX: number;
  readonly halfY: number;
} {
  const quarter = ((Math.round(cutout.rotation / 90) % 2) + 2) % 2 === 1;
  return quarter
    ? { halfX: cutout.depth / 2, halfY: cutout.width / 2 }
    : { halfX: cutout.width / 2, halfY: cutout.depth / 2 };
}

/**
 * The cutout-local edge that faces bin wall `side` once the tool is rotated
 * by `-rotation`. Local +X sweeps right → front → left → back as the rotation
 * steps through 0/90/180/270 (the same table `knifeExitSide` uses); the other
 * three edges follow at quarter-turn offsets.
 */
export function localEdgeFacing(side: CutoutOpenSide, rotation: number): keyof CutoutScoopEdges {
  const steps = ((Math.round(rotation / 90) % 4) + 4) % 4;
  const worldOfLocal: Record<keyof CutoutScoopEdges, LidCompatibilitySide> = {
    right: WORLD_OF_LOCAL_X[steps],
    front: WORLD_OF_LOCAL_X[(steps + 1) % 4],
    left: WORLD_OF_LOCAL_X[(steps + 2) % 4],
    back: WORLD_OF_LOCAL_X[(steps + 3) % 4],
  };
  for (const edge of LOCAL_EDGES) {
    if (worldOfLocal[edge] === side) return edge;
  }
  return 'right';
}

const WORLD_OF_LOCAL_X: readonly LidCompatibilitySide[] = ['right', 'front', 'left', 'back'];
const LOCAL_EDGES: readonly (keyof CutoutScoopEdges)[] = ['right', 'front', 'left', 'back'];

/** One pocket breach through a perimeter wall. */
export interface OpenSideExit {
  readonly side: LidCompatibilitySide;
  /** Along-wall centre, in the bin's centred interior frame. */
  readonly centre: number;
  /** Opening width along the wall (mm). */
  readonly width: number;
}

/**
 * Every wall opening the design's open-sided rectangles cut, gated exactly as
 * the builder gates the channels. Repeat arrays expand to one exit per copy.
 */
export function openSideWallExits(
  params: BinParams,
  innerW: number,
  innerD: number
): readonly OpenSideExit[] {
  const out: OpenSideExit[] = [];
  for (const master of params.cutouts) {
    const sides = effectiveOpenSides(master, params);
    if (sides.length === 0) continue;
    for (const inst of master.array ? expandCutoutArray(master) : [master]) {
      const { halfX, halfY } = rectangleWorldHalfExtents(inst);
      const cx = inst.x + inst.width / 2 - innerW / 2;
      const cy = inst.y + inst.depth / 2 - innerD / 2;
      for (const side of sides) {
        const alongX = side === 'front' || side === 'back';
        out.push({ side, centre: alongX ? cx : cy, width: alongX ? 2 * halfX : 2 * halfY });
      }
    }
  }
  return out;
}
