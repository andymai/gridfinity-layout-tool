/**
 * Baseplate height derivations shared by the worker geometry and the UI.
 *
 * Kept out of `gridfinityGeometry.ts` so that near-leaf constants module does
 * not pick up `@/core/constants` — it is pulled into the WASM worker bundle and
 * into `shared/constants/labelPlates`, neither of which needs layout defaults.
 * Split out of the worker's `generatorConstants`, which owned this math but sits
 * under `features/generation`: any other feature importing it is a cross-feature
 * boundary violation (`check-module-boundaries.sh`). Living in `shared/` lets the
 * designer and the worker derive plate heights from one definition.
 */

import { SOLID_FLOOR_DEFAULT_MM } from '@/core/constants';
import { GRIDFINITY_SPEC, MAGNET_FLOOR } from './gridfinityGeometry';

/** The subset of baseplate params that determines how tall the plate prints. */
export interface BaseplateHeightParams {
  readonly magnetHoles: boolean;
  readonly magnetDepth: number;
  readonly solidFloor?: boolean;
  readonly solidFloorThickness?: number;
}

/**
 * Height of solid floor left under the baseplate sockets, in mm — the single
 * source of truth for the pocket-depth-vs-slab-height relationship shared by
 * the BREP build, the direct-mesh draft, and the split/connector heights.
 *
 * Two independent contributions, summed so the plate height is predictable:
 *   - Magnets need a retaining floor (MAGNET_FLOOR + magnetDepth) to seat in.
 *   - The `solidFloor` option adds its chosen thickness *below* that — the plate
 *     grows by exactly the floor thickness, and it keeps the underside continuous
 *     (see the lightweight suppression in the generator).
 * The blind magnet holes are always cut magnetDepth deep from the socket bottom,
 * so the extra solid floor just adds retaining material below them (both the BREP
 * build and the direct-mesh draft anchor the hole the same way). Neither on =
 * through-cut (0).
 */
export function baseplateFloorDepth(params: BaseplateHeightParams): number {
  const magnetFloor = params.magnetHoles ? MAGNET_FLOOR + params.magnetDepth : 0;
  const solidFloor = params.solidFloor ? (params.solidFloorThickness ?? SOLID_FLOOR_DEFAULT_MM) : 0;
  return magnetFloor + solidFloor;
}

/**
 * Total printed height of a baseplate (mm): the tapered socket plus whatever
 * solid material sits under it.
 *
 * NB this is the plate's PRINTED height, not what it contributes to an assembled
 * stack. A socketed bin's base occupies the top {@link GRIDFINITY_SPEC.SOCKET_HEIGHT}
 * of the plate, so a seated bin only rises by {@link baseplateFloorDepth} — zero
 * for the common no-magnet, no-solid-floor plate.
 */
export function baseplateTotalHeight(params: BaseplateHeightParams): number {
  return GRIDFINITY_SPEC.SOCKET_HEIGHT + baseplateFloorDepth(params);
}
