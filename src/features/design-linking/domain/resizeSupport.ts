import type { Bin, BinId, DesignId, Layout, ValidationResult } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { placedSlant } from '@/shared/utils/placedSlant';
import { canPlaceBin } from '@/shared/utils/validation';
import { getBinsLinkedToDesign } from './linkageQueries';

/**
 * The first placement of a design whose end support would no longer fit once
 * the design stands `height` tall, other than `exceptBinId`. Every placement
 * reads its support from the design, so the check has to run before the
 * design changes: afterwards each would count the grown support as one it
 * already had.
 */
export function resizeBlockedBySupport(
  layout: Layout,
  linkedDesignId: DesignId,
  height: number,
  exceptBinId: BinId
): { bin: Bin; result: Extract<ValidationResult, { valid: false }> } | null {
  for (const bin of getBinsLinkedToDesign(layout.bins, linkedDesignId)) {
    if (bin.id === exceptBinId || bin.layerId === STAGING_ID) continue;
    const now = placedSlant(bin, layout)?.support;
    const then = placedSlant(bin, layout, height)?.support;
    if (!then || (now && now.width === then.width && now.depth === then.depth)) continue;
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
  return null;
}
