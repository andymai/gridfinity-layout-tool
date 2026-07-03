/**
 * Classifies each padded baseplate edge for over-tile feedback: which margins
 * are wide enough to fill with a clipped grid pocket vs which are too small and
 * stay solid. Mirrors the worker's `frameCells` threshold so the UI tells the
 * truth about what over-tile will produce.
 */
import { OVER_TILE_MIN_MARGIN_MM } from '@/core/constants';
import type { StoredBaseplateParams } from '@/core/types';

/** One padded edge, with its i18n label key (reuses the padding side labels). */
export interface OverTileEdge {
  readonly labelKey:
    | 'baseplate.paddingLeft'
    | 'baseplate.paddingRight'
    | 'baseplate.paddingFront'
    | 'baseplate.paddingBack';
  readonly mm: number;
}

export interface OverTileStatus {
  /** Padded edges wide enough to become a clipped grid tile (>= threshold). */
  readonly tiled: OverTileEdge[];
  /** Padded edges too small to tile (0 < margin < threshold) — stay solid. */
  readonly tooSmall: OverTileEdge[];
  /** True when at least one edge can be tiled (so over-tile does something). */
  readonly canOverTile: boolean;
}

export function resolveOverTileStatus(params: StoredBaseplateParams): OverTileStatus {
  const edges: OverTileEdge[] = [
    { labelKey: 'baseplate.paddingLeft', mm: params.paddingLeft },
    { labelKey: 'baseplate.paddingRight', mm: params.paddingRight },
    { labelKey: 'baseplate.paddingFront', mm: params.paddingFront },
    { labelKey: 'baseplate.paddingBack', mm: params.paddingBack },
  ];
  const tiled = edges.filter((e) => e.mm >= OVER_TILE_MIN_MARGIN_MM);
  const tooSmall = edges.filter((e) => e.mm > 0 && e.mm < OVER_TILE_MIN_MARGIN_MM);
  return { tiled, tooSmall, canOverTile: tiled.length > 0 };
}
