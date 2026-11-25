import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { buildFullParams } from './utils/buildFullParams';
import { computeBaseplateTiling } from './utils/splitPlanner';
import type { BaseplateTiling } from './types/tiling';

export type { BaseplatePiece, BaseplateTiling } from './types/tiling';

/**
 * The React-free entry of this feature for the agent tools, which run in a
 * Vercel function. The default baseplate for a grid, split for a print bed
 * the way the baseplate generator splits it.
 */
export function splitDefaultBaseplate(
  grid: { readonly width: number; readonly depth: number },
  bedMm: { readonly width: number; readonly depth: number },
  gridUnitMm = 42
): BaseplateTiling {
  const full = buildFullParams(
    DEFAULT_BASEPLATE_PARAMS,
    grid.width,
    grid.depth,
    gridUnitMm,
    'end',
    'end'
  );
  return computeBaseplateTiling(full, bedMm.width, bedMm.depth);
}
