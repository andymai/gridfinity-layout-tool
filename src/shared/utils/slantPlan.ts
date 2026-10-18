import { SLANT_MAX_DEG, SLANT_SIDES } from '@/core/types';
import type { SlantConfig, SlantSide } from '@/core/types';
import type { BinParams } from '@/shared/types/bin';
import { hasMeshImprints } from '@/shared/generation/meshAsset';
import { isPartialMask } from './cellMask';
import { hasOverhang, resolveOverhang } from './overhang';

/**
 * Features a slanted body cannot carry in v1. Each one either places geometry
 * relative to an upright wall (slide rails and their tray, a knife rest behind
 * the bin), lives below the floor where the shear would run backwards (a tray
 * bottom), reshapes the outer wall itself (overhang, a custom footprint), is cut
 * into the tessellated mesh in the unslanted frame (mesh pockets), or opens the
 * floor onto the upright socket, whose openings the sheared floor would no
 * longer meet (floor pattern, an open lightweight floor, a spacer).
 */
export type SlantBlocker =
  | 'overhang'
  | 'customShape'
  | 'meshPocket'
  | 'trayBottom'
  | 'slide'
  | 'knifeRest'
  | 'floorPattern'
  | 'openFloor';

type SlantInputs = Pick<
  BinParams,
  | 'slant'
  | 'overhang'
  | 'cellMask'
  | 'cutouts'
  | 'meshAssets'
  | 'base'
  | 'slide'
  | 'knifeRest'
  | 'floorPattern'
>;

export interface SlantPlan {
  readonly angleDeg: number;
  readonly side: SlantSide;
  /** Horizontal travel per mm of rise: tan(angleDeg). */
  readonly k: number;
  readonly axis: 'x' | 'y';
  /** +1 when the top moves toward +axis (right, back). */
  readonly sign: 1 | -1;
  readonly endSupport: boolean;
}

export function slantBlocker(params: SlantInputs): SlantBlocker | null {
  if (hasOverhang(resolveOverhang(params.overhang))) return 'overhang';
  if (isPartialMask(params.cellMask)) return 'customShape';
  if (hasMeshImprints(params)) return 'meshPocket';
  if (params.base.style === 'lid') return 'trayBottom';
  if (params.slide.enabled) return 'slide';
  if (params.knifeRest?.enabled) return 'knifeRest';
  if (params.floorPattern?.enabled) return 'floorPattern';
  const { base } = params;
  const opensFloor = base.spacer || (base.lightweight && base.lightweightMode !== 'underside');
  if (opensFloor && base.style !== 'flat') return 'openFloor';
  return null;
}

/** The slant the generator applies, or null for an upright bin. */
export function resolveSlant(params: SlantInputs): SlantPlan | null {
  const slant = params.slant;
  if (!slant || !SLANT_SIDES.includes(slant.side)) return null;
  if (!Number.isFinite(slant.angleDeg) || slant.angleDeg <= 0) return null;
  if (slantBlocker(params) !== null) return null;
  const angleDeg = Math.min(slant.angleDeg, SLANT_MAX_DEG);
  return {
    angleDeg,
    side: slant.side,
    k: Math.tan((angleDeg * Math.PI) / 180),
    axis: slant.side === 'left' || slant.side === 'right' ? 'x' : 'y',
    sign: slant.side === 'right' || slant.side === 'back' ? 1 : -1,
    endSupport: slant.endSupport === true,
  };
}

/**
 * A slanted bin has no stackable top: a bin stacked on it would lean further.
 * Applied wherever params are stored or generated, because dozens of readers
 * take `base.stackingLip` at face value.
 */
export function normalizeSlant<T extends SlantInputs>(params: T): T {
  if (!params.base.stackingLip || resolveSlant(params) === null) return params;
  return { ...params, base: { ...params.base, stackingLip: false } };
}

/**
 * A stored slant as the generator reads it, or undefined for an upright bin, so
 * a cleared or malformed slant leaves no key behind.
 */
export function migrateSlant(raw: unknown): SlantConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { angleDeg, side, endSupport } = raw as Record<string, unknown>;
  if (typeof angleDeg !== 'number' || !Number.isFinite(angleDeg) || angleDeg <= 0) return undefined;
  if (!SLANT_SIDES.some((s) => s === side)) return undefined;
  return {
    angleDeg: Math.min(angleDeg, SLANT_MAX_DEG),
    side: side as SlantSide,
    ...(endSupport === true ? { endSupport: true } : {}),
  };
}
