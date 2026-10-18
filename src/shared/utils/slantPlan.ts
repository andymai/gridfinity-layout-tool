import { SLANT_MAX_DEG, SLANT_SIDES } from '@/core/types';
import type { SlantConfig, SlantSide } from '@/core/types';
import type { BinParams } from '@/shared/types/bin';
import { hasMeshImprints } from '@/shared/generation/meshAsset';
import { socketHeightMm } from '@/shared/printSettings/gridfinityGeometry';
import { isPartialMask } from './cellMask';
import { hasOverhang, resolveOverhang } from './overhang';

/**
 * Features a slanted body cannot carry in v1. Each one either places geometry
 * relative to an upright wall (slide rails and their tray, a knife rest behind
 * the bin), lives below the floor where the shear would run backwards (a tray
 * bottom), reshapes the outer wall itself (overhang, a custom footprint), is cut
 * into the tessellated mesh in the unslanted frame (mesh pockets), or opens the
 * floor onto the upright socket, whose openings the sheared floor would no
 * longer meet (floor pattern, an open lightweight floor, a spacer). Detachable
 * feet plug vertical pins into blind holes in the floor, which the shear would
 * tilt; removable dividers are rectangular parts for slots the shear tilts; and
 * a raised pull tab stands above the rim, past the extent the bed check reads.
 */
export type SlantBlocker =
  | 'overhang'
  | 'customShape'
  | 'meshPocket'
  | 'trayBottom'
  | 'slide'
  | 'knifeRest'
  | 'floorPattern'
  | 'openFloor'
  | 'detachableFeet'
  | 'removableDividers'
  | 'pullTab';

export type SlantInputs = Pick<
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
  | 'style'
  | 'pullTab'
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
  if (base.feet === 'detachable' && base.style !== 'flat') return 'detachableFeet';
  if (params.style === 'slotted') return 'removableDividers';
  if (params.pullTab?.enabled) return 'pullTab';
  return null;
}

/** A stored slant as a plan, before anything in the bin gets to keep it off. */
export function slantPlanFor(slant: SlantConfig | undefined): SlantPlan | null {
  if (!slant || !SLANT_SIDES.includes(slant.side)) return null;
  if (!Number.isFinite(slant.angleDeg) || slant.angleDeg <= 0) return null;
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

/** The slant the generator applies, or null for an upright bin. */
export function resolveSlant(params: SlantInputs): SlantPlan | null {
  const plan = slantPlanFor(params.slant);
  return plan && slantBlocker(params) === null ? plan : null;
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

export type SlantExtentInputs = SlantInputs &
  Pick<
    BinParams,
    | 'width'
    | 'depth'
    | 'fractionalEdgeX'
    | 'fractionalEdgeY'
    | 'height'
    | 'heightUnitMm'
    | 'extraWallHeightMm'
    | 'gridUnitMm'
    | 'gridUnitMmY'
  >;

export interface SlantSpanInputs {
  /** The base has no socket, so the lean starts at the bed. */
  readonly flatBase: boolean;
  readonly lowProfile?: boolean;
  readonly height: number;
  readonly heightUnitMm: number;
  readonly extraWallHeightMm?: number;
}

export interface SlantSpan {
  readonly pivotZ: number;
  readonly topZ: number;
}

export function slantSpanZFor(input: SlantSpanInputs): SlantSpan {
  const pivotZ = input.flatBase ? 0 : socketHeightMm(input.lowProfile);
  const topZ = input.height * input.heightUnitMm + Math.max(0, input.extraWallHeightMm ?? 0);
  return { pivotZ, topZ };
}

/** Where the lean starts (the floor's underside) and ends (the body's top), above the bed. */
export function slantSpanZ(params: SlantExtentInputs): SlantSpan {
  return slantSpanZFor({
    flatBase: params.base.style === 'flat',
    lowProfile: params.base.lowProfile,
    height: params.height,
    heightUnitMm: params.heightUnitMm,
    extraWallHeightMm: params.extraWallHeightMm,
  });
}

/** How far the body's top edge sits past its footprint, in mm; 0 when upright. */
export function slantTopOffsetMm(params: SlantExtentInputs): number {
  const slant = resolveSlant(params);
  if (!slant) return 0;
  const { pivotZ, topZ } = slantSpanZ(params);
  return slant.k * Math.max(0, topZ - pivotZ);
}

/**
 * Whether the leaning body, top offset included, fits the bed either way
 * round. A slanted bin cannot be split, so this is the whole answer.
 */
export function slantedBinFitsBed(
  params: SlantExtentInputs,
  bedWidthMm: number,
  bedDepthMm: number = bedWidthMm
): boolean {
  const slant = resolveSlant(params);
  if (!slant) return true;
  const offset = slantTopOffsetMm(params);
  const pitchY = params.gridUnitMmY ?? params.gridUnitMm;
  const w = params.width * params.gridUnitMm - 0.5 + (slant.axis === 'x' ? offset : 0);
  const d = params.depth * pitchY - 0.5 + (slant.axis === 'y' ? offset : 0);
  return (w <= bedWidthMm && d <= bedDepthMm) || (w <= bedDepthMm && d <= bedWidthMm);
}

/** Clearance between the leaning wall and the support's slope, measured square to the slope. */
export const SLANT_SUPPORT_GAP_MM = 0.5;

export interface SlantSupportPlan {
  readonly slant: SlantPlan;
  readonly pivotZ: number;
  readonly topZ: number;
  readonly topOffsetMm: number;
  /** Footprint along the slant axis, in grid units. */
  readonly lengthU: number;
  /** Footprint across the slant: the bin's own, in grid units. */
  readonly widthU: number;
  /**
   * The bin's leading edge lands on a half-cell line, so the support starts
   * with a half cell for the rest of its feet to meet the baseplate's pockets.
   */
  readonly leadingHalf: boolean;
  /** The side of the cross axis the bin's own half column sits on, in its frame. */
  readonly crossEdge: 'start' | 'end';
}

export type SlantSupportExtent = SlantSpan &
  Pick<
    SlantExtentInputs,
    'width' | 'depth' | 'fractionalEdgeX' | 'fractionalEdgeY' | 'gridUnitMm' | 'gridUnitMmY'
  >;

/**
 * The wedge a row's last bin rests on: the cells past its footprint, long
 * enough that the leaning top edge still lands on it.
 */
export function planSlantSupport(params: SlantExtentInputs): SlantSupportPlan | null {
  const slant = resolveSlant(params);
  return slant ? planSupportFor(slant, { ...params, ...slantSpanZ(params) }) : null;
}

/** {@link planSlantSupport} for a slant already resolved, from the extent alone. */
export function planSupportFor(
  slant: SlantPlan,
  params: SlantSupportExtent
): SlantSupportPlan | null {
  if (!slant.endSupport) return null;
  const { pivotZ, topZ } = params;
  if (topZ <= pivotZ) return null;
  const topOffsetMm = slant.k * (topZ - pivotZ);
  const pitch = slant.axis === 'x' ? params.gridUnitMm : (params.gridUnitMmY ?? params.gridUnitMm);
  const reachU = (topOffsetMm + SLANT_SUPPORT_GAP_MM * Math.hypot(1, slant.k)) / pitch;
  const binAlongU = slant.axis === 'x' ? params.width : params.depth;
  const binEdge = slant.axis === 'x' ? params.fractionalEdgeX : params.fractionalEdgeY;
  // A fractional bin's half column sits on its 'end' side unless set to 'start';
  // leaning toward that side puts the leading edge on a half-cell line.
  const leadingHalf =
    binAlongU % 1 !== 0 && (slant.sign === 1 ? binEdge !== 'start' : binEdge === 'start');
  const lengthU = leadingHalf
    ? Math.max(0, Math.ceil(reachU - 0.5 - 1e-9)) + 0.5
    : Math.max(1, Math.ceil(reachU - 1e-9));
  return {
    slant,
    pivotZ,
    topZ,
    topOffsetMm,
    lengthU,
    widthU: slant.axis === 'x' ? params.depth : params.width,
    leadingHalf,
    crossEdge: slant.axis === 'x' ? params.fractionalEdgeY : params.fractionalEdgeX,
  };
}
