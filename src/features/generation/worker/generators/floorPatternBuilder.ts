/**
 * Bin floor pattern geometry — drainage / ventilation holes.
 *
 * Reuses the divider pattern's panel factory (caching, keep-out handling, stamp
 * dispatch) unchanged. The only difference is the frame: the factory emits a
 * panel standing up (span X, band Z, thickness Y) and the floor needs it lying
 * down (span X, band Y, thickness Z), so each panel is rotated -90 degrees
 * about X and dropped onto the floor.
 *
 * The band is centred on the panel (`bandZ0 = -patternDepth / 2`), which makes
 * the factory's band coordinate the window's own local Y — so
 * `floorPatterns.planFloorPattern` can express its keep-outs entirely in window
 * coordinates.
 *
 * Unlike every other feature tool, these cuts are ALSO applied to the deferred
 * base socket (see `booleanStage`). Cutting the body alone would leave the
 * holes ending on the socket's top face — a blind pocket in the preview and,
 * once the socket is fused for export, in the exported model too.
 */

import { rotate, translate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { PipelineContext } from './pipeline/types';
import { resolvePanelFactory } from './dividerPatternBuilder';
import { buildCacheKey, compactKey, quantize } from './cacheKeyUtils';
import { planFloorPattern } from './floorPatterns';
import { DEFAULT_PATTERN_SCALE } from '@/shared/types/bin';
import { checkCancelled } from './utils/abort';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';

/**
 * Floor-pattern cut targets plus the geometry identity of the whole set.
 *
 * `key` is empty when no floor cut applies, and otherwise identifies every
 * placed window: the factory's local-panel key (motif variant, span, keep-outs,
 * band, cut depth) composed with each window's placement. These cuts also carve
 * the deferred socket, so `booleanStage` uses this key both for the body resume
 * and for caching the carved socket.
 */
export interface FloorPatternResult {
  readonly shapes: Shape3D[];
  readonly key: string;
}

/**
 * Build the floor-pattern cut targets for a bin.
 *
 * `shapes` is empty (and `key` blank) whenever the feature is off, unavailable
 * for this bin, or no window is large enough for a single element. Each returned
 * shape is owned by the caller and must be cut from BOTH the body and the
 * deferred socket.
 */
export function buildFloorPattern(ctx: PipelineContext): FloorPatternResult {
  const { params, dimensions: dim, signal, originToTag, perfCollector } = ctx;
  const NONE: FloorPatternResult = { shapes: [], key: '' };

  const floorPattern = params.floorPattern;
  if (floorPattern?.enabled !== true) return NONE;

  const plan = planFloorPattern(params, dim);
  if (!plan) return NONE;

  const factory = resolvePanelFactory(params, dim.innerW, dim.innerD, {
    pattern: floorPattern.pattern,
    scale: floorPattern.scale ?? DEFAULT_PATTERN_SCALE,
  });
  if (!factory) return NONE;

  const cutDepth = plan.cutZ1 - plan.cutZ0;
  const centerZ = (plan.cutZ0 + plan.cutZ1) / 2;

  const start = perfCollector ? performance.now() : 0;
  const shapes: Shape3D[] = [];
  const keyParts: string[] = [];
  for (const window of plan.windows) {
    checkCancelled(signal);
    const bandZ0 = -window.patternDepth / 2;
    const panel = factory.build(window, bandZ0, window.patternDepth, cutDepth);
    if (!panel) continue;

    // Identity of this placed cut: the factory's local-panel key plus the
    // window's placement (its x/y already fold in the interior offset).
    keyParts.push(
      compactKey(
        buildCacheKey(
          factory.keyFor(window, bandZ0, window.patternDepth, cutDepth),
          quantize(window.x),
          quantize(window.y),
          quantize(centerZ)
        )
      )
    );

    // Stand the panel down onto the floor: (x, y, z) -> (x, z, -y), so the
    // factory's band axis becomes Y and its thickness axis becomes Z.
    const laid = rotate(panel, -90, { axis: [1, 0, 0] });
    panel.delete();
    const placed = translate(laid, [window.x, window.y, centerZ]);
    laid.delete();

    collectOrigins(placed, FeatureTag.BASE, originToTag);
    shapes.push(placed);
  }

  if (perfCollector && shapes.length > 0) {
    perfCollector.recordWallPatternSubstep(
      'floor_panels',
      performance.now() - start,
      shapes.length
    );
  }

  if (shapes.length === 0) return NONE;
  return { shapes, key: compactKey(buildCacheKey('floor-v1', ...keyParts)) };
}
