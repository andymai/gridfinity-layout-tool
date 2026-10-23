import { isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import {
  hasDetachableFeet,
  isNestingBase,
  isSocketlessBase,
  isUndersideRelief,
  type BaseConfig,
  type BinStyle,
} from '@/features/bin-designer/types/base';
import { resolveDetachableFeet, type DetachableFeetParams } from './detachableFeetPlan';

type Footprint = Omit<DetachableFeetParams, 'base' | 'cellMask'>;

export interface FloorTextHostParams extends Partial<Footprint> {
  readonly style: BinStyle;
  readonly cellMask?: CellMask;
  readonly base: Pick<
    BaseConfig,
    | 'style'
    | 'solid'
    | 'spacer'
    | 'lightweight'
    | 'lightweightMode'
    | 'tile'
    | 'feet'
    | 'trayBottom'
  > &
    Partial<DetachableFeetParams['base']>;
}

function hasFootprint(p: FloorTextHostParams): p is FloorTextHostParams & DetachableFeetParams {
  return (
    p.width !== undefined &&
    p.depth !== undefined &&
    p.gridUnitMm !== undefined &&
    p.fractionalEdgeX !== undefined &&
    p.fractionalEdgeY !== undefined &&
    p.base.magnetDiameter !== undefined &&
    p.base.magnetDepth !== undefined &&
    p.base.screwDiameter !== undefined
  );
}

/**
 * Lightweight is inert under feet that are actually built. Requested feet that
 * place nothing (a 1-wide half lattice) leave it live, which opens the floor.
 * A caller with no footprint to resolve against is taken to get its feet.
 */
function detachableFeetBuilt(p: FloorTextHostParams): boolean {
  if (!hasDetachableFeet(p.base)) return false;
  return !hasFootprint(p) || resolveDetachableFeet(p).placements.length > 0;
}

/**
 * Why a bin cannot carry floor text, or null when it can. The panel, the colour
 * zones and the worker all ask this, so a caption the geometry skips never
 * claims a filament. Lightweight, spacer and base-only are inert on a
 * socketless base, which is why those flags only block a socketed body.
 */
export function floorTextHostBlock(p: FloorTextHostParams): 'polygon' | 'host' | null {
  if (isPartialMask(p.cellMask)) return 'polygon';
  if (p.style !== 'standard' || p.base.solid || isNestingBase(p.base)) return 'host';
  if (isSocketlessBase(p.base.style)) return null;
  if (p.base.tile === true || p.base.spacer) return 'host';
  const floorOpen = p.base.lightweight && !detachableFeetBuilt(p) && !isUndersideRelief(p.base);
  return floorOpen ? 'host' : null;
}
