import type { Bin, BinId, DesignId, Layout, Rect, ValidationResult } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { footprintsOverlap } from '@/shared/utils/collision';
import { placedSlant } from '@/shared/utils/placedSlant';
import { canPlaceBin } from '@/shared/utils/validation';
import { getBinsLinkedToDesign } from './linkageQueries';

type Refusal = Extract<ValidationResult, { valid: false }>;

const sameRect = (a: Rect, b: Rect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.depth === b.depth;

const overlapsAny = (a: readonly Rect[], b: readonly Rect[]): boolean =>
  a.some((r) => b.some((s) => footprintsOverlap(r, s)));

/**
 * The first placement of a design whose end support would no longer fit once
 * the design stands `height` tall. Every placement reads its support from the
 * design, so the check runs before the design changes, against the layout as
 * it stands: afterwards each would count a grown support as one it already
 * had. `exceptBinId` was checked by its own edit against everything but its
 * siblings, which may grow too.
 */
export function resizeBlockedBySupport(
  layout: Layout,
  linkedDesignId: DesignId,
  height: number,
  exceptBinId: BinId
): { bin: Bin; result: Refusal } | null {
  const placements = getBinsLinkedToDesign(layout.bins, linkedDesignId)
    .filter((bin) => bin.layerId !== STAGING_ID)
    .map((bin) => {
      const now = placedSlant(bin, layout)?.support ?? null;
      const then = placedSlant(bin, layout, height);
      const grown = then?.support ?? null;
      return {
        bin,
        slanted: then !== null,
        grows: grown !== null && !(now !== null && sameRect(now, grown)),
        now: now ? [bin, now] : [bin],
        then: grown ? [bin, grown] : [bin],
      };
    });

  for (const placement of placements) {
    if (placement.bin.id === exceptBinId || !placement.grows) continue;
    const { bin } = placement;
    const result = canPlaceBin(
      {
        x: bin.x,
        y: bin.y,
        width: bin.width,
        depth: bin.depth,
        height: bin.height,
        designHeight: height,
      },
      bin.layerId,
      layout,
      bin.id
    );
    if (!result.valid) return { bin, result };
  }

  // Two supports can grow into each other, which no check against the layout
  // as it stands can see.
  for (const [i, a] of placements.entries()) {
    for (const b of placements.slice(i + 1)) {
      if (!a.grows && !b.grows) continue;
      const sameLayer = a.bin.layerId === b.bin.layerId;
      if (!sameLayer && !a.slanted && !b.slanted) continue;
      if (!overlapsAny(a.then, b.then) || overlapsAny(a.now, b.now)) continue;
      return {
        bin: b.bin,
        result: {
          valid: false,
          reason: sameLayer ? 'collision' : 'blocked_zone',
          blockingInfo: {
            binId: a.bin.id,
            layerId: a.bin.layerId,
            layerName: layout.layers.find((l) => l.id === a.bin.layerId)?.name ?? a.bin.layerId,
          },
        },
      };
    }
  }
  return null;
}
