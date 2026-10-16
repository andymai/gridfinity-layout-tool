/**
 * The floor an inside wall caption has to clear, cell by cell along the wall:
 * raised compartment floors and the interior fillet above them, each no larger
 * than its builder makes it. Same clip frame as `insideWallObstacles`.
 */

import type { BinParams, WallTextSide } from '@/shared/types/bin';
import {
  MAX_COMPARTMENT_FLOOR_RAISE_MM,
  MIN_RAISED_CAVITY_MM,
  compartmentHasTiltedEdge,
  isNestingBase,
} from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import {
  INTERIOR_FILLET_HEADROOM_MM,
  interiorFilletRadiusMm,
  narrowestCavitySpansMm,
} from '@/shared/utils/interiorFillet';
import {
  isLiteFloorOpen,
  resolveBinFloorMm,
  resolveCompartmentDividerHeight,
} from '@/shared/utils/slotMath';
import type { WallRect } from '@/shared/utils/maximalClearRects';

/** What the floor collector reads beyond params. */
interface FloorDims {
  readonly innerW: number;
  readonly innerD: number;
  readonly interiorHeight: number;
}

/**
 * Each compartment's floor raise as the generator builds it. Nothing on a body
 * the raised-floor feature skips (a raise survives a style change), and
 * otherwise as `resolveFloorRaises` does: requests for a compartment that no
 * longer exists or has a tilted edge are dropped, and the rest are held below
 * the ceiling.
 */
export function builtFloorRaises(
  params: BinParams,
  floorZ: number,
  interiorHeight: number
): Map<number, number> {
  const out = new Map<number, number>();
  const raises = params.compartments.floorRaises;
  if (!raises || isPartialMask(params.cellMask)) return out;
  if (params.style !== 'standard' || params.base.solid || params.base.tile === true) return out;
  if (isLiteFloorOpen(params) || isNestingBase(params.base)) return out;
  const ceiling = Math.min(
    MAX_COMPARTMENT_FLOOR_RAISE_MM,
    interiorHeight - floorZ - MIN_RAISED_CAVITY_MM
  );
  if (ceiling <= 0) return out;
  const ids = new Set(params.compartments.cells);
  raises.forEach((raise, id) => {
    if (typeof raise !== 'number' || !Number.isFinite(raise) || raise <= 0) return;
    if (!ids.has(id) || compartmentHasTiltedEdge(params.compartments, id)) return;
    out.set(id, Math.min(raise, ceiling));
  });
  return out;
}

/** Every compartment with its cell bounds. */
/**
 * Each compartment's floor fillet radius, no larger than `finishPlan` builds
 * it: held below the compartment's own top (a divider's, when it has one) and
 * to half its narrowest span. Empty when the fillet feature does not run.
 */
function builtFilletRadii(
  params: BinParams,
  dims: FloorDims,
  floorZ: number,
  raises: ReadonlyMap<number, number>
): Map<number, number> {
  const out = new Map<number, number>();
  const requested = interiorFilletRadiusMm(params);
  if (requested === 0 || params.style !== 'standard' || params.base.solid) return out;
  if (isNestingBase(params.base) || isLiteFloorOpen(params)) return out;
  const ids = new Set(params.compartments.cells);
  const zTop =
    ids.size > 1
      ? Math.min(
          dims.interiorHeight,
          resolveCompartmentDividerHeight(params.compartments.dividerHeight, dims.interiorHeight)
        )
      : dims.interiorHeight;
  const spans = narrowestCavitySpansMm(params);
  for (const id of ids) {
    const zFloor = floorZ + (raises.get(id) ?? 0);
    const radius = Math.min(
      requested,
      zTop - zFloor - INTERIOR_FILLET_HEADROOM_MM,
      (spans.get(id) ?? Infinity) / 2
    );
    if (radius > 0) out.set(id, radius);
  }
  return out;
}

/**
 * The floor along this wall, cell by cell: a raised compartment floor is built
 * within its own cells, and the fillet climbs the wall above whichever floor
 * each cell has.
 */
export function floorObstacles(params: BinParams, dims: FloorDims, side: WallTextSide): WallRect[] {
  const { cols, rows, cells } = params.compartments;
  if (cells.length !== cols * rows) return [];
  const floorZ = resolveBinFloorMm(params);
  const raises = builtFloorRaises(params, floorZ, dims.interiorHeight);
  const fillets = builtFilletRadii(params, dims, floorZ, raises);
  if (raises.size === 0 && fillets.size === 0) return [];
  const alongX = side === 'front' || side === 'back';
  const count = alongX ? cols : rows;
  const span = alongX ? dims.innerW : dims.innerD;
  const pitch = span / count;
  const idAt = (i: number): number => {
    if (side === 'front') return cells[i];
    if (side === 'back') return cells[(rows - 1) * cols + i];
    if (side === 'left') return cells[i * cols];
    return cells[i * cols + cols - 1];
  };
  const out: WallRect[] = [];
  for (let i = 0; i < count; i++) {
    const id = idAt(i);
    const rise = (raises.get(id) ?? 0) + (fillets.get(id) ?? 0);
    if (rise <= 0) continue;
    out.push({
      minU: -span / 2 + i * pitch,
      maxU: -span / 2 + (i + 1) * pitch,
      minZ: -Infinity,
      maxZ: floorZ + rise,
    });
  }
  return out;
}
