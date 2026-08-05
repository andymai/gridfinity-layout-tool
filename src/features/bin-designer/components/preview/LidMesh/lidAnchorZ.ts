/**
 * Preview-side lid placement helpers.
 *
 * The anchor formulas are re-exported from `@/features/bin-designer/types/lid`
 * (main-thread safe — the worker's `lidConstants` pulls in brepjs/WASM and
 * can't be imported here). They used to be a hand-synced copy; the shared
 * module removes that drift risk, and the cross-thread agreement test in
 * `LidMesh.test.tsx` still pins the two entry points together.
 *
 * This file must contain only constants + pure functions (no React) so the
 * consuming component file stays react-refresh friendly.
 */

import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

// The anchor formulas now live in `@/features/bin-designer/types/lid` — a
// main-thread-safe module both this preview and the worker import, so the two
// hand-synced copies this file used to hold can't drift. Re-exported here so
// existing consumers keep their import path.
export { LID_EXTRA_HEIGHT, lidAnchorZ, lidWallBottomZ } from '@/features/bin-designer/types/lid';

export const PREVIEW_Z_OFFSET = 0.1;

/**
 * World-Z of the bin's stacking-lip top in the R3F preview frame.
 *
 * In the final mesh frame the wall top sits at `height * heightUnitMm`
 * (the pipeline's translate stage already shifted non-flat bins up by
 * SOCKET_HEIGHT). An exterior-wall collar (`extraWallHeightMm`, issue #2500)
 * raises the walls + lip by that amount, so it adds directly to the wall top.
 * With the stacking lip the top face lands `LIP_HEIGHT − LIP_OVERLAP` above;
 * without it the lid mates with the bare wall. `PREVIEW_Z_OFFSET` accounts for
 * BinMesh's group offset.
 */
export function binLipTopWorldZ(
  height: number,
  heightUnitMm: number,
  hasStackingLip: boolean,
  extraWallHeightMm?: number,
  /**
   * Depth of whatever sits under the floor. 0 for a socketed or flat bin,
   * whose rim is at `height * heightUnitMm` either way; a tray bin's skirt
   * (#3036) raises the rim by its own depth. Pass `binDimensions().floorZ`.
   */
  baseOffsetZ = 0
): number {
  const wallTop = height * heightUnitMm + Math.max(0, extraWallHeightMm ?? 0) + baseOffsetZ;
  const lipTopZ = hasStackingLip
    ? wallTop + GRIDFINITY.LIP_HEIGHT - GRIDFINITY.LIP_OVERLAP
    : wallTop;
  return lipTopZ + PREVIEW_Z_OFFSET;
}
