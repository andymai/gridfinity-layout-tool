/**
 * Depth modes for bin cutouts: what a pocket's depth is held to when the bin
 * around it changes.
 *
 * `cutDepth` stays the one number every reader uses. For `floor` and `through`
 * it is derived here, and the designer store re-derives it after every write,
 * so the ghost preview, the depth readouts, the fit test and the generator all
 * see the same depth without each learning about modes. The generator also
 * resolves on entry, so a params object that skipped the store still builds
 * the pocket its mode describes.
 */

import type { BinParams, Cutout, CutoutDepthMode, CutoutShape } from '@/shared/types/bin';
import { hasDetachableFeet, resolveCutoutLeanDeg } from '@/shared/types/bin';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { socketHeightMm } from '@/shared/printSettings/gridfinityGeometry';
import { isPartialMask } from './cellMask';
import { resolveDetachableFeet } from './detachableFeetPlan';
import { resolveOverhang } from './overhang';

/** Shapes whose depth the user sets. A mesh imprint's depth is its tool's
 *  shape, a knife slot's comes from the knife, and text cuts no cavity. */
export const DEPTH_MODE_SHAPES: readonly CutoutShape[] = [
  'rectangle',
  'circle',
  'polygon',
  'slot',
  'path',
];

/** Thinnest floor `floor` mode offers on a bin with nothing solid underneath. */
export const MIN_CUTOUT_FLOOR_MM = 0.6;

/** Floor `floor` mode starts at when the bin has nothing solid underneath. */
export const DEFAULT_CUTOUT_FLOOR_MM = 2;

/** Shallowest pocket a floored mode resolves to, so a floor set higher than
 *  the fill leaves a visible pocket instead of none at all. */
const MIN_FLOORED_DEPTH_MM = 0.5;

/** Where depths are measured from, in mm. */
export interface CutoutDepthFrame {
  /** Fill above the body's underside: how deep a pocket can go and keep a floor. */
  readonly fillDepthMm: number;
  /**
   * Solid base under every pocket, counted toward its floor: a full socket.
   * 0 when nothing solid is guaranteed there (flat, tray, lightweight or
   * detachable-foot bases), so the floor is the body's own plastic.
   */
  readonly baseMm: number;
}

/** Range and starting value for {@link Cutout.floorMm}. */
export interface CutoutFloorRange {
  readonly min: number;
  readonly max: number;
  readonly initial: number;
}

/** Why `through` is unavailable for a cutout. */
export type CutoutThroughBlock = 'group' | 'tilt' | 'taper' | 'feet';

function round2(mm: number): number {
  return Math.round(mm * 100) / 100;
}

function solidBaseMm(params: BinParams): number {
  const { base } = params;
  if (base.style === 'flat' || base.style === 'lid') return 0;
  // Shelled cups stand in for the socket: open air under most of the floor.
  if (base.lightweight || base.spacer) return 0;
  if (hasDetachableFeet(base) && resolveDetachableFeet(params).placements.length > 0) return 0;
  return socketHeightMm(base.lowProfile);
}

export function cutoutDepthFrame(params: BinParams): CutoutDepthFrame {
  const fillDepthMm = Math.max(
    0,
    binDimensions(params).wallHeight - Math.max(0, params.cutoutConfig.topOffset)
  );
  return { fillDepthMm, baseMm: solidBaseMm(params) };
}

export function cutoutFloorRange(frame: CutoutDepthFrame): CutoutFloorRange {
  const min = frame.baseMm > 0 ? frame.baseMm : MIN_CUTOUT_FLOOR_MM;
  const max = Math.max(min, frame.baseMm + frame.fillDepthMm - MIN_FLOORED_DEPTH_MM);
  const initial = Math.min(max, frame.baseMm > 0 ? frame.baseMm : DEFAULT_CUTOUT_FLOOR_MM);
  return { min: round2(min), max: round2(max), initial: round2(initial) };
}

export function hasDepthModes(cutout: Pick<Cutout, 'shape'>): boolean {
  return DEPTH_MODE_SHAPES.includes(cutout.shape);
}

export function cutoutDepthMode(cutout: Pick<Cutout, 'shape' | 'depthMode'>): CutoutDepthMode {
  if (!hasDepthModes(cutout)) return 'fixed';
  return cutout.depthMode ?? 'fixed';
}

/** The depth the generator cuts for `cutout` in this frame. */
export function resolveCutoutDepth(
  cutout: Pick<Cutout, 'shape' | 'depthMode' | 'cutDepth' | 'floorMm'>,
  frame: CutoutDepthFrame
): number {
  switch (cutoutDepthMode(cutout)) {
    case 'fixed':
      return cutout.cutDepth;
    case 'through':
      return round2(frame.fillDepthMm);
    case 'floor': {
      const floor = cutout.floorMm ?? cutoutFloorRange(frame).initial;
      const depth = frame.fillDepthMm + frame.baseMm - floor;
      const shallowest = Math.min(MIN_FLOORED_DEPTH_MM, frame.fillDepthMm);
      return round2(Math.min(frame.fillDepthMm, Math.max(shallowest, depth)));
    }
  }
}

/** Floor left under a pocket of `cutDepth`, measured like {@link Cutout.floorMm}. */
export function floorUnderCutout(cutDepth: number, frame: CutoutDepthFrame): number {
  return round2(frame.baseMm + Math.max(0, frame.fillDepthMm - cutDepth));
}

/**
 * `params` with every bin cutout's `cutDepth` matching its mode, or the same
 * object when nothing moved. Lid cutouts always cut through their plate and
 * carry no mode.
 */
export function withResolvedCutoutDepths<P extends BinParams>(params: P): P {
  if (!params.cutouts.some((c) => c.depthMode !== undefined)) return params;
  const frame = cutoutDepthFrame(params);
  const cutouts = params.cutouts.map((c) => {
    const cutDepth = resolveCutoutDepth(c, frame);
    return cutDepth === c.cutDepth ? c : { ...c, cutDepth };
  });
  return cutouts.some((c, i) => c !== params.cutouts[i]) ? { ...params, cutouts } : params;
}

/**
 * Why a cutout cannot open out of the underside, or null when it can.
 *
 * - `group`: a Pathfinder group's other members would leave islands
 *   floating in the opening.
 * - `tilt`: the opening under a leaning pocket would need its own lean.
 * - `taper`: the flared wall narrows the interior below the floor line.
 * - `feet`: detachable feet print separately and would close the opening.
 */
export function throughBlockedReason(
  cutout: Pick<Cutout, 'groupId' | 'leanDeg' | 'shape'>,
  params: BinParams
): CutoutThroughBlock | null {
  if (cutout.groupId !== null) return 'group';
  if (resolveCutoutLeanDeg(cutout) !== 0) return 'tilt';
  const overhang = resolveOverhang(isPartialMask(params.cellMask) ? undefined : params.overhang);
  if (overhang.taper) return 'taper';
  if (hasDetachableFeet(params.base) && resolveDetachableFeet(params).placements.length > 0) {
    return 'feet';
  }
  return null;
}

/** True when the generator opens this cutout out of the underside. */
export function isThroughCut(
  cutout: Pick<Cutout, 'groupId' | 'leanDeg' | 'shape' | 'depthMode'>,
  params: BinParams
): boolean {
  return cutoutDepthMode(cutout) === 'through' && throughBlockedReason(cutout, params) === null;
}
