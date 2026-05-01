/**
 * Shared type and constant definitions for the wall pattern pipeline.
 *
 * Split out so `wallPatternBuilder` (orchestrator), `wallPatternCompound`
 * (base hex compounds), and `wallPatternClips` (cutout/handle/ramp clipping)
 * can all import without a circular dependency.
 */

import type { HandleSegment, HandleWallDef } from '@/shared/utils/handleCutoutClip';
import type { WallCutoutShape } from '@/shared/types/bin';
import type { RampZone } from './dividerBlendBuilder';

/** Cache name for the uncut per-wall hex compound (shared across cutout/handle/ramp nudges). */
export const WALL_PATTERN_BASE_CACHE = 'wallPatternBase';
/** Cache name for the post-clip per-wall compound (varies with cutout/handle/ramp params). */
export const WALL_PATTERN_CLIPPED_CACHE = 'wallPatternClipped';

/** Pre-computed cutout clipping parameters passed to applyWallPatternClips. */
export interface CutoutClipParams {
  readonly cutoutCfg: {
    enabled: boolean;
    widthMm: number | null;
    width: number;
    depth: number;
    alignment: 'left' | 'center' | 'right';
    offset: number;
  };
  readonly cutWidth: number;
  readonly userCutHeight: number;
  readonly expandedWidth: number;
  readonly expandedHeight: number;
  readonly clipOvershoot: number;
  readonly clipExtrudeDepth: number;
  readonly wallHeight: number;
  readonly wallSpan: number;
  readonly wallShape: WallCutoutShape;
  readonly wallThickness: number;
}

/** Pre-computed handle clipping parameters for a single wall. */
export interface HandleClipParams {
  readonly segments: HandleSegment[];
  readonly effectiveHeight: number;
  readonly centerZ: number;
  readonly clipExtrudeDepth: number;
  /** Handle wall positioning (uses handleBuilder convention, not pattern descriptor). */
  readonly handleWall: HandleWallDef;
}

/** Pre-computed ramp zone clipping parameters for a single wall. */
export interface RampZoneClipParams {
  readonly zones: readonly RampZone[];
  readonly clipExtrudeDepth: number;
  readonly wallHeight: number;
  /** Border width for clip boxes — max(CUTOUT_BORDER_WIDTH, shapeRadius)
   *  so hex prisms don't extend into divider walls at junctions. */
  readonly border: number;
}
