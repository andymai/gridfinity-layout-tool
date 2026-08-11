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
import { baseFloorZ, baseWallHeight } from '@/features/bin-designer/utils/binDimensions';
import type { BinParams } from '@/features/bin-designer/types';

/** The params {@link binLipTopWorldZ} reads — narrow so partial callers fit. */
export type LidSeatSource = Pick<
  BinParams,
  'height' | 'heightUnitMm' | 'base' | 'lid' | 'extraWallHeightMm'
>;

// The anchor formulas now live in `@/features/bin-designer/types/lid` — a
// main-thread-safe module both this preview and the worker import, so the two
// hand-synced copies this file used to hold can't drift. Re-exported here so
// existing consumers keep their import path.
export { LID_EXTRA_HEIGHT, lidAnchorZ, lidWallBottomZ } from '@/features/bin-designer/types/lid';

export const PREVIEW_Z_OFFSET = 0.1;

/**
 * World-Z of the bin's stacking-lip top in the R3F preview frame — the plane a
 * seated lid's `anchorZ` lands on. Mirrors the worker's `dimensions.lipTopZ`.
 *
 * The wall top is `floorZ + wallHeight`, and it is worth spelling out why that
 * is NOT `floorZ + height * heightUnitMm`: `wallHeight` already has the
 * Gridfinity socket subtracted, so adding the floor back on top of the nominal
 * height double-counts it (#3431). The two agree only for a socketless base,
 * where `floorZ` is the skirt or zero. An exterior-wall collar
 * (`extraWallHeightMm`, #2500) raises the walls and the lip with them. With the
 * stacking lip the top face lands `LIP_HEIGHT − LIP_OVERLAP` above the wall;
 * without it the lid mates with the bare wall. `PREVIEW_Z_OFFSET` accounts for
 * BinMesh's group offset.
 *
 * Takes the params rather than loose scalars so the two derivations can't be
 * fed inconsistent halves of the same bin.
 */
export function binLipTopWorldZ(params: LidSeatSource): number {
  const { height, heightUnitMm, base, lid } = params;
  const wallTop =
    baseFloorZ(base, heightUnitMm, lid) +
    baseWallHeight(base, height * heightUnitMm) +
    Math.max(0, params.extraWallHeightMm ?? 0);
  const lipTopZ = base.stackingLip
    ? wallTop + GRIDFINITY.LIP_HEIGHT - GRIDFINITY.LIP_OVERLAP
    : wallTop;
  return lipTopZ + PREVIEW_Z_OFFSET;
}
