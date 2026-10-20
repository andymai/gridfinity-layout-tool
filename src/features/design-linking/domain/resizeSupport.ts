import type { Bin, BinId, DesignId, Layout, ValidationResult } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import {
  placedSlant,
  slantConflicts,
  withLinkedSlantFacts,
  type SlantConflict,
} from '@/shared/utils/placedSlant';
import { insideDrawer } from '@/shared/utils/validationPlacement';
import { changeOrder } from '@/shared/utils/changeOrder';
import { getBinsLinkedToDesign } from './linkageQueries';
import { planSiblingCascade } from './linkingRules';
import { createBinSyncUpdate } from './syncOperations';

type Refusal = Extract<ValidationResult, { valid: false }>;

type Size = { readonly width: number; readonly depth: number; readonly height: number };

/** A placement as the cascade leaves it: resizing drops its explicit overhang, as `bin.update` does. */
function resized(bin: Bin, size: Size): Bin {
  const { overhang: _dropped, ...rest } = bin;
  return { ...rest, ...createBinSyncUpdate(size) };
}

/**
 * The cascade's placements in an order where none is checked against a
 * sibling's cells before that sibling has left them.
 */
export function resizeOrder(bins: readonly Bin[], size: Size, layout: Layout): Bin[] {
  return changeOrder(
    bins.map((bin) => ({ bin, to: resized(bin, size) })),
    layout
  );
}

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

/** The layout as the cascade in `useBinResizedListener` leaves it. */
function cascaded(layout: Layout, linkedDesignId: DesignId, size: Size): Layout {
  const { syncable, allEligible } = planSiblingCascade(
    getBinsLinkedToDesign(layout.bins, linkedDesignId),
    size,
    layout
  );
  if (syncable.length === 0 || !allEligible) return layout;
  const reached = new Set(syncable.map((bin) => bin.id));
  return {
    ...layout,
    bins: layout.bins.map((bin) => (reached.has(bin.id) ? resized(bin, size) : bin)),
  };
}

/**
 * The first placement of a design whose end support would collide or leave
 * the drawer once the design takes `size`, comparing every placement as it
 * stands with how it would stand after the cascade, so a problem one already
 * had never blocks the resize. Each placement reads its support from the
 * design, so the check runs before the design changes and covers them all
 * together.
 */
export function resizeBlockedBySupport(
  layout: Layout,
  linkedDesignId: DesignId,
  size: Size
): { bin: Bin; result: Refusal } | null {
  const before = standings(layout, linkedDesignId);
  const after = withLinkedSlantFacts(
    linkedDesignId,
    (facts) => facts && { ...facts, ...size },
    () => standings(cascaded(layout, linkedDesignId, size), linkedDesignId)
  );
  for (const [id, now] of after) {
    const was = before.get(id);
    if (now.outside && !was?.outside) return { bin: now.bin, result: now.outside };
    const fresh = now.conflicts.find(
      (c) => !was?.conflicts.some((w) => w.with.id === c.with.id && w.kind === c.kind)
    );
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
