import type { Bin, BinId, DesignId, Layout, ValidationResult } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import {
  placedSlant,
  slantConflicts,
  withLinkedSlantFacts,
  type SlantConflict,
} from '@/shared/utils/placedSlant';
import { insideDrawer } from '@/shared/utils/validationPlacement';
import { getBinsLinkedToDesign } from './linkageQueries';

type Refusal = Extract<ValidationResult, { valid: false }>;

interface Standing {
  readonly bin: Bin;
  readonly conflicts: readonly SlantConflict[];
  readonly outside: Refusal | null;
}

function standings(layout: Layout, linkedDesignId: DesignId): Map<BinId, Standing> {
  const result = new Map<BinId, Standing>();
  for (const bin of getBinsLinkedToDesign(layout.bins, linkedDesignId)) {
    if (bin.layerId === STAGING_ID) continue;
    const slant = placedSlant(bin, layout);
    const inside = slant?.support ? insideDrawer(slant.support, layout) : null;
    result.set(bin.id, {
      bin,
      conflicts: slantConflicts(bin, slant, layout),
      outside: inside && !inside.valid ? inside : null,
    });
  }
  return result;
}

/**
 * The first placement of a design whose end support would collide or leave
 * the drawer once the design takes `size`, comparing every placement as it
 * stands with how it would stand, so a problem one already had never blocks
 * the resize. Each placement reads its support from the design, so the check
 * runs before the design changes and covers them all together.
 */
export function resizeBlockedBySupport(
  layout: Layout,
  linkedDesignId: DesignId,
  size: { readonly width: number; readonly depth: number; readonly height: number }
): { bin: Bin; result: Refusal } | null {
  const before = standings(layout, linkedDesignId);
  const after = withLinkedSlantFacts(
    linkedDesignId,
    (facts) => facts && { ...facts, ...size },
    () => standings(layout, linkedDesignId)
  );
  for (const [id, now] of after) {
    const was = before.get(id);
    if (now.outside && !was?.outside) return { bin: now.bin, result: now.outside };
    const fresh = now.conflicts.find((c) => !was?.conflicts.some((w) => w.with.id === c.with.id));
    if (fresh) {
      return {
        bin: now.bin,
        result: {
          valid: false,
          reason: fresh.kind === 'collision' ? 'collision' : 'blocked_zone',
          blockingInfo: {
            binId: fresh.with.id,
            layerId: fresh.with.layerId,
            layerName:
              layout.layers.find((l) => l.id === fresh.with.layerId)?.name ?? fresh.with.layerId,
          },
        },
      };
    }
  }
  return null;
}
